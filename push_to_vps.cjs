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

const localArchivePath = path.join(__dirname, 'local_deploy.tar.gz');
const remoteArchivePath = '/tmp/local_deploy.tar.gz';

const deployScript = `
set -e

echo "=== DÉPLOIEMENT LOCAL VERS VPS (RBAC UPDATE) ==="
echo ""

# 1. Préparation des répertoires
echo "[1/7] Préparation des répertoires..."
mkdir -p /var/www/lassez-front /var/www/lassez-api /var/www/lassez-studio /tmp/lassez-unpack

# 2. Décompression de l'archive locale
echo "[2/7] Décompression de l'archive..."
rm -rf /tmp/lassez-unpack/*
tar -xzf ${remoteArchivePath} -C /tmp/lassez-unpack

# 3. Distribution des fichiers
echo "[3/7] Distribution des fichiers vers les 3 instances..."
# On utilise rsync ou cp pour mettre à jour sans tout supprimer (on garde node_modules si possible pour aller plus vite)
cp -r /tmp/lassez-unpack/* /var/www/lassez-front/
cp -r /tmp/lassez-unpack/* /var/www/lassez-api/
cp -r /tmp/lassez-unpack/* /var/www/lassez-studio/

# 4. Mise à jour des dépendances et Build
echo "[4/7] Installation des dépendances et Build (cela peut prendre quelques minutes)..."

build_app() {
  local dir=$1
  local name=$2
  local port=$3
  echo "--- Building $name ($port) ---"
  cd $dir
  # On garde les node_modules existants pour accélérer, mais on s'assure que tout est là
  npm install --prefer-offline --no-audit
  npm run build
}

build_app /var/www/lassez-api "API" 3001
build_app /var/www/lassez-front "Front" 3000
build_app /var/www/lassez-studio "Studio" 3002

# 5. Vérification des fichiers .env.local
echo "[5/7] Configuration des environnements..."

# API
cat > /var/www/lassez-api/.env.local << 'ENVEOF'
DATABASE_URL=postgresql://postgres:wPwAMQTJwB1WTBXF@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres
PAYLOAD_SECRET=lassez_prod_fixed_secret_32_chars_min
PAYLOAD_PUBLIC_SERVER_URL=https://api.lassez.fr
CORS_URLS=https://lassez.fr,https://studio.lassez.fr,http://localhost:3000,http://localhost:3002
FRONTEND_URL=https://lassez.fr
PORT=3001
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
ENVEOF

# FRONT
cat > /var/www/lassez-front/.env.local << 'ENVEOF'
NEXT_PUBLIC_PAYLOAD_URL=https://api.lassez.fr
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
PORT=3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
ENVEOF

# STUDIO
cat > /var/www/lassez-studio/.env.local << 'ENVEOF'
NEXT_PUBLIC_PAYLOAD_URL=https://api.lassez.fr
PAYLOAD_URL=http://localhost:3001
FRONTEND_URL=https://lassez.fr
STUDIO_URL=https://studio.lassez.fr
NEXT_PUBLIC_API_URL=https://api.lassez.fr
PORT=3002
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
ENVEOF

# 6. Migrations et Redémarrage PM2
echo "[6/7] Exécution des migrations et redémarrage PM2..."
cd /var/www/lassez-api
npm run payload:migrate || echo "⚠️ Migration échouée ou déjà faite"
pm2 restart radar-api radar-admin radar-studio radar-daemon radar-daemon-rss || pm2 start /var/www/lassez-api/ecosystem.config.cjs
echo "[7/7] Nettoyage..."
rm ${remoteArchivePath}
rm -rf /tmp/lassez-unpack

echo ""
echo "✓ Déploiement terminé avec succès sur les ports 3000, 3001, 3002!"
echo ""
pm2 list
`;

conn.on('ready', () => {
  console.log('✓ SSH Connecté au VPS');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    console.log('Uploading local_deploy.tar.gz...');
    sftp.fastPut(localArchivePath, remoteArchivePath, (err) => {
      if (err) {
        console.error('❌ Erreur lors du transfert:', err);
        conn.end();
        return;
      }
      
      console.log('✓ Archive transférée. Lancement du script de déploiement...');
      
      conn.exec(deployScript, (err, stream) => {
        if (err) {
          console.error('❌ Erreur SSH:', err);
          conn.end();
          return;
        }
        
        stream.on('data', (data) => {
          process.stdout.write(data);
        });
        
        stream.stderr.on('data', (data) => {
          process.stderr.write(data);
        });
        
        stream.on('close', (code, signal) => {
          console.log(`\n✓ Déploiement terminé (code: ${code})\n`);
          conn.end();
        });
      });
    });
  });
}).connect(deployConfig);
