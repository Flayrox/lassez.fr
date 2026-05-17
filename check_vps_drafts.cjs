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
const cmd = `cd /var/www/lassez-api && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.taxonomyTemplate.findMany({
    orderBy: { sortOrder: 'asc' }
}).then(templates => {
    console.log('FOUND_TEMPLATES:' + JSON.stringify(templates));
}).catch(console.error).finally(() => prisma['$disconnect']());
"`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code) => {
            conn.end();
            console.log('Command closed with code', code);
            const match = output.match(/FOUND_TEMPLATES:(.*)/);
            if (match) {
                const templates = JSON.parse(match[1]);
                console.log(`Found ${templates.length} templates on VPS:`);
                for (const t of templates) {
                    console.log(`=== ${t.name} (${t.displayName}) ===`);
                    console.log(`Format instructions:\n${t.formatInstructions}`);
                    console.log(`Schema JSON:\n${t.outputSchemaJson}`);
                    console.log('------------------------------');
                }
            } else {
                console.log('Raw output:', output.slice(0, 1000));
            }
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
