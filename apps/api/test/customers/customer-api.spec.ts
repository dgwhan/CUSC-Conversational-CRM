import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerController } from '../../src/modules/messaging/presentation/customer.controller.js';
import { removeVietnameseTones, matchesUnaccent } from '../../src/modules/customers/domain/unaccent.js';
import { standardizeVietnamesePhoneNumber } from '../../src/modules/customers/domain/phone-standardizer.js';
import { NotFoundException } from '@nestjs/common';

describe('CUS-05: Customer API & Unaccent Search', () => {
  describe('1. Tiện ích Unaccent tiếng Việt (Domain Logic)', () => {
    it('chuẩn hóa bỏ dấu chính xác: "Nguyễn Văn A" -> "nguyen van a"', () => {
      expect(removeVietnameseTones('Nguyễn Văn A')).toBe('nguyen van a');
      expect(removeVietnameseTones('Trần Thị Bé')).toBe('tran thi be');
      expect(removeVietnameseTones('Đỗ Đăng Đạt')).toBe('do dang dat');
      expect(removeVietnameseTones('Lê Hoàng Phúc')).toBe('le hoang phuc');
    });

    it('matchesUnaccent: tìm "nguyen van a" ra "Nguyễn Văn A"', () => {
      const targetName = 'Nguyễn Văn A';
      expect(matchesUnaccent(targetName, 'nguyen van a')).toBe(true);
      expect(matchesUnaccent(targetName, 'Nguyen Van A')).toBe(true);
      expect(matchesUnaccent(targetName, 'nguyen')).toBe(true);
      expect(matchesUnaccent(targetName, 'van a')).toBe(true);
      expect(matchesUnaccent(targetName, 'Nguyễn')).toBe(true);
      expect(matchesUnaccent(targetName, 'tran')).toBe(false);
    });

    it('matchesUnaccent: xử lý an toàn với chuỗi rỗng hoặc null', () => {
      expect(matchesUnaccent('', 'abc')).toBe(false);
      expect(matchesUnaccent(null, 'abc')).toBe(false);
      expect(matchesUnaccent('Nguyễn Văn A', '')).toBe(false);
      expect(matchesUnaccent('Nguyễn Văn A', null)).toBe(false);
    });
  });

  describe('2. Controller: GET /customers (Tìm kiếm & Phân trang)', () => {
    let controller: CustomerController;
    let mockPrisma: any;

    const mockCustomer1 = {
      id: '11111111-1111-1111-1111-111111111111',
      workspaceId: 'ws-uuid-1',
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      email: 'vana@gmail.com',
      notes: 'Quan tâm khóa học Lập trình Web',
      leadStatus: 'POTENTIAL',
      leadStage: 'STAGE_PROSPECT',
      channelIdentities: { tags: ['Lead'] },
      conversations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCustomer2 = {
      id: '22222222-2222-2222-2222-222222222222',
      workspaceId: 'ws-uuid-1',
      fullName: 'Trần Thị Bích',
      phone: '0987654321',
      email: 'bich@gmail.com',
      notes: 'Học viên khóa Đồ họa đa phương tiện',
      leadStatus: 'NEW',
      leadStage: 'STAGE_NEW',
      channelIdentities: { tags: ['Khách hàng mới'] },
      conversations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrisma = {
        customer: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            let list = [mockCustomer1, mockCustomer2];
            if (where?.id?.in) {
              list = list.filter((c) => where.id.in.includes(c.id));
            }
            if (where?.leadStatus) {
              list = list.filter((c) => c.leadStatus === where.leadStatus);
            }
            return Promise.resolve(list);
          }),
          count: vi.fn().mockImplementation(({ where }) => {
            let list = [mockCustomer1, mockCustomer2];
            if (where?.id?.in) {
              list = list.filter((c) => where.id.in.includes(c.id));
            }
            return Promise.resolve(list.length);
          }),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $queryRaw: vi.fn().mockImplementation((strings, ...values) => {
          // Giả lập PostgreSQL unaccent query
          const rawSearch = values[0] ? String(values[0]).replace(/%/g, '') : '';
          const searchDigits = rawSearch.replace(/\D/g, '');
          const std = searchDigits.length >= 7 ? standardizeVietnamesePhoneNumber(searchDigits) : null;

          const matched = [mockCustomer1, mockCustomer2].filter((c) => {
            if (matchesUnaccent(c.fullName, rawSearch)) return true;
            if (matchesUnaccent(c.notes, rawSearch)) return true;
            if (c.email && c.email.toLowerCase().includes(rawSearch.toLowerCase())) return true;
            if (searchDigits.length >= 4) {
              if (c.phone && (c.phone === std || c.phone.includes(searchDigits))) return true;
            }
            return false;
          });
          return Promise.resolve(matched.map((m) => ({ id: m.id })));
        }),
      };

      controller = new CustomerController(mockPrisma as any);
    });

    it('DoD CUS-05: Tìm "nguyen van a" ra đúng khách hàng "Nguyễn Văn A"', async () => {
      const res = await controller.getCustomers(undefined, undefined, 'nguyen van a');

      expect(res.items).toHaveLength(1);
      expect(res.items[0].fullName).toBe('Nguyễn Văn A');
      expect(res.items[0].phone).toBe('0912345678');
      expect(res.items[0].notes).toBe('Quan tâm khóa học Lập trình Web');
    });

    it('Tìm "Nguyen Van A" viết hoa chữ cái đầu vẫn ra "Nguyễn Văn A"', async () => {
      const res = await controller.getCustomers(undefined, undefined, 'Nguyen Van A');

      expect(res.items).toHaveLength(1);
      expect(res.items[0].fullName).toBe('Nguyễn Văn A');
    });

    it('Tìm theo SĐT có dấu chấm hoặc khoảng trắng "0912.345.678" ra đúng khách hàng', async () => {
      const res = await controller.getCustomers(undefined, undefined, '0912.345.678');

      expect(res.items).toHaveLength(1);
      expect(res.items[0].fullName).toBe('Nguyễn Văn A');
      expect(res.items[0].phone).toBe('0912345678');
    });

    it('Tìm theo SĐT đầu số quốc tế "+84912345678" ra đúng khách hàng', async () => {
      const res = await controller.getCustomers(undefined, undefined, '+84912345678');

      expect(res.items).toHaveLength(1);
      expect(res.items[0].fullName).toBe('Nguyễn Văn A');
    });

    it('Hỗ trợ phân trang: page=1, limit=10 trả về đúng cấu trúc metadata', async () => {
      const res = await controller.getCustomers(undefined, undefined, undefined, '1', '10');

      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.total).toBe(2);
      expect(res.totalPages).toBe(1);
      expect(res.items).toHaveLength(2);
    });
  });

  describe('3. Controller: GET /customers/:id (Chi tiết khách hàng)', () => {
    let controller: CustomerController;
    let mockPrisma: any;

    const existingCustomer = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      email: 'vana@gmail.com',
      notes: 'Đã hẹn tư vấn ngày mai',
      leadStatus: 'POTENTIAL',
      leadStage: 'TU_VAN_CHUYEN_SAU',
      channelIdentities: {
        interestCourses: ['Lập trình Python'],
        estimatedValue: 15000000,
        tags: ['Lead'],
      },
      conversations: [
        {
          id: 'conv-1',
          channelAccount: { displayName: 'Fanpage CUSC', channel: 'FACEBOOK' },
          lastMessageAt: new Date(),
        },
      ],
    };

    beforeEach(() => {
      mockPrisma = {
        customer: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === existingCustomer.id) {
              return Promise.resolve(existingCustomer);
            }
            return Promise.resolve(null);
          }),
        },
      };

      controller = new CustomerController(mockPrisma as any);
    });

    it('trả về thông tin chi tiết đầy đủ khi ID tồn tại', async () => {
      const res = await controller.getCustomerById(existingCustomer.id);

      expect(res.id).toBe(existingCustomer.id);
      expect(res.fullName).toBe('Nguyễn Văn A');
      expect(res.notes).toBe('Đã hẹn tư vấn ngày mai');
      expect(res.leadStatus).toBe('POTENTIAL');
      expect(res.interestCourses).toContain('Lập trình Python');
      expect(res.conversations).toHaveLength(1);
    });

    it('ném lỗi NotFoundException (404) khi ID không tồn tại', async () => {
      await expect(
        controller.getCustomerById('99999999-9999-9999-9999-999999999999')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Controller: PATCH /customers/:id (Cập nhật tên & ghi chú)', () => {
    let controller: CustomerController;
    let mockPrisma: any;

    const initialCustomer = {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      email: 'vana@gmail.com',
      notes: 'Ghi chú ban đầu',
      leadStatus: 'NEW',
      leadStage: 'STAGE_NEW',
      channelIdentities: {},
      conversations: [],
    };

    beforeEach(() => {
      mockPrisma = {
        customer: {
          findUnique: vi.fn().mockResolvedValue(initialCustomer),
          update: vi.fn().mockImplementation(({ data }) => {
            return Promise.resolve({
              ...initialCustomer,
              ...data,
            });
          }),
        },
      };

      controller = new CustomerController(mockPrisma as any);
    });

    it('cập nhật thành công tên hiển thị và ghi chú mới', async () => {
      const updated = await controller.updateCustomer(initialCustomer.id, {
        fullName: 'Nguyễn Văn An (VIP)',
        notes: 'Học viên đã nộp học phí 100%, chờ xếp lớp tháng 11',
      });

      expect(updated.fullName).toBe('Nguyễn Văn An (VIP)');
      expect(updated.notes).toBe('Học viên đã nộp học phí 100%, chờ xếp lớp tháng 11');
      expect(mockPrisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: initialCustomer.id },
          data: expect.objectContaining({
            fullName: 'Nguyễn Văn An (VIP)',
            notes: 'Học viên đã nộp học phí 100%, chờ xếp lớp tháng 11',
          }),
        })
      );
    });
  });
});
