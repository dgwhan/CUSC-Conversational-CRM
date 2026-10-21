import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../platform/database/prisma.service.js";
import type { LoginRequestDto } from "./dto/login-request.dto.js";
import type { LoginResponseDto } from "./dto/login-response.dto.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_SERIALIZATION_RETRIES = 3;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export type LoginRequestContext = {
    ip: string;
    userAgent?: string;
};

export type AuthLoginResult = {
    response: LoginResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async login(
        input: LoginRequestDto,
        context: LoginRequestContext,
    ): Promise<AuthLoginResult> {
        const normalizedEmail = input.email.trim().toLowerCase();
        const accessTokenTtl = this.configService.getOrThrow<JwtSignOptions["expiresIn"]>(
            "JWT_ACCESS_TTL",
        );
        const refreshTtlDays = this.configService.getOrThrow<number>("REFRESH_TTL_DAYS");

        //serializable transactions may conflict with concurrent logins, so retry them a few times
        for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt += 1) {
            try {
                const outcome = await this.prisma.$transaction(
                    async (tx) => {
                        const staff = await tx.staff.findUnique({
                            where: { email: normalizedEmail },
                        });

                        if (!staff || staff.status !== "ACTIVE") {
                            return { kind: "denied" } as const;
                        }

                        const now = new Date();
                        const temporaryLockActive =
                            staff.lockedUntil !== null && staff.lockedUntil > now;

                        //a correct password must not bypass an active temporary lock
                        if (temporaryLockActive) {
                            return { kind: "denied" } as const;
                        }

                        const expiredTemporaryLock =
                            staff.lockedUntil !== null && staff.lockedUntil <= now;
                        const failedAttemptsBeforeLogin = expiredTemporaryLock
                            ? 0
                            : staff.failedLoginAttempts;

                        //expired temporary locks start a new consecutive-attempt window
                        if (expiredTemporaryLock) {
                            await tx.staff.update({
                                where: { id: staff.id },
                                data: {
                                    failedLoginAttempts: 0,
                                    lockedUntil: null,
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

                            return { kind: "denied" } as const;
                        }

                        //upgrade a legacy bcrypt hash after the password is verified
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

                        const accessToken = await this.jwtService.signAsync(
                            {
                                sub: staff.id,
                                role: staff.role,
                                tokenVersion: staff.tokenVersion,
                            },
                            { expiresIn: accessTokenTtl },
                        );

                        //store only a digest
                        //the random refresh token is sent in an HttpOnly cookie
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

                        const response: LoginResponseDto = {
                            accessToken,
                            staff: {
                                id: staff.id,
                                email: staff.email,
                                fullName: staff.fullName,
                                role: staff.role,
                                mustChangePassword: staff.mustChangePassword,
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
                    throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
                }

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
