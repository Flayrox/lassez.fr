#!/bin/bash
nginx -T 2>/dev/null | grep -A 10 "server_name api.lassez.fr"
