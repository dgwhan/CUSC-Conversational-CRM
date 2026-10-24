import type { StaffRole } from "@prisma/client";

export type LoginResponseDto = {
    accessToken: string;
    staff: {
        id: string;
        email: string;
        fullName: string;
        role: StaffRole;
        mustChangePassword: boolean;
    };
};