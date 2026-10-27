import type { StaffRole } from '../../../../../contracts/iam.js';

export type LoginResponseDto = {
    accessToken: string;
    staff: {
        id: string;
        email: string;
        fullName: string;
        role: StaffRole;
        mustChangePassword: boolean;
        ownerId?: string | null;
        phoneNumber?: string | null;
    };
};