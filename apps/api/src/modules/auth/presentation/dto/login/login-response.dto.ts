export type LoginResponseDto = {
    accessToken: string;
    user: {
        id: string;
        email: string;
        fullName: string;
        mustChangePassword: boolean;
        phoneNumber?: string | null;
    };
    staff?: {
        id: string;
        email: string;
        fullName: string;
        mustChangePassword: boolean;
        phoneNumber?: string | null;
    };
};

export type AuthLoginResult = {
    response: LoginResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};