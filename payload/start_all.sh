#!/bin/bash
echo "Stopping all radar processes..."
pm2 stop radar-api radar-admin radar-studio radar-daemon radar-daemon-rss 2>/dev/null || true
pm2 delete radar-api radar-admin radar-studio radar-daemon radar-daemon-rss 2>/dev/null || true

echo "Starting API (3001)..."
pm2 start npm --cwd /var/www/lassez-api --name "radar-api" -- start -- -p 3001

echo "Starting Admin/Front (3000)..."
pm2 start npm --cwd /var/www/lassez-front --name "radar-admin" -- start -- -p 3000

echo "Starting Studio (3002)..."
pm2 start npm --cwd /var/www/lassez-studio --name "radar-studio" -- start -- -p 3002

echo "Starting Daemons..."
pm2 start /var/www/lassez-api/ecosystem.config.cjs --only radar-daemon,radar-daemon-rss

pm2 save
pm2 list
