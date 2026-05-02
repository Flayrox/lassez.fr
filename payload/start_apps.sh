#!/bin/bash
pm2 start npm --cwd /var/www/lassez-api --name "radar-api" -- start -- -p 3001
pm2 start npm --cwd /var/www/lassez-studio --name "radar-studio" -- start -- -p 3002
pm2 save
pm2 list
