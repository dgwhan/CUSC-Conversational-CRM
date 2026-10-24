import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceConfigService } from '../../src/modules/workspace-config/workspace-config.service.js';

describe('WorkspaceConfigService (Multi-tenant Customization)', () => {
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
});
