const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('pm2 logs radar-front --lines 50 --no-daemon', (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => process.stdout.write(data));
    stream.on('stderr', (data) => process.stderr.write(data));
    stream.on('close', () => conn.end());
    setTimeout(() => { stream.destroy(); conn.end(); }, 5000);
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(require('path').join(process.env.USERPROFILE, '.ssh', 'id_ed25519'))
});
