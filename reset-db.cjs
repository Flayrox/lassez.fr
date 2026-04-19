const { Client } = require('pg');
async function resetDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('Connected. Dropping public schema...');
    await client.query('DROP SCHEMA public CASCADE;');
    console.log('Schema dropped. Recreating...');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Database reset successfully!');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
resetDb();
