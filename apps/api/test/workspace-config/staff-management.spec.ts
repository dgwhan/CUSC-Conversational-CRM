import { describe, it, expect, beforeEach } from 'vitest';
import { StaffManagementService } from '../../src/modules/workspace-config/staff-management.service.js';

describe('StaffManagementService (Owner-Staff Relationship & RBAC Management)', () => {
  let service: StaffManagementService;

  beforeEach(() => {
    service = new StaffManagementService();
  });

  it('should allow Owner to create staff belonging to ownerId', async () => {
    const ownerId = 'c0000000-0000-0000-0000-000000000001';
    const newStaff = await service.createStaff(ownerId, {
      email: 'tuvan1@cusc.com',
      fullName: 'Trần Văn Tư Vấn',
      password: 'Password123!',
      role: 'STAFF',
    });

    expect(newStaff.email).toBe('tuvan1@cusc.com');
    expect(newStaff.fullName).toBe('Trần Văn Tư Vấn');
    expect(newStaff.status).toBe('ACTIVE');
    expect(newStaff.ownerId).toBe(ownerId);
  });

  it('should list all staff belonging to the owner', async () => {
    const ownerId = 'c0000000-0000-0000-0000-000000000002';
    await service.createStaff(ownerId, {
      email: 'staffA@cusc.com',
      fullName: 'Nhân viên A',
    });
    await service.createStaff(ownerId, {
      email: 'staffB@cusc.com',
      fullName: 'Nhân viên B',
    });

    const list = await service.getStaffList(ownerId);
    expect(list.length).toBe(2);
    expect(list.some((s) => s.email === 'staffa@cusc.com')).toBe(true);
    expect(list.some((s) => s.email === 'staffb@cusc.com')).toBe(true);
  });

  it('should allow Owner to update staff information', async () => {
    const ownerId = 'c0000000-0000-0000-0000-000000000003';
    const created = await service.createStaff(ownerId, {
      email: 'staff_update@cusc.com',
      fullName: 'Tên Ban Đầu',
    });

    const updated = await service.updateStaff(ownerId, created.id, {
      fullName: 'Tên Đã Chỉnh Sửa',
    });

    expect(updated.fullName).toBe('Tên Đã Chỉnh Sửa');
  });

  it('should allow Owner to lock and unlock staff account', async () => {
    const ownerId = 'c0000000-0000-0000-0000-000000000004';
    const created = await service.createStaff(ownerId, {
      email: 'staff_lock@cusc.com',
      fullName: 'Nhân viên cần khóa',
    });

    // 1. Khóa tài khoản
    const locked = await service.toggleLockStaff(ownerId, created.id, true);
    expect(locked.status).toBe('LOCKED');
    expect(locked.lockedAt).toBeDefined();

    // 2. Mở khóa tài khoản
    const unlocked = await service.toggleLockStaff(ownerId, created.id, false);
    expect(unlocked.status).toBe('ACTIVE');
  });

  it('should allow Owner to delete staff', async () => {
    const ownerId = 'c0000000-0000-0000-0000-000000000005';
    const created = await service.createStaff(ownerId, {
      email: 'staff_del@cusc.com',
      fullName: 'Nhân viên cần xóa',
    });

    const res = await service.deleteStaff(ownerId, created.id);
    expect(res.success).toBe(true);

    const list = await service.getStaffList(ownerId);
    expect(list.some((s) => s.id === created.id)).toBe(false);
  });

  it('should enforce multi-tenant isolation: staff of an owner cannot be seen by another owner', async () => {
    const owner1 = 'c0000000-0000-0000-0000-000000000010';
    const owner2 = 'c0000000-0000-0000-0000-000000000020';

    await service.createStaff(owner1, {
      email: 'staff_of_owner1@cusc.com',
      fullName: 'Staff Owner 1',
    });

    const listOwner2 = await service.getStaffList(owner2);
    expect(listOwner2.some((s) => s.email === 'staff_of_owner1@cusc.com')).toBe(false);
  });
});
