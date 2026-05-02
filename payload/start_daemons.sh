#!/bin/bash
pm2 start /var/www/lassez-api/radar_lassez/daemon.js --name "radar-daemon" --cwd /var/www/lassez-api
pm2 start /var/www/lassez-api/radar_lassez/daemon_rss.js --name "radar-daemon-rss" --cwd /var/www/lassez-api
pm2 list
