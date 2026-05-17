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
    console.log('✓ SSH Connected to VPS.');
    
    // Command to check drafts from the api/daemon database
    const cmd = `
        cd /var/www/lassez-api
        node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            async function run() {
                try {
                    const topics = await prisma.newsTopic.findMany({
                        orderBy: { updatedAt: 'desc' },
                        take: 5
                    });
                    
                    console.log('--- RECENT DRAFTS FROM API/DAEMON DATABASE ---');
                    for (const t of topics) {
                        console.log('ID:', t.id);
                        console.log('STATUS:', t.status);
                        console.log('TAXONOMY:', t.taxonomy);
                        console.log('TAGS:', t.tags);
                        console.log('RAW TITLE:', t.raw_data ? JSON.parse(t.raw_data).clusterTitle : 'none');
                        console.log('FINAL DRAFT:', t.final_draft);
                        console.log('=============================================');
                    }
                } catch (e) {
                    console.error('Error:', e.message);
                } finally {
                    await prisma.\\$disconnect();
                }
            }
            run();
        "
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code) => {
            conn.end();
            console.log('Command finished with code', code);
            console.log('\n--- REMOTE OUTPUT ---');
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
