const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
    conn.exec("od -t x1 /var/www/lassez-docker/.env | grep ' 00' || echo 'No null bytes'", (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
            console.log('--- HEXDUMP ---');
            console.log(out);
            conn.end();
        });
    });
}).connect({
    host: '178.104.197.3',
    port: 22,
    username: 'root',
    privateKey: fs.readFileSync(path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519')),
});
