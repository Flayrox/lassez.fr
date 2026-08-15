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
    
    // Command to check number of topics and file structure in both locations
    const cmd = `
        for dir in /var/www/lassez-api /var/www/lassez-front /var/www/lassez-studio; do
            echo "=== Directory: $dir ==="
            ls -l "$dir/prisma/radar.db" || echo "No DB file"
            if [ -f "$dir/prisma/radar.db" ]; then
                cd "$dir"
                node -e "
                    const { PrismaClient } = require('@prisma/client');
                    const prisma = new PrismaClient();
                    async function count() {
                        try {
                            const topics = await prisma.newsTopic.count();
                            console.log('TOPICS COUNT:', topics);
                            const activeTemplates = await prisma.taxonomyTemplate.count();
                            console.log('TEMPLATES COUNT:', activeTemplates);
                        } catch (e) {
                            console.error('Error:', e.message);
                        } finally {
                            await prisma.\\$disconnect();
                        }
                    }
                    count();
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
