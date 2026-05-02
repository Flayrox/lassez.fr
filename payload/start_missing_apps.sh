#!/bin/bash
pm2 start npm --cwd /var/www/lassez-api --name "radar-api" -- start -- -p 3001
pm2 start npm --cwd /var/www/lassez-front --name "radar-admin" -- start -- -p 3000
pm2 save
pm2 list
