import type { StaffRole } from '../../../../../contracts/iam.js';

export type RegisterResponseDto = {
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

export type AuthRegisterResult = {
    response: RegisterResponseDto;
    refreshToken: string;
    refreshTokenMaxAgeSeconds: number;
};

