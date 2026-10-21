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
    email: 'admin@cusc.com',
    password: 'adminCusc123!',
    role: 'ADMIN',
    fullName: 'Admin CUSC',
  },
  {
    email: 'manager@cusc.com',
    password: 'adminCusc123!',
    role: 'MANAGER',
    fullName: 'Manager CUSC',
  },
  {
    email: 'staff@cusc.com',
    password: 'adminCusc123!',
    role: 'STAFF',
    fullName: 'Staff CUSC',
  },
];

const client = await pool.connect();

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

  await client.query('COMMIT');
  console.log('Seeded 3 demo staff accounts: ADMIN, MANAGER, STAFF');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
