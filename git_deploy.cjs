const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`
    cd /var/www/radar-studio
    git stash
    git pull origin main
    npm install
    npm run build
    pm2 stop radar-admin
    pm2 delete radar-admin
    pm2 start npm --name "radar-admin" -- start
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
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  password: 'wung7vNXJePU'
});