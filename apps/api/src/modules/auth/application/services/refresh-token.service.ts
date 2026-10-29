import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
import { AuditService } from "../../../audit/audit.service.js";
import type { StaffRole } from "../../../../contracts/iam.js";
import type { LoginResponseDto } from "../../presentation/dto/login/login-response.dto.js";
import type { AuthRefreshResult } from "../../presentation/dto/refresh-token/refresh-response.dto.js";
import { MILLISECONDS_PER_DAY, SECONDS_PER_DAY } from "../../presentation/dto/auth.constants.js";
import type { LoginRequestContext } from "../../presentation/dto/login/login-request.dto.js";

export type {
    AuthRefreshResult
};

@Injectable()
export class RefreshTokenService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtTokenService: JwtTokenService,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Làm mới Access Token và xoay vòng Refresh Token một cách minh bạch (Refresh Token Rotation).
     * Tự động phát hiện hành vi tái sử dụng Refresh Token đã bị thu hồi (Replay Attack)
     * và lập tức vô hiệu hóa toàn bộ phiên liên quan trong cùng token family.
     */
    async refresh(
        rawRefreshToken: string,
        context: LoginRequestContext,
    ): Promise<AuthRefreshResult> {
        if (!rawRefreshToken || typeof rawRefreshToken !== "string" || !rawRefreshToken.trim()) {
            throw new UnauthorizedException("Thiếu Refresh Token.");
        }

        const tokenHash = createHash("sha256")
            .update(rawRefreshToken.trim())
            .digest("hex");

        const tokenRecord = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { staff: true },
        });

        if (!tokenRecord) {
            throw new UnauthorizedException("Refresh Token không hợp lệ hoặc không tồn tại.");
        }

        const now = new Date();

        // PHÁT HIỆN TÁI SỬ DỤNG TOKEN (REPLAY ATTACK):
        // Token này đã từng bị thu hồi trước đó mà vẫn có request gửi lên -> Dấu hiệu token bị rò rỉ/đánh cắp!
        // Cơ chế bảo vệ: Vô hiệu hóa ngay lập tức toàn bộ refresh token trong cùng familyId
        if (tokenRecord.revokedAt !== null) {
            await this.prisma.refreshToken.updateMany({
                where: { familyId: tokenRecord.familyId },
                data: { revokedAt: now },
            });

            await this.auditService.recordEvent({
                action: AuditAction.LOGIN_FAILURE,
                staffId: tokenRecord.staffId,
                ip: context.ip,
                userAgent: context.userAgent,
                metadata: {
                    reason: "REFRESH_TOKEN_REUSE_DETECTED",
                    familyId: tokenRecord.familyId,
                    staffId: tokenRecord.staffId,
                },
            });

            throw new UnauthorizedException(
                "Phát hiện Refresh Token bất thường (đã từng bị thu hồi). Toàn bộ phiên đăng nhập đã bị vô hiệu hóa vì lý do bảo mật.",
            );
        }

        // Kiểm tra thời hạn hiệu lực của Refresh Token
        if (tokenRecord.expiresAt < now) {
            throw new UnauthorizedException("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
        }

        // Kiểm tra trạng thái tài khoản Staff
        if (tokenRecord.staff.status !== "ACTIVE") {
            throw new UnauthorizedException("Tài khoản đã bị tạm ngừng hoặc vô hiệu hóa.");
        }

        // Kiểm tra khóa tạm thời (nếu có)
        if (tokenRecord.staff.lockedUntil !== null && tokenRecord.staff.lockedUntil > now) {
            throw new UnauthorizedException("Tài khoản đang bị tạm khóa. Vui lòng thử lại sau.");
        }

        const refreshTtlDays = this.configService.getOrThrow<number>("REFRESH_TTL_DAYS");
        const newExpiresAt = new Date(now.getTime() + refreshTtlDays * MILLISECONDS_PER_DAY);

        // Sinh Refresh Token mới (32 bytes ngẫu nhiên, base64url)
        const newRefreshToken = randomBytes(32).toString("base64url");
        const newRefreshTokenHash = createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        // Giao dịch xoay vòng token nguyên tử (Atomic Token Rotation)
        const outcome = await this.prisma.$transaction(async (tx) => {
            // 1. Tạo Refresh Token mới trong cùng familyId
            const createdToken = await tx.refreshToken.create({
                data: {
                    staffId: tokenRecord.staff.id,
                    familyId: tokenRecord.familyId,
                    tokenHash: newRefreshTokenHash,
                    expiresAt: newExpiresAt,
                    userAgent: context.userAgent?.slice(0, 512) ?? null,
                    ip: context.ip,
                },
            });

            // 2. Thu hồi token cũ và trỏ replacedById sang token mới
            await tx.refreshToken.update({
                where: { id: tokenRecord.id },
                data: {
                    revokedAt: now,
                    replacedById: createdToken.id,
                },
            });

            // 3. Ký Access Token mới tương ứng với tokenVersion hiện tại của staff
            const tokenResult = this.jwtTokenService.GenerateToken({
                id: tokenRecord.staff.id,
                email: tokenRecord.staff.email,
                fullName: tokenRecord.staff.fullName,
                role: tokenRecord.staff.role,
                tokenVersion: tokenRecord.staff.tokenVersion,
            });

            const response: LoginResponseDto = {
                accessToken: tokenResult.accessToken,
                staff: {
                    id: tokenRecord.staff.id,
                    email: tokenRecord.staff.email,
                    fullName: tokenRecord.staff.fullName,
                    role: tokenRecord.staff.role as StaffRole,
                    mustChangePassword: tokenRecord.staff.mustChangePassword,
                    phoneNumber: tokenRecord.staff.phoneNumber,
                    ownerId:
                        tokenRecord.staff.ownerId ||
                        (tokenRecord.staff.role === "OWNER" ? tokenRecord.staff.id : null),
                },
            };

            return {
                response,
                refreshToken: newRefreshToken,
                refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
            };
        });

        await this.auditService.recordEvent({
            action: AuditAction.LOGIN_SUCCESS,
            staffId: outcome.response.staff.id,
            ip: context.ip,
            userAgent: context.userAgent,
            metadata: {
                reason: "TOKEN_REFRESH",
                familyId: tokenRecord.familyId,
            },
        });

        return outcome;
    }

    /**
     * Thu hồi một Refresh Token cụ thể (khi người dùng đăng xuất).
     */
    async revoke(rawRefreshToken: string): Promise<void> {
        if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
            return;
        }

        const tokenHash = createHash("sha256")
            .update(rawRefreshToken.trim())
            .digest("hex");

        await this.prisma.refreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    /**
     * Thu hồi toàn bộ phiên và tăng tokenVersion của staff (đăng xuất khỏi tất cả thiết bị).
     */
    async revokeAllForStaff(staffId: string): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
                where: { staffId, revokedAt: null },
                data: { revokedAt: new Date() },
            });

            await tx.staff.update({
                where: { id: staffId },
                data: { tokenVersion: { increment: 1 } },
            });
        });
    }
}
