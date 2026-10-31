import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
import { AuditService } from "../../../audit/audit.service.js";
import { PasswordService } from "./password.service.js";
import type { LoginRequestDto, LoginRequestContext } from "../../presentation/dto/login/login-request.dto.js";
import type { LoginResponseDto, AuthLoginResult } from "../../presentation/dto/login/login-response.dto.js";
import { AUTH_VALIDATION, LOGIN_LOCK_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS, MAX_SERIALIZATION_RETRIES, MILLISECONDS_PER_DAY, SECONDS_PER_DAY } from "../../presentation/dto/auth.constants.js";

export type { LoginRequestContext, AuthLoginResult };

@Injectable()
export class LoginService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtTokenService: JwtTokenService,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
        private readonly passwordService: PasswordService,
    ) { }

    async login(
        input: LoginRequestDto,
        context: LoginRequestContext,
    ): Promise<AuthLoginResult> {
        const rawIdentifier = input.identifier || input.email || input.phoneNumber || "";
        const normalizedIdentifier = rawIdentifier.trim();
        const normalizedEmail = normalizedIdentifier.toLowerCase();
        const refreshTtlDays = this.configService.getOrThrow<number>("REFRESH_TTL_DAYS");

        // Serializable transactions may conflict with concurrent logins, so retry them a few times
        for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt += 1) {
            try {
                const outcome = await this.prisma.$transaction(
                    async (tx) => {
                        const user = await tx.user.findFirst({
                            where: {
                                OR: [
                                    { email: normalizedEmail },
                                    { phoneNumber: normalizedIdentifier },
                                ],
                            },
                        });

                        if (!user) {
                            return { kind: "denied", reason: "USER_NOT_FOUND", userId: null } as const;
                        }

                        if (user.status !== "ACTIVE") {
                            return { kind: "denied", reason: "ACCOUNT_LOCKED", userId: user.id } as const;
                        }

                        const now = new Date();
                        const temporaryLockActive =
                            user.lockedUntil !== null && user.lockedUntil > now;

                        // A correct password must not bypass an active temporary lock
                        if (temporaryLockActive) {
                            return { kind: "denied", reason: "ACCOUNT_LOCKED", userId: user.id } as const;
                        }

                        const expiredTemporaryLock =
                            user.lockedUntil !== null && user.lockedUntil <= now;
                        const failedAttemptsBeforeLogin = expiredTemporaryLock
                            ? 0
                            : user.failedLoginAttempts;

                        // Expired temporary locks start a new consecutive-attempt window
                        if (expiredTemporaryLock) {
                            await tx.user.update({
                                where: { id: user.id },
                                data: {
                                    failedLoginAttempts: 0,
                                    lockedUntil: null,
                                    status: "ACTIVE",
                                },
                            });
                        }

                        const { isValid: passwordIsValid, upgradedHash: upgradedPasswordHash } =
                            await this.passwordService.verifyAndUpgrade(input.password, user.passwordHash);

                        if (!passwordIsValid) {
                            const failedLoginAttempts = failedAttemptsBeforeLogin + 1;
                            const shouldLock =
                                failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

                            await tx.user.update({
                                where: { id: user.id },
                                data: {
                                    failedLoginAttempts,
                                    lockedUntil: shouldLock
                                        ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
                                        : null,
                                },
                            });

                            return { kind: "denied", reason: "INVALID_PASSWORD", userId: user.id } as const;
                        }

                        await tx.user.update({
                            where: { id: user.id },
                            data: {
                                ...(upgradedPasswordHash
                                    ? { passwordHash: upgradedPasswordHash }
                                    : {}),
                                failedLoginAttempts: 0,
                                lockedUntil: null,
                            },
                        });

                        const tokenResult = this.jwtTokenService.GenerateToken({
                            id: user.id,
                            email: user.email,
                            fullName: user.fullName,
                            tokenVersion: user.tokenVersion,
                        });

                        // Store only a digest; the random refresh token is sent in an HttpOnly cookie
                        const refreshToken = randomBytes(32).toString("base64url");
                        const refreshTokenHash = createHash("sha256")
                            .update(refreshToken)
                            .digest("hex");
                        const refreshTokenExpiresAt = new Date(
                            now.getTime() + refreshTtlDays * MILLISECONDS_PER_DAY,
                        );

                        await tx.refreshToken.create({
                            data: {
                                userId: user.id,
                                familyId: randomUUID(),
                                tokenHash: refreshTokenHash,
                                expiresAt: refreshTokenExpiresAt,
                                userAgent: context.userAgent?.slice(0, 512) ?? null,
                                ip: context.ip,
                            },
                        });

                        const userProfile = {
                            id: user.id,
                            email: user.email,
                            fullName: user.fullName,
                            mustChangePassword: user.mustChangePassword,
                            phoneNumber: user.phoneNumber,
                        };

                        const response: LoginResponseDto = {
                            accessToken: tokenResult.accessToken,
                            user: userProfile,
                            staff: userProfile,
                        };

                        return {
                            kind: "success",
                            response,
                            refreshToken,
                            refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
                        } as const;
                    },
                    {
                        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                    },
                );

                if (outcome.kind === "denied") {
                    await this.auditService.recordEvent({
                        action: AuditAction.LOGIN_FAILURE,
                        userId: outcome.userId,
                        ip: context.ip,
                        userAgent: context.userAgent,
                        metadata: {
                            identifier: normalizedIdentifier,
                            reason: outcome.reason,
                        },
                    });

                    throw new UnauthorizedException(AUTH_VALIDATION.MESSAGES.INVALID_CREDENTIALS);
                }

                await this.auditService.recordEvent({
                    action: AuditAction.LOGIN_SUCCESS,
                    userId: outcome.response.user.id,
                    ip: context.ip,
                    userAgent: context.userAgent,
                    metadata: {
                        identifier: normalizedIdentifier,
                    },
                });

                return {
                    response: outcome.response,
                    refreshToken: outcome.refreshToken,
                    refreshTokenMaxAgeSeconds: outcome.refreshTokenMaxAgeSeconds,
                };
            } catch (error: unknown) {
                const isSerializationConflict =
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2034";

                if (!isSerializationConflict) {
                    throw error;
                }

                if (attempt === MAX_SERIALIZATION_RETRIES) {
                    throw new ServiceUnavailableException(
                        "Login is temporarily unavailable. Please try again.",
                    );
                }
            }
        }

        throw new ServiceUnavailableException(
            "Login is temporarily unavailable. Please try again.",
        );
    }
}
