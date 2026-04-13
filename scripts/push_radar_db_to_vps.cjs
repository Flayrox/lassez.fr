const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = process.env.VPS_HOST || '116.203.158.47';
const port = Number(process.env.VPS_PORT || 22);
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD || 'wung7vNXJePU';

const localDb = path.join(process.cwd(), 'radar_lassez', 'radar.db');
const remoteDir = '/var/www/radar-studio/radar_lassez';
const remoteDb = `${remoteDir}/radar.db`;
const remoteTmp = `${remoteDir}/radar.db.upload`;

if (!fs.existsSync(localDb)) {
  console.error(`[DB-PUSH] Local DB not found: ${localDb}`);
  process.exit(1);
}

const conn = new Client();

function runRemote(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Remote command failed (${code}): ${stderr || stdout}`));
        }
        resolve({ stdout, stderr });
      });
      stream.on('data', (d) => {
        stdout += d.toString();
        process.stdout.write(d.toString());
      });
      stream.stderr.on('data', (d) => {
        stderr += d.toString();
        process.stderr.write(d.toString());
      });
    });
  });
}

function uploadFile(localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, (putErr) => {
        if (putErr) return reject(putErr);
        resolve();
      });
    });
  });
}

conn
  .on('ready', async () => {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      console.log('[DB-PUSH] Connected to VPS.');

      await runRemote(`set -e; mkdir -p ${remoteDir}/backups`);
      await runRemote(`set -e; pm2 stop radar-daemon || true`);
      await runRemote(`set -e; if [ -f ${remoteDb} ]; then cp ${remoteDb} ${remoteDir}/backups/radar.db.before-push.${ts}; fi`);

      console.log('[DB-PUSH] Uploading local radar.db...');
      await uploadFile(localDb, remoteTmp);

      await runRemote(`set -e; mv ${remoteTmp} ${remoteDb}; chmod 600 ${remoteDb} || true`);
      await runRemote(`set -e; pm2 start radar-daemon || pm2 restart radar-daemon`);
      await runRemote(`set -e; pm2 restart radar-admin || true`);
      await runRemote(`set -e; ls -lh ${remoteDb}; ls -lh ${remoteDir}/backups | tail -n 3`);

      console.log('[DB-PUSH] DB transfer completed successfully.');
      conn.end();
    } catch (e) {
      console.error('[DB-PUSH] Failed:', e.message);
      try { await runRemote('pm2 start radar-daemon || true'); } catch (_) {}
      conn.end();
      process.exit(1);
    }
  })
  .on('error', (e) => {
    console.error('[DB-PUSH] SSH connection error:', e.message);
    process.exit(1);
  })
  .connect({ host, port, username, password });
