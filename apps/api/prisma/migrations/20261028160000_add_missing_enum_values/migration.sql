-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'OWNER';

-- AlterEnum
ALTER TYPE "workspace_member_role" ADD VALUE IF NOT EXISTS 'STAFF';
