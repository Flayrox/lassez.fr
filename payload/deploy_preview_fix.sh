#!/bin/bash
set -e

echo "=== Syncing posts.ts fix to VPS and rebuilding ==="

# Pull latest code from git
cd /var/www/lassez-api
git fetch origin main
git reset --hard origin/main

# Install @google/genai if needed
npm install @google/genai --legacy-peer-deps

# Rebuild
npm run build

echo "=== Restarting radar-api ==="
pm2 restart radar-api

echo "=== Done ==="
pm2 list
