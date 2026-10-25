import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { WorkspaceConfigModule } from '../../src/modules/workspace-config/workspace-config.module.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';

describe('WorkspaceConfigController HTTP Routing (/api/workspaces/current/config)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), WorkspaceConfigModule],
    })
      .overrideProvider(PrismaService)
      .useValue(null)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/workspaces/current/config returns 200 with config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workspaces/current/config',
      headers: {
        'x-user-role': 'OWNER',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.domain).toBe('EDUCATION');
    expect(body.pipelineStages.length).toBeGreaterThanOrEqual(2);
  });

  it('PUT /api/workspaces/current/config returns 200 and updates config successfully', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/workspaces/current/config',
      headers: {
        'x-user-role': 'OWNER',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        workspaceName: 'Trường Đào Tạo Lập Trình Viên CUSC',
        terminology: {
          entityName: 'Học viên IT',
          pipelineName: 'Phễu Tuyển Sinh Công Nghệ',
          productLabel: 'Chương trình đào tạo',
          valueLabel: 'Học phí trọn khóa (VNĐ)',
        },
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.workspaceName).toBe('Trường Đào Tạo Lập Trình Viên CUSC');
    expect(body.terminology.entityName).toBe('Học viên IT');
  });

  it('GET /api/workspaces/current/staff returns 200 for staff management', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workspaces/current/staff',
      headers: {
        'x-user-role': 'OWNER',
      },
    });

    expect(res.statusCode).toBe(200);
  });
});
