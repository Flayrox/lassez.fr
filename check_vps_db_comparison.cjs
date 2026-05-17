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
    
    // Command to check templates and global prompts content in both databases
    const cmd = `
        for dir in /var/www/lassez-api /var/www/lassez-front; do
            if [ -f "$dir/prisma/radar.db" ]; then
                echo "=== Directory: $dir ==="
                cd "$dir"
                node -e "
                    const { PrismaClient } = require('@prisma/client');
                    const prisma = new PrismaClient();
                    async function check() {
                        try {
                            const templates = await prisma.taxonomyTemplate.findMany({
                                select: { name: true, outputSchemaJson: true }
                            });
                            for (const t of templates) {
                                console.log('TEMPLATE NAME:', t.name);
                                console.log('OUTPUT SCHEMA JSON:', t.outputSchemaJson);
                                console.log('--------------------');
                            }
                        } catch (e) {
                            console.error('Error:', e.message);
                        } finally {
                            await prisma.\\$disconnect();
                        }
                    }
                    check();
                "
            fi
            echo ""
        done
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
