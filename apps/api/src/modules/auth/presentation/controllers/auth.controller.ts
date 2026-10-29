import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Ip,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost } from "@nestjs/core";
import { LoginService } from "../../application/services/login.service.js";
import { RegisterService } from "../../application/services/register.service.js";
import { RefreshTokenService } from "../../application/services/refresh-token.service.js";
import { JwtAuthGuard } from "../guards/jwt-auth.guard.js";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { loginRequestSchema } from "../dto/login/login-request.dto.js";
import type { LoginRequestDto } from "../dto/login/login-request.dto.js";
import type { LoginResponseDto } from "../dto/login/login-response.dto.js";
import { registerRequestSchema } from "../dto/register/register-request.dto.js";
import type { RegisterRequestDto } from "../dto/register/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register/register-response.dto.js";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import type { AuthUser } from "../../domain/types/auth-user.js";
import type { StaffRole } from "../../../../contracts/iam.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

function extractRefreshToken(cookieHeader?: string, bodyToken?: string): string | null {
    if (bodyToken && typeof bodyToken === "string" && bodyToken.trim()) {
        return bodyToken.trim();
    }
    if (!cookieHeader) return null;
    const match = /(?:^|;\s*)refresh_token=([^;]+)/.exec(cookieHeader);
    return match ? decodeURIComponent(match[1]) : null;
}

@Controller("auth")
export class AuthController {
    constructor(
        private readonly loginService: LoginService,
        private readonly registerService: RegisterService,
        private readonly refreshTokenService: RefreshTokenService,
        private readonly prisma: PrismaService,
        private readonly httpAdapterHost: HttpAdapterHost,
        private readonly configService: ConfigService,
    ) { }

    @Post("login")
    @HttpCode(HttpStatus.OK)
    async login(
        @Body(new ZodValidationPipe(loginRequestSchema))
        input: LoginRequestDto,
        @Ip() ip: string,
        @Headers("user-agent") userAgent: string | undefined,
        @Res({ passthrough: true }) response: unknown,
    ): Promise<LoginResponseDto> {
        const result = await this.loginService.login(input, { ip, userAgent });

        // Nest's HTTP adapter serializes the cookie for the configured platform
        this.httpAdapterHost.httpAdapter.setCookie(
            response,
            REFRESH_COOKIE_NAME,
            result.refreshToken,
            {
                httpOnly: true,
                secure: this.configService.getOrThrow<string>("NODE_ENV") === "production",
                sameSite: "lax",
                path: REFRESH_COOKIE_PATH,
                maxAge: result.refreshTokenMaxAgeSeconds,
            },
        );

        return result.response;
    }

    @Post("register")
    @HttpCode(HttpStatus.CREATED)
    async register(
        @Body(new ZodValidationPipe(registerRequestSchema))
        input: RegisterRequestDto,
        @Ip() ip: string,
        @Headers("user-agent") userAgent: string | undefined,
        @Res({ passthrough: true }) response: unknown,
    ): Promise<RegisterResponseDto> {
        const result = await this.registerService.register(input, { ip, userAgent });

        this.httpAdapterHost.httpAdapter.setCookie(
            response,
            REFRESH_COOKIE_NAME,
            result.refreshToken,
            {
                httpOnly: true,
                secure: this.configService.getOrThrow<string>("NODE_ENV") === "production",
                sameSite: "lax",
                path: REFRESH_COOKIE_PATH,
                maxAge: result.refreshTokenMaxAgeSeconds,
            },
        );

        return result.response;
    }

    /**
     * Endpoint làm mới Access Token một cách minh bạch (Transparent Access Token Refresh).
     * Nhận Refresh Token qua HttpOnly Cookie hoặc JSON Body { refreshToken }.
     */
    @Post("refresh")
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Headers("cookie") cookieHeader: string | undefined,
        @Body("refreshToken") bodyToken: string | undefined,
        @Ip() ip: string,
        @Headers("user-agent") userAgent: string | undefined,
        @Res({ passthrough: true }) response: unknown,
    ): Promise<LoginResponseDto & { refreshToken: string }> {
        const token = extractRefreshToken(cookieHeader, bodyToken);
        if (!token) {
            throw new UnauthorizedException("Không tìm thấy Refresh Token hợp lệ.");
        }

        const result = await this.refreshTokenService.refresh(token, { ip, userAgent });

        this.httpAdapterHost.httpAdapter.setCookie(
            response,
            REFRESH_COOKIE_NAME,
            result.refreshToken,
            {
                httpOnly: true,
                secure: this.configService.getOrThrow<string>("NODE_ENV") === "production",
                sameSite: "lax",
                path: REFRESH_COOKIE_PATH,
                maxAge: result.refreshTokenMaxAgeSeconds,
            },
        );

        return {
            ...result.response,
            refreshToken: result.refreshToken,
        };
    }

    /**
     * Đăng xuất an toàn: Thu hồi Refresh Token trong DB và xóa Cookie.
     */
    @Post("logout")
    @HttpCode(HttpStatus.OK)
    async logout(
        @Headers("cookie") cookieHeader: string | undefined,
        @Body("refreshToken") bodyToken: string | undefined,
        @Res({ passthrough: true }) response: unknown,
    ): Promise<{ success: boolean; message: string }> {
        const token = extractRefreshToken(cookieHeader, bodyToken);
        if (token) {
            await this.refreshTokenService.revoke(token);
        }

        this.httpAdapterHost.httpAdapter.setCookie(
            response,
            REFRESH_COOKIE_NAME,
            "",
            {
                httpOnly: true,
                secure: this.configService.getOrThrow<string>("NODE_ENV") === "production",
                sameSite: "lax",
                path: REFRESH_COOKIE_PATH,
                maxAge: 0,
            },
        );

        return { success: true, message: "Đăng xuất thành công." };
    }

    /**
     * Lấy thông tin tài khoản hiện tại từ Access Token đã xác thực.
     */
    @Get("me")
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async me(
        @Req() req: { user?: AuthUser },
    ): Promise<LoginResponseDto["staff"]> {
        if (!req.user?.id) {
            throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
        }

        const staff = await this.prisma.staff.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                status: true,
                mustChangePassword: true,
                phoneNumber: true,
                ownerId: true,
            },
        });

        if (!staff || staff.status !== "ACTIVE") {
            throw new UnauthorizedException("Tài khoản không tồn tại hoặc đã bị khóa.");
        }

        return {
            id: staff.id,
            email: staff.email,
            fullName: staff.fullName,
            role: staff.role as StaffRole,
            mustChangePassword: staff.mustChangePassword,
            phoneNumber: staff.phoneNumber,
            ownerId: staff.ownerId || (staff.role === "OWNER" ? staff.id : null),
        };
    }
}
