import { Injectable } from "@nestjs/common";
import { LoginService, type AuthLoginResult, type LoginRequestContext } from "./login.service.js";
import { RegisterService, type AuthRegisterResult } from "./register.service.js";
import type { LoginRequestDto } from "../../presentation/dto/login/login-request.dto.js";
import type { RegisterRequestDto } from "../../presentation/dto/register/register-request.dto.js";

export * from "./login.service.js";
export * from "./register.service.js";
export * from "./password.service.js";
export * from "./refresh-token.service.js";

@Injectable()
export class AuthService {
    constructor(
        private readonly loginService: LoginService,
        private readonly registerService: RegisterService,
    ) {}

    async login(
        input: LoginRequestDto,
        context: LoginRequestContext,
    ): Promise<AuthLoginResult> {
        return this.loginService.login(input, context);
    }

    async register(
        input: RegisterRequestDto,
        context: LoginRequestContext,
    ): Promise<AuthRegisterResult> {
        return this.registerService.register(input, context);
    }
}
