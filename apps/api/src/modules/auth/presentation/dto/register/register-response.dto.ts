export type RegisterResponseDto = {
    accessToken: string;
    user: {
        id: string;
        email: string;
        fullName: string;
        phoneNumber?: string | null;
    };
    staff?: {
        id: string;
        email: string;
        fullName: string;
        phoneNumber?: string | null;
    };
};

export type AuthRegisterResult = {
    response: RegisterResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};
