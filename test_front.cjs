const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const script = `
cd /var/www/lassez-front
export DATABASE_URL="postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres"
export PAYLOAD_SECRET="lassez_prod_fixed_secret_32_chars_min"
export PORT=3000
npm start
`;

conn.on('ready', () => {
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => process.stdout.write(data));
    stream.stderr.on('data', (data) => process.stderr.write(data));
    stream.on('close', () => conn.end());
    setTimeout(() => { stream.destroy(); conn.end(); }, 10000);
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(require('path').join(process.env.USERPROFILE, '.ssh', 'id_ed25519'))
});
