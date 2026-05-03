const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const email = 'ekedzah@gmail.com';

conn.on('ready', () => {
  conn.exec(`psql "postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres" -c "SELECT id FROM authors WHERE email = '${email}';"`, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('data', (data) => output += data);
    stream.on('close', () => {
      console.log(output);
      const match = output.match(/\s+(\d+)\s+/);
      if (match) {
        const id = match[1];
        console.log(`Found ID: ${id}. Adding admin role...`);
        conn.exec(`psql "postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres" -c "INSERT INTO authors_roles (parent_id, value, \\"order\\") VALUES (${id}, 'admin', 0) ON CONFLICT DO NOTHING;"`, (err2, stream2) => {
          if (err2) throw err2;
          stream2.on('data', (data) => process.stdout.write(data));
          stream2.on('close', () => conn.end());
        });
      } else {
        console.log('Author not found.');
        conn.end();
      }
    });
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(require('path').join(process.env.USERPROFILE, '.ssh', 'id_ed25519'))
});
