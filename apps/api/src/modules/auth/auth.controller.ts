import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Ip,
    Post,
    Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost } from "@nestjs/core";
import { AuthService } from "./auth.service.js";
import { loginRequestSchema } from "./dto/login-request.dto.js";
import type { LoginRequestDto } from "./dto/login-request.dto.js";
import type { LoginResponseDto } from "./dto/login-response.dto.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly httpAdapterHost: HttpAdapterHost,
        private readonly configService: ConfigService,
    ) {}

    @Post("login")
    @HttpCode(HttpStatus.OK)
    async login(
        @Body(new ZodValidationPipe(loginRequestSchema))
        input: LoginRequestDto,
        @Ip() ip: string,
        @Headers("user-agent") userAgent: string | undefined,
        @Res({ passthrough: true }) response: unknown,
    ): Promise<LoginResponseDto> {
        const result = await this.authService.login(input, { ip, userAgent });

        //Nest's HTTP adapter serializes the cookie for the configured platform
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
}
