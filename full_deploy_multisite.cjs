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

const deployScript = `
set -e

echo "=== DÉPLOIEMENT COMPLET LASSEZ V3 ==="
echo ""

# 1. Configuration des répertoires
echo "[1/8] Préparation des répertoires..."
mkdir -p /var/www/lassez-front
mkdir -p /var/www/lassez-api
mkdir -p /var/www/lassez-studio

# 2. Clone/Pull du repository
echo "[2/8] Mise à jour du repository..."
cd /var/www
if [ ! -d "lassez-repo" ]; then
  git clone https://github.com/Flayrox/LASSEZ.git lassez-repo
else
  cd lassez-repo
  git pull origin main
  cd /var/www
fi

# 3. Copie des fichiers vers les répertoires appropriés
echo "[3/8] Distribution des fichiers..."
cp -r /var/www/lassez-repo/* /var/www/lassez-front/
cp -r /var/www/lassez-repo/* /var/www/lassez-api/
cp -r /var/www/lassez-repo/* /var/www/lassez-studio/

# 4. Arrêt des anciens processus
echo "[4/8] Arrêt des anciens processus..."
pm2 stop radar-admin radar-api radar-studio radar-daemon 2>/dev/null || true
pm2 delete radar-admin radar-api radar-studio 2>/dev/null || true

# 5. Installation et build du FRONT (lassez.fr)
echo "[5/8] Build du Frontend..."
cd /var/www/lassez-front
npm install
cat > .env.local << 'EOF'
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
NODE_ENV=production
EOF
npm run build

# 6. Installation et build de l'API (api.lassez.fr - Payload)
echo "[6/8] Build de l'API Payload..."
cd /var/www/lassez-api
npm install
cat > .env.local << 'EOF'
DATABASE_URI=postgresql://postgres:postgres@localhost:5432/lassez
PAYLOAD_SECRET=\$(openssl rand -hex 32)
CORS_URLS=https://lassez.fr,https://studio.lassez.fr
FRONTEND_URL=https://lassez.fr
PAYLOAD_PORT=3001
NODE_ENV=production
EOF
npm run build

# 7. Installation de STUDIO (studio.lassez.fr - Radar)
echo "[7/8] Préparation du Studio Radar..."
cd /var/www/lassez-studio
npm install
cat > .env.local << 'EOF'
PAYLOAD_URL=https://api.lassez.fr
FRONTEND_URL=https://lassez.fr
STUDIO_URL=https://studio.lassez.fr
NEXT_PUBLIC_API_URL=https://api.lassez.fr
NODE_ENV=production
EOF
npm run build

# 8. Lancement via PM2
echo "[8/8] Lancement des services..."
pm2 start npm --cwd /var/www/lassez-api --name "radar-api" -- start
pm2 start npm --cwd /var/www/lassez-front --name "radar-admin" -- start
pm2 start npm --cwd /var/www/lassez-studio --name "radar-studio" -- start
pm2 save

echo ""
echo "✓ Déploiement terminé!"
echo ""
echo "Services lancés:"
pm2 list
`;

conn.on('ready', () => {
  console.log('✓ SSH Connecté');
  
  conn.exec(deployScript, (err, stream) => {
    if (err) {
      console.error('Erreur SSH:', err);
      process.exit(1);
    }
    
    let output = '';
    let errorOutput = '';
    
    stream.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    stream.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });
    
    stream.on('close', (code, signal) => {
      console.log(`\n\n=== Déploiement terminé (code: ${code}) ===\n`);
      
      if (code === 0) {
        console.log('✓ Architecture déployée avec succès!');
        console.log('');
        console.log('Domaines configurés:');
        console.log('  - Frontend:  https://lassez.fr (port 3000)');
        console.log('  - API:       https://api.lassez.fr (port 3001)');
        console.log('  - Studio:    https://studio.lassez.fr (port 3002)');
        console.log('');
        console.log('⚠️  Important: Configurez Nginx/Apache pour router les domaines vers les bons ports!');
      } else {
        console.error('❌ Erreur lors du déploiement');
        process.exit(1);
      }
      
      conn.end();
    });
  });
}).connect(deployConfig);
