import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';

const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  staff: '00000000-0000-4000-8000-000000000002',
  invalidRole: '00000000-0000-4000-8000-000000000003',
};

describe('RBAC (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let jwt: JwtService;

  const staffById: Record<
    string,
    { id: string; role: string; status: string; tokenVersion: number }
  > = {
    [ids.owner]: {
      id: ids.owner,
      role: 'OWNER',
      status: 'ACTIVE',
      tokenVersion: 0,
    },
    [ids.staff]: {
      id: ids.staff,
      role: 'STAFF',
      status: 'ACTIVE',
      tokenVersion: 0,
    },
    [ids.invalidRole]: {
      id: ids.invalidRole,
      role: 'INVALID',
      status: 'ACTIVE',
      tokenVersion: 0,
    },
  };

  beforeAll(async () => {
    const prismaMock = {
      staff: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(staffById[where.id] ?? null),
        ),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function makeToken(
    sub: string,
    role: string,
    expiresIn?: '-1s',
  ): Promise<string> {
    return jwt.signAsync(
      { sub, role, tokenVersion: 0 },
      expiresIn ? { expiresIn } : {},
    );
  }

  function server(): App {
    if (!app) throw new Error('Test application was not initialized');
    return app.getHttpServer();
  }

  it('allows OWNER with a valid JWT', async () => {
    await request(server())
      .get('/api/owner-only')
      .set('Authorization', `Bearer ${await makeToken(ids.owner, 'OWNER')}`)
      .expect(200, { ok: true });
  });

  it('returns 404 for STAFF on the OWNER-only endpoint', async () => {
    await request(server())
      .get('/api/owner-only')
      .set('Authorization', `Bearer ${await makeToken(ids.staff, 'STAFF')}`)
      .expect(404);
  });

  it('returns 401 when the JWT is missing', async () => {
    await request(server()).get('/api/owner-only').expect(401);
  });

  it('returns 401 when the JWT is invalid', async () => {
    await request(server())
      .get('/api/owner-only')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('returns 401 when the JWT is expired', async () => {
    await request(server())
      .get('/api/owner-only')
      .set(
        'Authorization',
        `Bearer ${await makeToken(ids.owner, 'OWNER', '-1s')}`,
      )
      .expect(401);
  });

  it('rejects unknown database roles', async () => {
    await request(server())
      .get('/api/owner-only')
      .set(
        'Authorization',
        `Bearer ${await makeToken(ids.invalidRole, 'OWNER')}`,
      )
      .expect(401);
  });

  it('does not allow role spoofing in headers, query, or body', async () => {
    await request(server())
      .get('/api/owner-only')
      .set('Authorization', `Bearer ${await makeToken(ids.staff, 'OWNER')}`)
      .set('role', 'OWNER')
      .query({ role: 'OWNER' })
      .send({ role: 'OWNER', id: ids.owner })
      .expect(404);
  });

  it('leaves the public endpoint and login route reachable', async () => {
    await request(server()).get('/api').expect(200);
    await request(server()).post('/api/auth/login').send({}).expect(400);
  });
});
