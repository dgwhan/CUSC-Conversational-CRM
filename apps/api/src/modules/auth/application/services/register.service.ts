import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PasswordService } from "./password.service.js";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { JwtTokenService } from "../../../../platform/config/jwt.config.js";
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
        const existingByEmail = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingByEmail) {
            throw new ConflictException(AUTH_VALIDATION.MESSAGES.EMAIL_EXISTS);
        }

        // Check duplicate phone number if provided
        if (normalizedPhone) {
            const existingByPhone = await this.prisma.user.findUnique({
                where: { phoneNumber: normalizedPhone },
            });
            if (existingByPhone) {
                throw new ConflictException(AUTH_VALIDATION.MESSAGES.PHONE_EXISTS);
            }
        }

        const passwordHash = await this.passwordService.hash(input.password);

        const outcome = await this.prisma.$transaction(
            async (tx) => {
                const createdUser = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        passwordHash,
                        fullName: input.fullName.trim(),
                        phoneNumber: normalizedPhone,
                        status: "ACTIVE",
                        mustChangePassword: false,
                    },
                });

                const tokenResult = this.jwtTokenService.GenerateToken({
                    id: createdUser.id,
                    email: createdUser.email,
                    fullName: createdUser.fullName,
                    tokenVersion: createdUser.tokenVersion,
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
                        userId: createdUser.id,
                        familyId: randomUUID(),
                        tokenHash: refreshTokenHash,
                        expiresAt: refreshTokenExpiresAt,
                        userAgent: context.userAgent?.slice(0, 512) ?? null,
                        ip: context.ip,
                    },
                });

                return {
                    user: createdUser,
                    accessToken: tokenResult.accessToken,
                    refreshToken,
                };
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        );

        const userProfile = {
            id: outcome.user.id,
            email: outcome.user.email,
            fullName: outcome.user.fullName,
            phoneNumber: outcome.user.phoneNumber,
        };

        return {
            response: {
                accessToken: outcome.accessToken,
                user: userProfile,
                staff: userProfile,
            },
            refreshToken: outcome.refreshToken,
            refreshTokenMaxAgeSeconds: refreshTtlDays * SECONDS_PER_DAY,
        };
    }
}
