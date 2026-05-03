const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('grep -B 5 -A 2 "proxy_pass" /etc/nginx/sites-enabled/lassez.conf', (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => process.stdout.write(data));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(require('path').join(process.env.USERPROFILE, '.ssh', 'id_ed25519'))
});
