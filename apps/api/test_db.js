import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:han%40ct205@localhost:5432/recruitment_crm?schema=public';

const pool = new pg.Pool({ connectionString });

async function check() {
  const client = await pool.connect();
  try {
    const contacts = await client.query('SELECT count(*) FROM contacts');
    const channelIdentities = await client.query('SELECT count(*) FROM channel_identities');
    const customers = await client.query('SELECT count(*) FROM customers');
    const messages = await client.query('SELECT count(*) FROM messages');

    // Thử insert 1 contact và 1 channel_identity mẫu để kiểm tra bảng
    const contactId = '11111111-2222-3333-4444-555555555555';
    await client.query(`
      INSERT INTO contacts (id, display_name, phone_normalized, email, notes, created_at, updated_at)
      VALUES ($1, 'Dương Ngọc Hân (Demo Test)', '0901234567', 'ngochan@cusc.ctu.edu.vn', 'Quan tâm khóa học Lập trình Web fullstack', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        phone_normalized = EXCLUDED.phone_normalized,
        updated_at = NOW()
    `, [contactId]);

    await client.query(`
      INSERT INTO channel_identities (id, contact_id, channel, external_user_id, created_at, updated_at)
      VALUES ('22222222-3333-4444-5555-666666666666', $1, 'FACEBOOK', '27183131998051683', NOW(), NOW())
      ON CONFLICT (channel, external_user_id) DO UPDATE SET
        contact_id = EXCLUDED.contact_id,
        updated_at = NOW()
    `, [contactId]);

    const afterContacts = await client.query('SELECT * FROM contacts');
    const afterIdentities = await client.query('SELECT * FROM channel_identities');

    console.log('--- KẾT QUẢ SAU KHI TEST INSERT ---');
    console.log('contacts trong DB:', afterContacts.rows);
    console.log('channel_identities trong DB:', afterIdentities.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
