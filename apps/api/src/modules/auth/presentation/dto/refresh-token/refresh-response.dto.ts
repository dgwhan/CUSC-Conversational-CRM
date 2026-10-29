import type { LoginResponseDto } from '../login/login-response.dto.js';

export type AuthRefreshResult = {
    response: LoginResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};
