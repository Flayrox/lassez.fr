const { Client } = require('ssh2');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const host = required('VPS_HOST');
const username = required('VPS_USER');
const privateKey = required('VPS_SSH_KEY');
const remoteDir = process.env.VPS_REMOTE_DIR || '/var/www/lassez-prod';
const branch = process.env.VPS_GIT_BRANCH || 'main';
const port = Number(process.env.VPS_PORT || '22');

const installCommand = process.env.VPS_INSTALL_COMMAND || 'npm ci';
const buildCommand = process.env.VPS_BUILD_COMMAND || 'npm run build';
const restartCommand = process.env.VPS_RESTART_COMMAND || 'pm2 startOrReload ecosystem.config.cjs ; pm2 save';

const remoteScript = [
  `set -e`,
  `cd ${remoteDir}`,
  `git fetch origin ${branch}`,
  `git checkout ${branch}`,
  `git reset --hard origin/${branch}`,
  installCommand,
  `npx prisma generate`,
  `npx prisma db push --accept-data-loss`,
  buildCommand,
  restartCommand,
  `echo DEPLOY_OK`
].join(' ; ');

const conn = new Client();

conn.on('ready', () => {
  console.log(`[deploy] SSH ready: ${username}@${host}:${port}`);

  conn.exec(remoteScript, (err, stream) => {
    if (err) {
      conn.end();
      throw err;
    }

    stream
      .on('close', (code) => {
        console.log(`[deploy] remote exit code: ${code}`);
        conn.end();
        process.exit(code === 0 ? 0 : 1);
      })
      .on('data', (data) => {
        process.stdout.write(String(data));
      })
      .stderr.on('data', (data) => {
        process.stderr.write(String(data));
      });
  });
});

conn.on('error', (err) => {
  console.error('[deploy] ssh error:', err.message);
  process.exit(1);
});

conn.connect({
  host,
  port,
  username,
  privateKey,
});
