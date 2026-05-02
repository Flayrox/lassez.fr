#!/bin/bash
set -e
echo "--- Building API ---"
cd /var/www/lassez-api && npm run build
echo "--- Building Front ---"
cd /var/www/lassez-front && npm run build
echo "--- Building Studio ---"
cd /var/www/lassez-studio && npm run build
echo "--- Restarting All ---"
bash /tmp/start_all.sh
