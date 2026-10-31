import { randomUUID } from 'node:crypto';
import path from 'node:path';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables from app level or workspace root level
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/recruitment_crm?schema=public';

const pool = new pg.Pool({ connectionString });

const accounts = [
  {
    email: 'owner@polarisx.com',
    password: 'ownerPolarisX123!',
    workspaceRole: 'OWNER',
    fullName: 'Owner PolarisX',
  },
  {
    email: 'staff@polarisx.com',
    password: 'staffPolarisX123!',
    workspaceRole: 'STAFF',
    fullName: 'Staff PolarisX',
  },
];

const client = await pool.connect();

try {
  await client.query(`ALTER TYPE "workspace_member_role" ADD VALUE IF NOT EXISTS 'STAFF'`);
} catch {}

try {
  await client.query('BEGIN');

  for (const account of accounts) {
    const passwordHash = await argon2.hash(account.password);

    await client.query(
      `INSERT INTO users
         (id, email, full_name, password_hash, status, token_version, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE'::"user_status", 0, FALSE, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [randomUUID(), account.email, account.fullName, passwordHash],
    );
  }

  // Lấy owner user để làm owner cho Default Workspace
  const ownerRes = await client.query(`SELECT id FROM users WHERE email = 'owner@polarisx.com' LIMIT 1`);
  const ownerId = ownerRes.rows[0]?.id;

  if (ownerId) {
    const workspaceId = randomUUID();
    await client.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, is_active, created_at, updated_at)
       VALUES ($1, 'PolarisX', 'polarisx', $2, true, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         owner_id = EXCLUDED.owner_id,
         updated_at = NOW()`,
      [workspaceId, ownerId],
    );

    const wsRes = await client.query(`SELECT id FROM workspaces WHERE slug = 'polarisx' OR slug = 'cusc' LIMIT 1`);
    const actualWsId = wsRes.rows[0]?.id || workspaceId;

    if (actualWsId) {
      // Gán các user vào workspace_members với role tương ứng
      for (const account of accounts) {
        const userRes = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [account.email]);
        const userId = userRes.rows[0]?.id;
        if (userId) {
          await client.query(
            `INSERT INTO workspace_members (id, workspace_id, user_id, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4::"workspace_member_role", true, NOW(), NOW())
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET
               role = EXCLUDED.role,
               updated_at = NOW()`,
            [randomUUID(), actualWsId, userId, account.workspaceRole],
          );
        }
      }

      // Gán các channel_accounts chưa có workspace_id vào workspace mặc định
      await client.query(
        `UPDATE channel_accounts SET workspace_id = $1 WHERE workspace_id IS NULL`,
        [actualWsId],
      );

      // Nối workspace_id trong workspace_configurations với workspace của owner
      await client.query(
        `UPDATE workspace_configurations SET workspace_id = $1 WHERE owner_id = $2 AND (workspace_id IS NULL OR workspace_id != $1)`,
        [actualWsId, ownerId],
      );
    }
  }

  await client.query('COMMIT');
  console.log('Seeded 2 demo user accounts (OWNER & STAFF) and Default Workspace: PolarisX');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
