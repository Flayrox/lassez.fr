const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('data', (data) => output += data);
    stream.on('close', () => {
      try {
        const apps = JSON.parse(output);
        apps.forEach(app => {
          const port = app.pm2_env.PORT || app.pm2_env.env?.PORT || app.pm2_env.args?.match(/-p (\d+)/)?.[1] || 'N/A';
          console.log(`[${app.name}] Status: ${app.pm2_env.status}, Restarts: ${app.pm2_env.restart_time}, Port: ${port}`);
        });
      } catch (e) { console.log('Parse error'); }
      conn.end();
    });
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(require('path').join(process.env.USERPROFILE, '.ssh', 'id_ed25519'))
});