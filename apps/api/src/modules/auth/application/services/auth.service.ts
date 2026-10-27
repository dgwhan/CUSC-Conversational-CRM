import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
    ConflictException,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, Prisma } from "@prisma/client";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
import { AuditService } from "../../../audit/audit.service.js";
import type { AuthUser } from "../../domain/types/auth-user.js";
import type { StaffRole } from "../../../../contracts/iam.js";
import { AUTH_VALIDATION } from "../../presentation/dto/auth.constants.js";
import type { RegisterRequestDto } from "../../presentation/dto/register/register-request.dto.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_SERIALIZATION_RETRIES = 3;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;

export type LoginRequestContext = {
    ip: string;
    userAgent?: string;
};

export type AuthLoginResult = {
    response: {
        accessToken: string;
        staff: AuthUser & {
            email: string;
            fullName: string;
            mustChangePassword: boolean;
            phoneNumber?: string | null;
            ownerId?: string | null;
        };
    };
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};

export type AuthRegisterResult = {
    response: {
        accessToken: string;
        staff: {
            id: string;
            email: string;
            fullName: string;
            phoneNumber?: string | null;
            role: StaffRole;
            ownerId?: string | null;
        };
    };
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtTokenService: JwtTokenService,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
    ) {}

    async login(
        input: {
            identifier?: string;
            email?: string;
            phoneNumber?: string;
            password: string;
        },
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
                        const staff = await tx.staff.findFirst({
                            where: {
                                OR: [
                                    { email: normalizedEmail },
                                    { phoneNumber: normalizedIdentifier },
                                ],
                            },
                        });

                        if (!staff) {
                            return { kind: "denied", reason: "USER_NOT_FOUND", staffId: null } as const;
                        }

                        if (staff.status !== "ACTIVE") {
                            return { kind: "denied", reason: "ACCOUNT_LOCKED", staffId: staff.id } as const;
                        }

                        const now = new Date();
                        const temporaryLockActive =
                            staff.lockedUntil !== null && staff.lockedUntil > now;

                        // A correct password must not bypass an active temporary lock
                        if (temporaryLockActive) {
                            return { kind: "denied", reason: "ACCOUNT_LOCKED", staffId: staff.id } as const;
                        }

                        const expiredTemporaryLock =
                            staff.lockedUntil !== null && staff.lockedUntil <= now;
                        const failedAttemptsBeforeLogin = expiredTemporaryLock
                            ? 0
                            : staff.failedLoginAttempts;

                        // Expired temporary locks start a new consecutive-attempt window
                        if (expiredTemporaryLock) {
                            await tx.staff.update({
                                where: { id: staff.id },
                                data: {
                                    failedLoginAttempts: 0,
                                    lockedUntil: null,
                                    status: "ACTIVE",
                                },
                            });
                        }

                        const usesLegacyBcrypt = staff.passwordHash.startsWith("$2");
                        const passwordIsValid = usesLegacyBcrypt
                            ? await bcrypt.compare(input.password, staff.passwordHash)
                            : await argon2.verify(staff.passwordHash, input.password);

                        if (!passwordIsValid) {
                            const failedLoginAttempts = failedAttemptsBeforeLogin + 1;
                            const shouldLock =
                                failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

                            await tx.staff.update({
                                where: { id: staff.id },
                                data: {
                                    failedLoginAttempts,
                                    lockedUntil: shouldLock
                                        ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
                                        : null,
                                },
                            });

                            return { kind: "denied", reason: "INVALID_PASSWORD", staffId: staff.id } as const;
                        }

                        // Upgrade a legacy bcrypt hash after the password is verified
                        const upgradedPasswordHash = usesLegacyBcrypt
                            ? await argon2.hash(input.password)
                            : undefined;

                        await tx.staff.update({
                            where: { id: staff.id },
                            data: {
                                ...(upgradedPasswordHash
                                    ? { passwordHash: upgradedPasswordHash }
                                    : {}),
                                failedLoginAttempts: 0,
                                lockedUntil: null,
                            },
                        });

                        const tokenResult = this.jwtTokenService.GenerateToken({
                            id: staff.id,
                            email: staff.email,
                            fullName: staff.fullName,
                            role: staff.role,
                            tokenVersion: staff.tokenVersion,
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
                                staffId: staff.id,
                                familyId: randomUUID(),
                                tokenHash: refreshTokenHash,
                                expiresAt: refreshTokenExpiresAt,
                                userAgent: context.userAgent?.slice(0, 512) ?? null,
                                ip: context.ip,
                            },
                        });

                        const response = {
                            accessToken: tokenResult.accessToken,
                            staff: {
                                id: staff.id,
                                email: staff.email,
                                fullName: staff.fullName,
                                role: staff.role as StaffRole,
                                mustChangePassword: staff.mustChangePassword,
                                phoneNumber: staff.phoneNumber,
                                ownerId: staff.ownerId || (staff.role === 'OWNER' ? staff.id : null),
                            },
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
                        staffId: outcome.staffId,
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
                    staffId: outcome.response.staff.id,
                    ip: context.ip,
                    userAgent: context.userAgent,
                    metadata: {
                        identifier: normalizedIdentifier,
                        role: outcome.response.staff.role,
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

        const passwordHash = await argon2.hash(input.password);
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

                if (resolvedOwnerId) {
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
                        }).catch(() => {});
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
                    ownerId: outcome.staff.ownerId || null,
                },
            },
            refreshToken: outcome.refreshToken,
            refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
        };
    }
}
