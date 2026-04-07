const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`
    cd /var/www/radar-studio
    git reset --hard HEAD
    git clean -fd
    git pull origin main
    npm install
    npm run build
    pm2 stop radar-admin
    pm2 delete radar-admin
    pm2 start ecosystem.config.cjs --only radar-admin
    pm2 save
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '116.203.158.47',
  port: 22,
  username: 'root',
  password: 'wung7vNXJePU'
});