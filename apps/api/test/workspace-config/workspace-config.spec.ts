import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceConfigService } from '../../src/modules/workspace-config/workspace-config.service.js';

describe('WorkspaceConfigService (Multi-tenant Customization & DB by Owner)', () => {
  let service: WorkspaceConfigService;

  beforeEach(() => {
    service = new WorkspaceConfigService();
  });

  it('should initialize with default Education (CUSC) configuration', async () => {
    const config = await service.getConfig('ws-test-01');
    expect(config.domain).toBe('EDUCATION');
    expect(config.terminology.entityName).toContain('Thí sinh');
    expect(config.pipelineStages.length).toBe(7);
    expect(config.productCatalog.length).toBeGreaterThanOrEqual(3);
  });

  it('should allow applying Real Estate preset', async () => {
    const config = await service.applyPreset('ws-test-02', 'REAL_ESTATE', 'Sàn BĐS Đất Vàng');
    expect(config.domain).toBe('REAL_ESTATE');
    expect(config.workspaceName).toBe('Sàn BĐS Đất Vàng');
    expect(config.terminology.productLabel).toContain('Bất động sản');
    expect(config.pipelineStages.some((s) => s.name.includes('nhà mẫu'))).toBe(true);
    expect(config.productCatalog.some((p) => p.name.includes('Vinhomes'))).toBe(true);
  });

  it('should allow applying Beauty Spa preset', async () => {
    const config = await service.applyPreset('ws-test-03', 'BEAUTY_SPA');
    expect(config.domain).toBe('BEAUTY_SPA');
    expect(config.terminology.valueLabel).toContain('liệu trình');
    expect(config.pipelineStages.some((s) => s.name.includes('Soi da'))).toBe(true);
  });

  it('should allow Admin to add a custom stage to the pipeline', async () => {
    const initial = await service.getConfig('ws-test-04');
    const initialCount = initial.pipelineStages.length;

    const updated = await service.addStage('ws-test-04', {
      name: 'Giai đoạn VIP mới',
      subtitle: 'Dành riêng cho khách VIP',
      color: '#ec4899',
      bgColor: '#fdf2f8',
      borderColor: '#fbcfe8',
      isWon: false,
      isLost: false,
      isSystem: false,
    });

    expect(updated.pipelineStages.length).toBe(initialCount + 1);
    expect(updated.pipelineStages.some((s) => s.name === 'Giai đoạn VIP mới')).toBe(true);
  });

  it('should allow Admin to add a custom course/product to catalog', async () => {
    const updated = await service.addProduct('ws-test-05', {
      name: 'Khóa học Flutter & iOS Siêu Tốc',
      code: 'FLUTTER-FAST',
      category: 'Ngắn hạn',
      defaultPrice: 15000000,
      description: 'Lập trình di động đa nền tảng',
      isActive: true,
    });

    expect(updated.productCatalog.some((p) => p.code === 'FLUTTER-FAST')).toBe(true);
  });

  it('should allow adding and deleting custom criteria', async () => {
    const updated = await service.addCriteria('ws-test-07', {
      name: 'Khả năng tiếng Anh',
      type: 'SELECT',
      options: ['Mất gốc', 'Giao tiếp cơ bản', 'IELTS 5.5+'],
      isRequired: true,
    });

    const added = updated.criteria.find((c) => c.name === 'Khả năng tiếng Anh');
    expect(added).toBeDefined();
    expect(added?.type).toBe('SELECT');
    expect(added?.options).toContain('IELTS 5.5+');

    const afterDelete = await service.deleteCriteria('ws-test-07', added!.id);
    expect(afterDelete.criteria.some((c) => c.id === added!.id)).toBe(false);
  });

  it('should throw an error if pipeline has less than 2 stages', async () => {
    await expect(
      service.updateConfig('ws-test-06', {
        pipelineStages: [
          {
            id: 'ONLY_ONE',
            name: 'Giai đoạn duy nhất',
            subtitle: '',
            color: '#000',
            bgColor: '#fff',
            borderColor: '#ccc',
            order: 1,
            isWon: false,
            isLost: false,
            isSystem: true,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('should persist and load configuration from database by ownerId via Prisma', async () => {
    const mockDbConfig = {
      id: 'a0000000-0000-0000-0000-000000000001',
      workspaceId: 'b0000000-0000-0000-0000-000000000002',
      ownerId: 'c0000000-0000-0000-0000-000000000003',
      domain: 'EDUCATION' as const,
      workspaceName: 'Trường Đại học Quốc tế FPT',
      terminology: {
        entityName: 'Tân sinh viên',
        pipelineName: 'Phễu Tuyển Sinh Đại Học',
        productLabel: 'Chuyên ngành đào tạo',
        valueLabel: 'Học phí 1 kỳ',
      },
      pipelineStages: [
        { id: 'S1', name: 'Nộp hồ sơ xét học bạ', subtitle: '', color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd', order: 1, isWon: false, isLost: false, isSystem: true },
        { id: 'S2', name: 'Đã hoàn tất nhập học', subtitle: '', color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0', order: 2, isWon: true, isLost: false, isSystem: true },
      ],
      productCatalog: [
        { id: 'P1', name: 'Kỹ thuật Phần mềm (Software Engineering)', code: 'SE', category: 'Chính quy', defaultPrice: 28000000, description: 'Đào tạo kỹ sư phần mềm', isActive: true },
        { id: 'P2', name: 'Trí tuệ Nhân tạo (AI & Data Science)', code: 'AI', category: 'Chính quy', defaultPrice: 32000000, description: 'Chuyên sâu Machine Learning', isActive: true },
      ],
      criteria: [
        { id: 'C1', name: 'Điểm thi THPT Quốc gia', type: 'NUMBER' as const, isRequired: true },
      ],
    };

    let storedRecord: any = null;

    const mockPrisma = {
      staff: {
        findUnique: async () => ({ id: 'c0000000-0000-0000-0000-000000000003', role: 'OWNER' }),
        findFirst: async () => ({ id: 'c0000000-0000-0000-0000-000000000003', role: 'OWNER' }),
      },
      workspace: {
        findUnique: async () => ({ id: 'b0000000-0000-0000-0000-000000000002', ownerId: 'c0000000-0000-0000-0000-000000000003' }),
        findFirst: async () => ({ id: 'b0000000-0000-0000-0000-000000000002', ownerId: 'c0000000-0000-0000-0000-000000000003' }),
      },
      workspaceConfiguration: {
        findFirst: async ({ where }: any) => {
          if (storedRecord) {
            if (where?.ownerId === storedRecord.ownerId) return storedRecord;
            if (where?.OR?.some((o: any) => o.ownerId === storedRecord.ownerId || o.workspaceId === storedRecord.workspaceId)) {
              return storedRecord;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          storedRecord = { id: 'a0000000-0000-0000-0000-000000000001', ...data };
          return storedRecord;
        },
        update: async ({ data }: any) => {
          storedRecord = { ...storedRecord, ...data };
          return storedRecord;
        },
      },
    } as any;

    const dbService = new WorkspaceConfigService(mockPrisma);

    // Lưu cấu hình vào DB theo ownerId
    await dbService.updateConfig('b0000000-0000-0000-0000-000000000002', mockDbConfig, 'c0000000-0000-0000-0000-000000000003');

    expect(storedRecord).toBeDefined();
    expect(storedRecord.ownerId).toBe('c0000000-0000-0000-0000-000000000003');
    expect(storedRecord.workspaceId).toBe('b0000000-0000-0000-0000-000000000002');
    expect(storedRecord.workspaceName).toBe('Trường Đại học Quốc tế FPT');

    // Đọc lại cấu hình từ DB theo ownerId
    const loaded = await dbService.getConfig('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003');
    expect(loaded.terminology.entityName).toBe('Tân sinh viên');
    expect(loaded.productCatalog.some((p) => p.name.includes('Trí tuệ Nhân tạo'))).toBe(true);
    expect(loaded.criteria.some((c) => c.name.includes('Điểm thi'))).toBe(true);
  });

  it('should automatically link workspace_id to workspaces table when it was null or non-UUID default', async () => {
    // Giả lập DB ban đầu có workspaceConfiguration với workspace_id = null
    let dbRecord: any = {
      id: 'a0000000-0000-0000-0000-000000000001',
      workspaceId: null, // ĐANG BỊ NULL TRONG DB
      ownerId: 'c0000000-0000-0000-0000-000000000003',
      domain: 'EDUCATION',
      workspaceName: 'CUSC Education',
      terminology: {},
      pipelineStages: [
        { id: 'S1', name: 'Giai đoạn 1', subtitle: '', color: '#000', bgColor: '#fff', borderColor: '#ccc', order: 1, isWon: false, isLost: false, isSystem: true },
        { id: 'S2', name: 'Giai đoạn 2', subtitle: '', color: '#000', bgColor: '#fff', borderColor: '#ccc', order: 2, isWon: true, isLost: false, isSystem: true },
      ],
      productCatalog: [],
      criteria: [],
    };

    const mockPrisma = {
      staff: {
        findUnique: async () => ({ id: 'c0000000-0000-0000-0000-000000000003', role: 'OWNER', fullName: 'CUSC Director' }),
        findFirst: async () => ({ id: 'c0000000-0000-0000-0000-000000000003', role: 'OWNER' }),
      },
      workspace: {
        findUnique: async () => ({ id: 'w0000000-0000-0000-0000-000000000099', ownerId: 'c0000000-0000-0000-0000-000000000003' }),
        findFirst: async () => ({ id: 'w0000000-0000-0000-0000-000000000099', ownerId: 'c0000000-0000-0000-0000-000000000003' }),
      },
      workspaceConfiguration: {
        findFirst: async () => dbRecord,
        update: async ({ data }: any) => {
          dbRecord = { ...dbRecord, ...data };
          return dbRecord;
        },
      },
    } as any;

    const dbService = new WorkspaceConfigService(mockPrisma);

    // Khi client gọi với workspaceId mặc định 'ws-default-001' (không phải UUID)
    const config = await dbService.getConfig('ws-default-001', 'c0000000-0000-0000-0000-000000000003');

    // Kiểm tra cấu hình trả về đã được cập nhật sang UUID thật của workspaces
    expect(config.workspaceId).toBe('w0000000-0000-0000-0000-000000000099');
    // Kiểm tra bản ghi trong DB đã được tự động chữa lành nối với workspaces.id (không còn NULL)
    expect(dbRecord.workspaceId).toBe('w0000000-0000-0000-0000-000000000099');
  });

  it('should auto-create a workspace row if owner does not have any workspace yet', async () => {
    let createdWorkspace: any = null;
    let createdConfig: any = null;

    const mockPrisma = {
      staff: {
        findUnique: async () => ({ id: 'c0000000-0000-0000-0000-000000000005', role: 'OWNER', fullName: 'New Owner' }),
        findFirst: async () => ({ id: 'c0000000-0000-0000-0000-000000000005', role: 'OWNER' }),
      },
      workspace: {
        findUnique: async () => null,
        findFirst: async () => createdWorkspace,
        create: async ({ data }: any) => {
          createdWorkspace = { id: 'w-new-uuid-0000-0000-000000000001', ...data };
          return createdWorkspace;
        },
      },
      workspaceConfiguration: {
        findFirst: async () => createdConfig,
        create: async ({ data }: any) => {
          createdConfig = { id: 'cfg-new-uuid-1', ...data };
          return createdConfig;
        },
      },
    } as any;

    const dbService = new WorkspaceConfigService(mockPrisma);
    const config = await dbService.getConfig('ws-default-001', 'c0000000-0000-0000-0000-000000000005');

    expect(createdWorkspace).toBeDefined();
    expect(createdWorkspace.ownerId).toBe('c0000000-0000-0000-0000-000000000005');
    expect(createdConfig).toBeDefined();
    expect(createdConfig.workspaceId).toBe('w-new-uuid-0000-0000-000000000001');
    expect(config.workspaceId).toBe('w-new-uuid-0000-0000-000000000001');
  });
});
