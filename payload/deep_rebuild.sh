#!/bin/bash
set -e

echo "=== FIXING DEPENDENCIES AND BUILDING ALL ==="

fix_and_build() {
    echo "--- Processing $1 ---"
    cd "$1"
    rm -rf .next
    rm -rf node_modules
    rm -f package-lock.json
    npm install --legacy-peer-deps
    npm run build
}

fix_and_build /var/www/lassez-api
fix_and_build /var/www/lassez-front
fix_and_build /var/www/lassez-studio

bash /tmp/start_all.sh
