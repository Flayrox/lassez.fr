// Accorde le rôle 'admin' à un auteur Payload sur le VPS.
//
// Usage :
//   node scripts/grant_admin.cjs email@exemple.com
//
// Variables d'environnement requises :
//   DATABASE_URL   URL Postgres Supabase (Payload) — ex: postgresql://user:pass@host:5432/postgres
//   VPS_HOST       (défaut 178.104.197.3)  |  VPS_USER (défaut root)
//   VPS_SSH_KEY ou ~/.ssh/id_ed25519  (clé SSH du VPS)
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const email = process.argv[2] || process.env.GRANT_ADMIN_EMAIL;
const databaseUrl = process.env.DATABASE_URL;
const sshHost = process.env.VPS_HOST || '178.104.197.3';
const sshUser = process.env.VPS_USER || 'root';
const sshKey = process.env.VPS_SSH_KEY || path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');

if (!email || !databaseUrl) {
  console.error('Usage: node scripts/grant_admin.cjs <email>   (avec DATABASE_URL dans l’environnement)');
  process.exit(1);
}

if (!fs.existsSync(sshKey)) {
  console.error(`Clé SSH introuvable : ${sshKey}`);
  process.exit(1);
}

const conn = new Client();

conn.on('ready', () => {
  const escapedEmail = email.replace(/'/g, "''");
  conn.exec(
    `psql "${databaseUrl}" -c "SELECT id FROM authors WHERE email = '${escapedEmail}';"`,
    (err, stream) => {
      if (err) throw err;
      let output = '';
      stream.on('data', (data) => (output += data));
      stream.on('close', () => {
        console.log(output);
        const match = output.match(/\s+(\d+)\s+/);
        if (match) {
          const id = match[1];
          console.log(`Found ID: ${id}. Adding admin role...`);
          conn.exec(
            `psql "${databaseUrl}" -c "INSERT INTO authors_roles (parent_id, value, \\"order\\") VALUES (${id}, 'admin', 0) ON CONFLICT DO NOTHING;"`,
            (err2, stream2) => {
              if (err2) throw err2;
              stream2.on('data', (data) => process.stdout.write(data));
              stream2.on('close', () => conn.end());
            }
          );
        } else {
          console.log('Author not found.');
          conn.end();
        }
      });
    }
  );
}).connect({
  host: sshHost,
  port: 22,
  username: sshUser,
  privateKey: fs.readFileSync(sshKey),
});
