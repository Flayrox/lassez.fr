const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_CONFIG = {
    host: '178.104.197.3',
    port: 22,
    username: 'root',
    privateKeyPath: path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519'),
};

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Connecté.');
    const cmd = `ls -li /var/www/lassez-api/prisma/radar.db /var/www/lassez-front/prisma/radar.db /var/www/lassez-studio/prisma/radar.db || true`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code) => {
            conn.end();
            console.log('Command closed with code', code);
            console.log(output);
        }).on('data', (data) => {
            output += data.toString();
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', console.error).connect({
    host: VPS_CONFIG.host,
    port: VPS_CONFIG.port,
    username: VPS_CONFIG.username,
    privateKey: fs.readFileSync(VPS_CONFIG.privateKeyPath),
});
