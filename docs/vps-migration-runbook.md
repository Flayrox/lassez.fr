# VPS Migration Runbook (Lassez + Studio + Payload)

## Goal
Run `lassez.fr`, `studio.lassez.fr`, and `api.lassez.fr` on one VPS with:
- one Next.js process (`radar-admin`)
- one daemon process (`radar-daemon`)
- Nginx reverse proxy + TLS

## 1. DNS Changes (your side)
In your DNS provider panel:
1. Create/update `A` record `@` -> `VPS_IP`
2. Create/update `A` record `studio` -> `VPS_IP`
3. Create/update `A` record `api` -> `VPS_IP`
4. Set TTL to `300` during migration
5. Remove `AAAA` if VPS has no IPv6

If using Cloudflare: start with DNS-only mode.

## 2. VPS bootstrap
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 3. App deployment layout
```bash
sudo mkdir -p /var/www/lassez-prod
sudo chown -R $USER:$USER /var/www/lassez-prod
cd /var/www/lassez-prod
git clone <YOUR_REPO_URL> .
cp .env.vps.example .env
# edit .env with real secrets
npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs
pm2 save
```

## 4. Nginx setup
1. Copy template from `docs/vps-nginx-lassez.conf.example` to `/etc/nginx/sites-available/lassez.conf`
2. Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/lassez.conf /etc/nginx/sites-enabled/lassez.conf
sudo nginx -t
sudo systemctl reload nginx
```
3. Issue cert:
```bash
sudo certbot --nginx -d lassez.fr -d www.lassez.fr -d studio.lassez.fr -d api.lassez.fr
```

## 5. Validation checks
```bash
curl -I https://lassez.fr
curl -I https://studio.lassez.fr/radar-login
curl -I https://api.lassez.fr/api/payload/access
curl -I https://api.lassez.fr/admin
```

Then browser checks:
1. `https://api.lassez.fr/admin/create-first-user`
2. `https://studio.lassez.fr/radar-admin`
3. `https://lassez.fr`

## 6. Deploy helper usage (from local machine)
Set env vars then run:
```powershell
$env:VPS_HOST="your.vps.ip"
$env:VPS_USER="root"
$env:VPS_SSH_KEY=(Get-Content "$HOME/.ssh/id_ed25519" -Raw)
$env:VPS_REMOTE_DIR="/var/www/lassez-prod"
npm run deploy:vps
```

## 7. Rollback
If needed, point DNS back to previous host.
Keep old infra intact for at least 72h after cutover.
