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
    email: 'owner@cusc.com',
    password: 'ownerCusc123!',
    role: 'OWNER',
    fullName: 'Owner PolarisX',
  },
  {
    email: 'staff@cusc.com',
    password: 'staffCusc123!',
    role: 'STAFF',
    fullName: 'Staff PolarisX',
  },
];

const client = await pool.connect();

// Đảm bảo các giá trị Enum cần thiết tồn tại trong Database
try {
  await client.query(`ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'OWNER'`);
} catch {}

try {
  await client.query(`ALTER TYPE "workspace_member_role" ADD VALUE IF NOT EXISTS 'STAFF'`);
} catch {}

try {
  await client.query('BEGIN');

  for (const account of accounts) {
    const passwordHash = await argon2.hash(account.password);

    await client.query(
      `INSERT INTO staff
         (id, email, full_name, password_hash, role, status, token_version, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::"StaffRole", 'ACTIVE'::"StaffStatus", 0, FALSE, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [randomUUID(), account.email, account.fullName, passwordHash, account.role],
    );
  }

  //Lấy owner user để làm owner cho Default Workspace
  const ownerRes = await client.query(`SELECT id FROM staff WHERE email = 'owner@cusc.com' LIMIT 1`);
  const ownerId = ownerRes.rows[0]?.id;

  if (ownerId) {
    // Cập nhật owner_id cho tài khoản staff demo
    await client.query(`UPDATE staff SET owner_id = $1 WHERE email = 'staff@cusc.com'`, [ownerId]);

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
      // Gán các staff vào workspace_members
      const staffRows = await client.query(`SELECT id, email, role FROM staff WHERE email IN ('owner@cusc.com', 'staff@cusc.com')`);
      for (const row of staffRows.rows) {
        const memberRole = row.role === 'OWNER' ? 'OWNER' : 'STAFF';
        await client.query(
          `INSERT INTO workspace_members (id, workspace_id, staff_id, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4::"workspace_member_role", true, NOW(), NOW())
           ON CONFLICT (workspace_id, staff_id) DO UPDATE SET
             role = EXCLUDED.role,
             updated_at = NOW()`,
          [randomUUID(), actualWsId, row.id, memberRole],
        );
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
  console.log('Seeded 2 demo staff accounts (OWNER & STAFF) and Default Workspace: CUSC');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
