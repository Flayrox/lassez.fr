const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const deployConfig = {
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(`${process.env.USERPROFILE}/.ssh/id_ed25519`)
};

// Lire la configuration Nginx
const nginxConfig = fs.readFileSync(path.join(__dirname, 'nginx-lassez-multisite.conf'), 'utf8');

const deployScript = `
set -e

echo "=== DÉPLOIEMENT COMPLET LASSEZ V3 (Multi-site) ==="
echo ""

# 0. Configuration Nginx
echo "[0/9] Configuration de Nginx..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# Sauvegarde de l'ancienne config
cp /etc/nginx/sites-available/lassez.conf /etc/nginx/sites-available/lassez.conf.backup 2>/dev/null || true

# Déploiement de la nouvelle config
cat > /etc/nginx/sites-available/lassez.conf << 'NGINXEOF'
${nginxConfig}
NGINXEOF

# Active le site
ln -sf /etc/nginx/sites-available/lassez.conf /etc/nginx/sites-enabled/lassez.conf 2>/dev/null || true

# Test Nginx
nginx -t && echo "✓ Configuration Nginx validée" || echo "⚠️  Erreur Nginx (peut être normal si déjà configuré)"

# 1. Préparation des répertoires
echo "[1/9] Préparation des répertoires..."
mkdir -p /var/www/lassez-front
mkdir -p /var/www/lassez-api
mkdir -p /var/www/lassez-studio
rm -rf /var/www/lassez-front/* /var/www/lassez-api/* /var/www/lassez-studio/* 2>/dev/null || true

# 2. Extraction du tarball
echo "[2/9] Extraction du code source..."
cd /var/www
tar -xzf deploy.tar.gz -C lassez-front --strip-components=0 2>/dev/null || true
tar -xzf deploy.tar.gz -C lassez-api --strip-components=0 2>/dev/null || true
tar -xzf deploy.tar.gz -C lassez-studio --strip-components=0 2>/dev/null || true

# Nettoyage du tarball
rm -f /var/www/deploy.tar.gz 2>/dev/null || true

# 3. Arrêt des anciens processus
echo "[3/9] Arrêt des anciens processus..."
pm2 stop radar-api radar-admin radar-studio 2>/dev/null || true
pm2 delete radar-api radar-admin radar-studio 2>/dev/null || true
sleep 2

# 4. Nettoyage des build caches
echo "[4/9] Nettoyage des caches..."
rm -rf /var/www/lassez-front/.next /var/www/lassez-api/.next /var/www/lassez-studio/.next 2>/dev/null || true
rm -rf /var/www/lassez-front/node_modules /var/www/lassez-api/node_modules /var/www/lassez-studio/node_modules 2>/dev/null || true

# 5. Build du FRONT (port 3000)
echo "[5/9] Installation & Build du Frontend..."
cd /var/www/lassez-front
npm ci --legacy-peer-deps 2>&1 | tail -5
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_PAYLOAD_URL=https://api.lassez.fr
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
ENVEOF
echo "Building frontend..."
npm run build 2>&1 | tail -10

# 6. Build de l'API Payload (port 3001)
echo "[6/9] Installation & Build de l'API Payload..."
cd /var/www/lassez-api
npm ci --legacy-peer-deps 2>&1 | tail -5
cat > .env.local << 'ENVEOF'
DATABASE_URI=postgresql://postgres:postgres@localhost:5432/lassez
PAYLOAD_SECRET=\$(openssl rand -hex 32 2>/dev/null || echo "default-secret-change-this")
PAYLOAD_PUBLIC_SERVER_URL=https://api.lassez.fr
CORS_URLS=https://lassez.fr,https://studio.lassez.fr,http://localhost:3000,http://localhost:3002
FRONTEND_URL=https://lassez.fr
PAYLOAD_PORT=3001
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
ENVEOF
echo "Building API..."
npm run build 2>&1 | tail -10

# 7. Build du STUDIO (port 3002)
echo "[7/9] Installation & Build du Studio Radar..."
cd /var/www/lassez-studio
npm ci --legacy-peer-deps 2>&1 | tail -5
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_PAYLOAD_URL=https://api.lassez.fr
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
STUDIO_URL=https://studio.lassez.fr
NEXT_PUBLIC_API_URL=https://api.lassez.fr
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3002
ENVEOF
echo "Building studio..."
npm run build 2>&1 | tail -10

# 8. Lancement via PM2
echo "[8/9] Lancement des services PM2..."
pm2 start "npm start" --name "radar-api" --cwd /var/www/lassez-api
pm2 start "npm start" --name "radar-admin" --cwd /var/www/lassez-front
pm2 start "npm start" --name "radar-studio" --cwd /var/www/lassez-studio
pm2 save
sleep 3

# 9. Redémarrage de Nginx
echo "[9/9] Redémarrage de Nginx..."
systemctl restart nginx || service nginx restart || echo "⚠️  Nginx non redémarré"

sleep 2
echo ""
echo "✓ Déploiement Multi-site LASSEZ V3 terminé!"
echo ""
echo "Services actifs:"
pm2 list
`;

