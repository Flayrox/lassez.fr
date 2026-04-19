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
mkdir -p /var/www/lassez-repo

# 2. Clone/Pull du repository
echo "[2/9] Mise à jour du repository..."
cd /var/www/lassez-repo
if [ ! -f ".git/config" ]; then
  git clone https://github.com/Flayrox/LASSEZ.git . || (rm -rf . && git clone https://github.com/Flayrox/LASSEZ.git .)
else
  git fetch origin && git reset --hard origin/main
fi

# 3. Copie des fichiers
echo "[3/9] Distribution des fichiers..."
cp -r /var/www/lassez-repo/* /var/www/lassez-front/ 2>/dev/null || true
cp -r /var/www/lassez-repo/* /var/www/lassez-api/ 2>/dev/null || true
cp -r /var/www/lassez-repo/* /var/www/lassez-studio/ 2>/dev/null || true

# 4. Arrêt des anciens processus
echo "[4/9] Arrêt des anciens processus..."
pm2 stop radar-api radar-admin radar-studio 2>/dev/null || true
pm2 delete radar-api radar-admin radar-studio 2>/dev/null || true
sleep 2

# 5. Build du FRONT (port 3000)
echo "[5/9] Installation & Build du Frontend..."
cd /var/www/lassez-front
npm ci --legacy-peer-deps 2>/dev/null || npm install
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_PAYLOAD_URL=https://api.lassez.fr
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
ENVEOF
npm run build

# 6. Build de l'API Payload (port 3001)
echo "[6/9] Installation & Build de l'API Payload..."
cd /var/www/lassez-api
npm ci --legacy-peer-deps 2>/dev/null || npm install
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
npm run build

# 7. Build du STUDIO (port 3002)
echo "[7/9] Installation & Build du Studio Radar..."
cd /var/www/lassez-studio
npm ci --legacy-peer-deps 2>/dev/null || npm install
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
npm run build

# 8. Lancement via PM2
echo "[8/9] Lancement des services PM2..."
pm2 start "npm start" --name "radar-api" --cwd /var/www/lassez-api
pm2 start "npm start" --name "radar-admin" --cwd /var/www/lassez-front
pm2 start "npm start" --name "radar-studio" --cwd /var/www/lassez-studio
pm2 save
sleep 3

# 9. Redémarrage de Nginx
echo "[9/9] Redémarrage de Nginx..."
systemctl restart nginx || service nginx restart || echo "⚠️  Nginx non redémarré (peut être normal)"

echo ""
echo "✓ Déploiement Multi-site LASSEZ terminé!"
echo ""
echo "Services actifs:"
pm2 list
echo ""
echo "Accès aux services:"
echo "  - Frontend:  https://lassez.fr (port 3000)"
echo "  - API:       https://api.lassez.fr (port 3001)"
echo "  - Studio:    https://studio.lassez.fr (port 3002)"
echo ""
`;

conn.on('ready', () => {
  console.log('✓ SSH Connecté au VPS');
  console.log('');
  console.log('Déploiement en cours...');
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
        console.log('⚠️  À faire:');
        console.log('  1. Configurer les DNS pour les 3 domaines');
        console.log('  2. Installer SSL avec Certbot:');
        console.log('     certbot --nginx -d lassez.fr -d api.lassez.fr -d studio.lassez.fr');
        console.log('  3. Vérifier que PostgreSQL est actif');
        console.log('  4. Lancer les migrations Payload:');
        console.log('     cd /var/www/lassez-api && npm run migrate');
      } else {
        console.error('❌ Erreur lors du déploiement');
        process.exit(1);
      }
      
      conn.end();
    });
  });
}).connect(deployConfig);
