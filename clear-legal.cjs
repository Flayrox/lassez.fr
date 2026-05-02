const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  // Clear the legal global if it exists
  try {
    await client.query("DELETE FROM legal");
    console.log('Legal global cleared');
  } catch(e) {
    console.log('Could not clear legal global:', e.message);
  }
  
  await client.end();
}
run();
