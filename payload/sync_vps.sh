#!/bin/bash
export GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_github -o StrictHostKeyChecking=no"
echo "--- Syncing repository ---"
cd /var/www/lassez-repo
git fetch origin main
git reset --hard origin/main

echo "--- Copying files ---"
cp -r /var/www/lassez-repo/* /var/www/lassez-api/
cp -r /var/www/lassez-repo/* /var/www/lassez-front/
cp -r /var/www/lassez-repo/* /var/www/lassez-studio/

echo "--- Building API ---"
cd /var/www/lassez-api
npm install
npm run build

echo "--- Restarting PM2 ---"
pm2 restart radar-api radar-studio radar-admin
pm2 list
