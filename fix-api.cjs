const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

const script = `
echo "PAYLOAD_SERVER_URL=https://api.lassez.fr" >> /var/www/lassez-api/.env.local
pm2 restart radar-api --update-env
`;

conn.on('ready', () => {
    conn.exec(script, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '178.104.197.3',
    port: 22,
    username: 'root',
    privateKey: fs.readFileSync(process.env.USERPROFILE + '/.ssh/id_ed25519')
});