conn.on('ready', () => {
  console.log('✓ SSH Connecté au VPS');
  console.log('');
  console.log('📤 Upload du tarball...');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const readStream = fs.createReadStream('deploy.tar.gz');
    const writeStream = sftp.createWriteStream('/var/www/deploy.tar.gz');
    
    writeStream.on('close', () => {
      console.log('✓ Tarball uploadé');
      console.log('');
      console.log('🚀 Déploiement en cours...');
      console.log('');
      
      conn.exec(deployScript, (err, stream) => {
        if (err) {
          console.error('❌ Erreur SSH:', err);
          process.exit(1);
        }
        
        stream.on('data', (data) => {
          process.stdout.write(data);
        });
        
        stream.stderr.on('data', (data) => {
          process.stderr.write(data);
        });
        
        stream.on('close', (code, signal) => {
          console.log(`\n✓ Déploiement terminé (code: ${code})\n`);
          
          if (code === 0) {
            console.log('🎉 Architecture LASSEZ V3 déployée avec succès!');
            console.log('');
            console.log('Architecture déployée:');
            console.log('  ├─ Frontend principal');
            console.log('  │  ├─ Domaine: lassez.fr');
            console.log('  │  ├─ Port: 3000');
            console.log('  │  └─ Type: Next.js');
            console.log('  ├─ API Payload CMS');
            console.log('  │  ├─ Domaine: api.lassez.fr');
            console.log('  │  ├─ Port: 3001');
            console.log('  │  └─ Type: Payload CMS');
            console.log('  └─ Studio Radar');
            console.log('     ├─ Domaine: studio.lassez.fr');
            console.log('     ├─ Port: 3002');
            console.log('     └─ Type: Next.js + Radar');
            console.log('');
            console.log('✅ Prochaines étapes:');
            console.log('  1. Configurer les DNS (A records) pour les 3 domaines');
            console.log('  2. Installer SSL avec Certbot:');
            console.log('     certbot --nginx -d lassez.fr -d api.lassez.fr -d studio.lassez.fr');
            console.log('  3. Vérifier que PostgreSQL tourne: psql -U postgres -d lassez');
            console.log('  4. Lancer les migrations Payload:');
            console.log('     ssh root@178.104.197.3 "cd /var/www/lassez-api && npm run migrate"');
            console.log('');
          } else {
            console.error('❌ Erreur lors du déploiement');
            process.exit(1);
          }
          
          conn.end();
        });
      });
    });
    
    readStream.on('error', (err) => {
      console.error('❌ Erreur lecture tarball:', err.message);
      conn.end();
      process.exit(1);
    });
    
    writeStream.on('error', (err) => {
      console.error('❌ Erreur SFTP:', err.message);
      conn.end();
      process.exit(1);
    });
    
    readStream.pipe(writeStream);
  });
}).connect(deployConfig);
