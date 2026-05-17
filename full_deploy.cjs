const { execSync } = require('child_process');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const VPS_CONFIG = {
    host: '178.104.197.3',
    port: 22,
    username: 'root',
    privateKeyPath: path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519'),
};

const REMOTE_PATHS = {
    unpack: '/tmp/lassez-unpack',
    front: '/var/www/lassez-front',
    api: '/var/www/lassez-api',
    studio: '/var/www/lassez-studio',
};

const archiveName = 'local_deploy.tar.gz';

async function run() {
    const commitMsg = process.argv[2] || `Auto-deploy ${new Date().toISOString()}`;

    try {
        console.log('📦 [1/4] Git : Commit et Push...');
        try {
            execSync('git add .');
            execSync(`git commit -m "${commitMsg}"`);
            execSync('git push');
            console.log('✅ Git synchronisé.');
        } catch (e) {
            console.log('⚠️ Git : Rien à commit ou erreur push (continuons le déploiement VPS).');
        }

        console.log(`\n🗜️ [2/4] Préparation de l'archive ${archiveName}...`);
        if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);
        execSync(`tar -czf ${archiveName} --exclude=node_modules --exclude=.git --exclude=.next --exclude=.gemini --exclude=daemon*.log --exclude=media --exclude=deploy.tar.gz --exclude=lassez-deploy.tar.gz --exclude=*.db --exclude=*.db-journal --exclude=${archiveName} .`);
        console.log('✅ Archive créée.');

        console.log(`\n🚀 [3/4] Transfert vers le VPS (${VPS_CONFIG.host})...`);
        const conn = new Client();
        
        await new Promise((resolve, reject) => {
            conn.on('ready', () => {
                console.log('✓ SSH Connecté.');
                conn.sftp((err, sftp) => {
                    if (err) return reject(err);
                    const readStream = fs.createReadStream(archiveName);
                    const writeStream = sftp.createWriteStream(`/tmp/${archiveName}`);
                    
                    writeStream.on('close', () => {
                        console.log('✅ Archive transférée.');
                        resolve();
                    });
                    readStream.pipe(writeStream);
                });
            }).on('error', reject).connect({
                host: VPS_CONFIG.host,
                port: VPS_CONFIG.port,
                username: VPS_CONFIG.username,
                privateKey: fs.readFileSync(VPS_CONFIG.privateKeyPath),
            });
        });

        console.log('\n🛠️ [4/4] Exécution du déploiement sur le VPS...');
        
        const deployScript = `
            set -e
            
            echo "--- Backing up Active Production Database ---"
            # We backup the front-end's database as it holds the active 174 topics and custom user prompts/settings
            if [ -f "${REMOTE_PATHS.front}/prisma/radar.db" ]; then
                cp "${REMOTE_PATHS.front}/prisma/radar.db" /tmp/radar_prod.db
                echo "✓ Active production database backed up to /tmp/radar_prod.db"
            elif [ -f "${REMOTE_PATHS.api}/prisma/radar.db" ]; then
                cp "${REMOTE_PATHS.api}/prisma/radar.db" /tmp/radar_prod.db
                echo "✓ API database backed up to /tmp/radar_prod.db as fallback"
            else
                echo "⚠️ No active database found on VPS to backup!"
            fi

            echo "--- Unpacking ---"
            rm -rf ${REMOTE_PATHS.unpack}
            mkdir -p ${REMOTE_PATHS.unpack}
            tar -xzf /tmp/${archiveName} -C ${REMOTE_PATHS.unpack}
            
            echo "--- Distributing to API ---"
            cp -r ${REMOTE_PATHS.unpack}/* ${REMOTE_PATHS.api}/
            
            echo "--- Distributing to Front ---"
            cp -r ${REMOTE_PATHS.unpack}/* ${REMOTE_PATHS.front}/
            
            echo "--- Distributing to Studio ---"
            cp -r ${REMOTE_PATHS.unpack}/* ${REMOTE_PATHS.studio}/
            
            echo "--- Preparing Clean Build Directories ---"
            # Next.js Turbopack compiles at build-time and crashes if it scans symlinks that point outside
            # the project root folder. We keep clean, normal folders during build, and symlink them AFTER the build completes.
            
            # API Setup
            mkdir -p ${REMOTE_PATHS.api}/prisma
            if [ -f /tmp/radar_prod.db ]; then
                cp /tmp/radar_prod.db ${REMOTE_PATHS.api}/prisma/radar.db
                echo "✓ Primary database placed in API folder"
            fi
            mkdir -p ${REMOTE_PATHS.api}/logs

            # Front Build Prep (Normal folders/files, NO out-of-bounds symlinks during build)
            rm -rf ${REMOTE_PATHS.front}/logs
            mkdir -p ${REMOTE_PATHS.front}/logs
            rm -f ${REMOTE_PATHS.front}/prisma/radar.db
            rm -f ${REMOTE_PATHS.front}/prisma/radar.db-journal
            touch ${REMOTE_PATHS.front}/prisma/radar.db
            
            # Studio Build Prep
            rm -rf ${REMOTE_PATHS.studio}/logs
            mkdir -p ${REMOTE_PATHS.studio}/logs
            rm -f ${REMOTE_PATHS.studio}/prisma/radar.db
            rm -f ${REMOTE_PATHS.studio}/prisma/radar.db-journal
            touch ${REMOTE_PATHS.studio}/prisma/radar.db
            
            echo "--- Building API & Migrating ---"
            cd ${REMOTE_PATHS.api}
            npm install --production=false
            npm run build
            npm run payload:migrate || echo "Migrations déjà faites"
            
            echo "--- Building Front ---"
            cd ${REMOTE_PATHS.front}
            npm install --production=false
            npm run build
            
            echo "--- Building Studio ---"
            cd ${REMOTE_PATHS.studio}
            npm install --production=false
            npm run build
            
            echo "--- Establishing Runtime Symlinks (Post-Build) ---"
            # 1. Symlink Databases
            rm -f ${REMOTE_PATHS.front}/prisma/radar.db
            ln -sf ${REMOTE_PATHS.api}/prisma/radar.db ${REMOTE_PATHS.front}/prisma/radar.db
            echo "✓ Linked Front database to API database"
            
            rm -f ${REMOTE_PATHS.studio}/prisma/radar.db
            ln -sf ${REMOTE_PATHS.api}/prisma/radar.db ${REMOTE_PATHS.studio}/prisma/radar.db
            echo "✓ Linked Studio database to API database"
            
            # 2. Symlink Logs
            rm -rf ${REMOTE_PATHS.front}/logs
            ln -sf ${REMOTE_PATHS.api}/logs ${REMOTE_PATHS.front}/logs
            echo "✓ Symlinked Front logs to API logs"
            
            rm -rf ${REMOTE_PATHS.studio}/logs
            ln -sf ${REMOTE_PATHS.api}/logs ${REMOTE_PATHS.studio}/logs
            echo "✓ Symlinked Studio logs to API logs"
            
            echo "--- Restarting All Services (PM2) ---"
            cd ${REMOTE_PATHS.api}
            pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --update-env
            pm2 save
            
            echo "--- Cleanup ---"
            rm -f /tmp/${archiveName}
            rm -rf ${REMOTE_PATHS.unpack}
            rm -f /tmp/radar_prod.db
            
            echo "✅ DÉPLOIEMENT ET SYNCHRONISATION TERMINÉS AVEC SUCCÈS !"
        `;

        await new Promise((resolve, reject) => {
            conn.exec(deployScript, (err, stream) => {
                if (err) return reject(err);
                stream.on('close', (code) => {
                    conn.end();
                    if (code === 0) resolve();
                    else reject(new Error(`Deployment failed with code ${code}`));
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        });

        console.log('\n✨ TOUT EST PRÊT !');

    } catch (error) {
        console.error('\n❌ ERREUR LORS DU DÉPLOIEMENT :', error.message);
        process.exit(1);
    }
}

run();