import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PasswordService } from "./password.service.js";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
import type { StaffRole } from "../../../../contracts/iam.js";
import { AUTH_VALIDATION, MILLISECONDS_PER_DAY, SECONDS_PER_DAY } from "../../presentation/dto/auth.constants.js";
import type { RegisterRequestDto } from "../../presentation/dto/register/register-request.dto.js";
import type { RegisterResponseDto, AuthRegisterResult } from "../../presentation/dto/register/register-response.dto.js";
import type { LoginRequestContext } from "../../presentation/dto/login/login-request.dto.js";

export type { AuthRegisterResult };

@Injectable()
export class RegisterService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtTokenService: JwtTokenService,
        private readonly configService: ConfigService,
        private readonly passwordService: PasswordService,
    ) { }

    async register(
        input: RegisterRequestDto,
        context: LoginRequestContext,
    ): Promise<AuthRegisterResult> {
        const normalizedEmail = input.email.trim().toLowerCase();
        const normalizedPhone = input.phoneNumber?.trim() || null;
        const refreshTtlDays = this.configService.getOrThrow<number>("REFRESH_TTL_DAYS");

        // Check duplicate email
        const existingByEmail = await this.prisma.staff.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingByEmail) {
            throw new ConflictException(AUTH_VALIDATION.MESSAGES.EMAIL_EXISTS);
        }

        // Check duplicate phone number if provided
        if (normalizedPhone) {
            const existingByPhone = await this.prisma.staff.findUnique({
                where: { phoneNumber: normalizedPhone },
            });
            if (existingByPhone) {
                throw new ConflictException(AUTH_VALIDATION.MESSAGES.PHONE_EXISTS);
            }
        }

        const passwordHash = await this.passwordService.hash(input.password);
        const assignedRole: StaffRole = input.role ?? AUTH_VALIDATION.DEFAULT_ROLE;

        const outcome = await this.prisma.$transaction(
            async (tx) => {
                let resolvedOwnerId: string | null = null;
                if (assignedRole === "STAFF") {
                    const defaultOwner = await tx.staff.findFirst({
                        where: { role: "OWNER" },
                        orderBy: { createdAt: "asc" },
                    });
                    if (defaultOwner) {
                        resolvedOwnerId = defaultOwner.id;
                    }
                }

                const createdStaff = await tx.staff.create({
                    data: {
                        email: normalizedEmail,
                        passwordHash,
                        fullName: input.fullName.trim(),
                        phoneNumber: normalizedPhone,
                        role: assignedRole,
                        status: "ACTIVE",
                        mustChangePassword: false,
                        ownerId: resolvedOwnerId,
                    },
                });

                if (assignedRole === "OWNER") {
                    const cleanSlug = `ws-${createdStaff.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}-${Date.now().toString(36)}`;
                    const ownerWs = await tx.workspace.create({
                        data: {
                            name: `Workspace của ${createdStaff.fullName}`,
                            slug: cleanSlug,
                            ownerId: createdStaff.id,
                            isActive: true,
                        },
                    });

                    await tx.workspaceMember.create({
                        data: {
                            workspaceId: ownerWs.id,
                            staffId: createdStaff.id,
                            role: "OWNER",
                        },
                    }).catch(() => { });
                } else if (resolvedOwnerId) {
                    const ownerWs = await tx.workspace.findFirst({
                        where: { ownerId: resolvedOwnerId },
                    });
                    if (ownerWs) {
                        await tx.workspaceMember.create({
                            data: {
                                workspaceId: ownerWs.id,
                                staffId: createdStaff.id,
                                role: "STAFF",
                            },
                        }).catch(() => { });
                    }
                }

                const tokenResult = this.jwtTokenService.GenerateToken({
                    id: createdStaff.id,
                    email: createdStaff.email,
                    fullName: createdStaff.fullName,
                    role: createdStaff.role,
                    tokenVersion: createdStaff.tokenVersion,
                });

                const now = new Date();
                const refreshToken = randomBytes(32).toString("base64url");
                const refreshTokenHash = createHash("sha256")
                    .update(refreshToken)
                    .digest("hex");
                const refreshTokenExpiresAt = new Date(
                    now.getTime() + refreshTtlDays * MILLISECONDS_PER_DAY,
                );

                await tx.refreshToken.create({
                    data: {
                        staffId: createdStaff.id,
                        familyId: randomUUID(),
                        tokenHash: refreshTokenHash,
                        expiresAt: refreshTokenExpiresAt,
                        userAgent: context.userAgent?.slice(0, 512) ?? null,
                        ip: context.ip,
                    },
                });

                return {
                    staff: createdStaff,
                    accessToken: tokenResult.accessToken,
                    refreshToken,
                };
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        );

        return {
            response: {
                accessToken: outcome.accessToken,
                staff: {
                    id: outcome.staff.id,
                    email: outcome.staff.email,
                    fullName: outcome.staff.fullName,
                    phoneNumber: outcome.staff.phoneNumber,
                    role: outcome.staff.role as StaffRole,
                    ownerId: outcome.staff.ownerId || (outcome.staff.role === "OWNER" ? outcome.staff.id : null),
                },
            },
            refreshToken: outcome.refreshToken,
            refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
        };
    }
}
