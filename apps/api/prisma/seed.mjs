import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const accounts = [
  {
    email: 'admin@cusc.com',
    phone: '01230000001',
    password: 'adminCusc123!',
    role: 'ADMIN',
    fullName: 'Admin CUSC',
  },
  {
    email: 'lead@cusc.com',
    phone: '01230000002',
    password: 'adminCusc123!',
    role: 'LEAD',
    fullName: 'Lead CUSC',
  },
  {
    email: 'agent@cusc.com',
    phone: '01230000003',
    password: 'adminCusc123!',
    role: 'AGENT',
    fullName: 'Agent CUSC',
  },
];

const client = await pool.connect();

try {
  await client.query('BEGIN');

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);

    const result = await client.query(
      `INSERT INTO users
         (id, email, phone_number, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::"Role", TRUE, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING id`,
      [randomUUID(), account.email, account.phone, passwordHash, account.role],
    );

    const userId = result.rows[0].id;
    const staff = await client.query(
      'UPDATE staff SET full_name = $2 WHERE user_id = $1 RETURNING id',
      [userId, account.fullName],
    );

    if (staff.rowCount === 0) {
      await client.query(
        'INSERT INTO staff (id, user_id, full_name) VALUES ($1, $2, $3)',
        [randomUUID(), userId, account.fullName],
      );
    }
  }

  await client.query('COMMIT');
  console.log('Seeded 3 demo accounts: ADMIN, LEAD, AGENT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
