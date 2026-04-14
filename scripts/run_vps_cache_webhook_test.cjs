const { Client } = require('ssh2');

const secret = process.env.RADAR_CACHE_SYNC_SECRET;
const url = process.env.RADAR_CACHE_SYNC_WEBHOOK_URL || 'https://lassez.fr/api/internal/cache-sync';
const sshHost = process.env.RADAR_SSH_HOST;
const sshPort = Number(process.env.RADAR_SSH_PORT || '22');
const sshUser = process.env.RADAR_SSH_USER;
const sshPassword = process.env.RADAR_SSH_PASSWORD;

if (!secret || !sshHost || !sshUser || !sshPassword) {
  console.error('Missing RADAR_CACHE_SYNC_SECRET, RADAR_SSH_HOST, RADAR_SSH_USER or RADAR_SSH_PASSWORD');
  process.exit(1);
}

const nodeInline = [
  "const crypto=require('crypto');",
  "(async()=>{",
  "const ts=Date.now().toString();",
  "const nonce=crypto.randomUUID();",
  "const requestId=crypto.randomUUID();",
  "const body=JSON.stringify({event:'manual.revalidate',source:'vps-manual-test',sent_at:new Date().toISOString(),request_id:requestId,tags:['radar-config','wp-posts','wp-categories'],paths:['/']});",
  "const sig=crypto.createHmac('sha256', process.env.RADAR_CACHE_SYNC_SECRET).update(ts+'.'+nonce+'.'+body).digest('hex');",
  "const res=await fetch(process.env.RADAR_CACHE_SYNC_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Timestamp':ts,'X-Radar-Nonce':nonce,'X-Radar-Signature':sig,'X-Radar-Event':'manual.revalidate','X-Radar-Source':'vps-manual-test','X-Radar-Idempotency-Key':requestId},body});",
  "const txt=await res.text();",
  "console.log('STATUS',res.status);",
  "console.log('BODY',txt);",
  "})();"
].join('');

const remoteCommand = `cd /var/www/radar-studio && RADAR_CACHE_SYNC_WEBHOOK_URL='${url}' RADAR_CACHE_SYNC_SECRET='${secret}' node -e \"${nodeInline.replace(/\"/g, '\\\\"')}\"`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(remoteCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stdout.write(data.toString()));
  });
}).connect({
  host: sshHost,
  port: sshPort,
  username: sshUser,
  password: sshPassword
});
