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

const REMOTE_DIR = '/var/www/lassez-docker';
const archiveName = 'docker_deploy.tar.gz';

async function run() {
    const commitMsg = process.argv[2] || `Auto-deploy Docker ${new Date().toISOString()}`;

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

        console.log(`\n🚀 [3/4] Connexion au VPS (${VPS_CONFIG.host}) et déploiement...`);
        const conn = new Client();
        
        await new Promise((resolve, reject) => {
            conn.on('ready', async () => {
                console.log('✓ SSH Connecté.');
                
                try {
                    // 1. SFTP Upload
                    console.log('⏳ Transfert de l\'archive...');
                    await new Promise((resolveSftp, rejectSftp) => {
                        conn.sftp((err, sftp) => {
                            if (err) return rejectSftp(err);
                            sftp.fastPut(archiveName, `/tmp/${archiveName}`, (putErr) => {
                                if (putErr) return rejectSftp(putErr);
                                console.log('✅ Archive transférée.');
                                resolveSftp();
                            });
                        });
                    });

                    // 2. Exec Script
                    console.log('🛠️ Exécution des commandes de déploiement...');
                    const deployScript = `
                        set -e
                        
                        echo "--- Préparation des dossiers ---"
                        mkdir -p ${REMOTE_DIR}
                        mkdir -p /var/www/lassez-shared/logs
                        mkdir -p /var/www/lassez-shared/prisma
                        
                        echo "--- Extraction de l'archive ---"
                        tar -xzf /tmp/${archiveName} -C ${REMOTE_DIR}
                        
                        echo "--- Configuration des Variables d'Environnement (.env) ---"
                        if [ -f "/var/www/lassez-api/.env" ]; then
                            tr -d '\\0' < /var/www/lassez-api/.env > ${REMOTE_DIR}/.env
                            echo "✓ Fichier .env copié et nettoyé (sans caractères nuls)."
                        elif [ -f "${REMOTE_DIR}/.env.vps.example" ]; then
                            cp ${REMOTE_DIR}/.env.vps.example ${REMOTE_DIR}/.env
                            echo "⚠️ Fichier .env initialisé à partir du template VPS."
                        fi
                        
                        echo "--- Build et Lancement Docker Compose ---"
                        cd ${REMOTE_DIR}
                        
                        # Reconstruction et redémarrage des services
                        docker compose build
                        docker compose up -d
                        
                        echo "--- Nettoyage des images Docker obsolètes (Prune) ---"
                        docker image prune -f
                        
                        echo "--- Nettoyage de l'archive temporaire ---"
                        rm -f /tmp/${archiveName}
                        
                        echo "✅ DÉPLOIEMENT DOCKER EFFECTUÉ AVEC SUCCÈS !"
                    `;

                    conn.exec(deployScript.replace(/\r/g, ''), (err, stream) => {
                        if (err) {
                            conn.end();
                            return reject(err);
                        }
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
                } catch (err) {
                    conn.end();
                    reject(err);
                }
            }).on('error', reject).connect({
                host: VPS_CONFIG.host,
                port: VPS_CONFIG.port,
                username: VPS_CONFIG.username,
                privateKey: fs.readFileSync(VPS_CONFIG.privateKeyPath),
            });
        });

        console.log('\n✨ TOUT EST CONTENEURISÉ ET FONCTIONNEL !');
        // Clean up local archive
        if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);

    } catch (error) {
        console.error('\n❌ ERREUR LORS DU DÉPLOIEMENT DOCKER :', error.message);
        if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);
        process.exit(1);
    }
}

run();
