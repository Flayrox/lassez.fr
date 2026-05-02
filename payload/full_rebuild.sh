#!/bin/bash
set -e

echo "=== RECONSTRUCTION COMPLÈTE ==="

# Fonction pour build un répertoire
build_dir() {
    echo "--- Building $1 ---"
    cd "$1"
    rm -rf .next
    npm install --legacy-peer-deps
    npm run build
}

build_dir /var/www/lassez-api
build_dir /var/www/lassez-front
build_dir /var/www/lassez-studio

echo "--- Restarting All ---"
bash /tmp/start_all.sh

echo "Done!"
