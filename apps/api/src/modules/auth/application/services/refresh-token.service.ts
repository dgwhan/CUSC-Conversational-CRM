import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
import { AuditService } from "../../../audit/audit.service.js";
import type { LoginResponseDto } from "../../presentation/dto/login/login-response.dto.js";
import type { LoginRequestContext } from "../../presentation/dto/login/login-request.dto.js";
import { MILLISECONDS_PER_DAY, SECONDS_PER_DAY } from "../../presentation/dto/auth.constants.js";

export type AuthRefreshResult = {
    response: LoginResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
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
     * Thực hiện xoay vòng Refresh Token (Refresh Token Rotation) an toàn.
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
            include: { user: true },
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
                userId: tokenRecord.userId,
                ip: context.ip,
                userAgent: context.userAgent,
                metadata: {
                    reason: "REFRESH_TOKEN_REUSE_DETECTED",
                    familyId: tokenRecord.familyId,
                    userId: tokenRecord.userId,
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

        // Kiểm tra trạng thái tài khoản User
        if (tokenRecord.user.status !== "ACTIVE") {
            throw new UnauthorizedException("Tài khoản đã bị tạm ngừng hoặc vô hiệu hóa.");
        }

        // Kiểm tra khóa tạm thời (nếu có)
        if (tokenRecord.user.lockedUntil !== null && tokenRecord.user.lockedUntil > now) {
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
                    userId: tokenRecord.user.id,
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

            // 3. Ký Access Token mới tương ứng với tokenVersion hiện tại của user
            const tokenResult = this.jwtTokenService.GenerateToken({
                id: tokenRecord.user.id,
                email: tokenRecord.user.email,
                fullName: tokenRecord.user.fullName,
                tokenVersion: tokenRecord.user.tokenVersion,
            });

            const userProfile = {
                id: tokenRecord.user.id,
                email: tokenRecord.user.email,
                fullName: tokenRecord.user.fullName,
                mustChangePassword: tokenRecord.user.mustChangePassword,
                phoneNumber: tokenRecord.user.phoneNumber,
            };

            const response: LoginResponseDto = {
                accessToken: tokenResult.accessToken,
                user: userProfile,
                staff: userProfile,
            };

            return {
                response,
                refreshToken: newRefreshToken,
                refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
            };
        });

        await this.auditService.recordEvent({
            action: AuditAction.LOGIN_SUCCESS,
            userId: outcome.response.user.id,
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
     * Thu hồi toàn bộ phiên và tăng tokenVersion của user (đăng xuất khỏi tất cả thiết bị).
     */
    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });

            await tx.user.update({
                where: { id: userId },
                data: { tokenVersion: { increment: 1 } },
            });
        });
    }

    /**
     * Tương thích ngược: Alias cho revokeAllForUser.
     */
    async revokeAllForStaff(staffId: string): Promise<void> {
        return this.revokeAllForUser(staffId);
    }
}
