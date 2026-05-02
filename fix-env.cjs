const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const envContent = fs.readFileSync('.env', 'utf-8');

// Escape single quotes just in case, though usually EOF handles it if unquoted
// Wait, EOF handles it as is.
const script = `
cat > /var/www/lassez-front/.env << 'EOF'
${envContent}
EOF
cat > /var/www/lassez-api/.env << 'EOF'
${envContent}
EOF
cat > /var/www/lassez-studio/.env << 'EOF'
${envContent}
EOF
pm2 reload all
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
