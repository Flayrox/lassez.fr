#!/bin/bash
set -e

echo "=== Patching .env.local files on VPS ==="

patch_env() {
    local env_file="$1"
    
    # Add NEXT_PUBLIC_SITE_URL if missing
    if ! grep -q "NEXT_PUBLIC_SITE_URL" "$env_file"; then
        echo "NEXT_PUBLIC_SITE_URL=https://lassez.fr" >> "$env_file"
        echo "Added NEXT_PUBLIC_SITE_URL to $env_file"
    else
        # Ensure it's set to production URL
        sed -i 's|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://lassez.fr|' "$env_file"
        echo "Updated NEXT_PUBLIC_SITE_URL in $env_file"
    fi

    # Add PAYLOAD_PREVIEW_SITE_URL if missing
    if ! grep -q "PAYLOAD_PREVIEW_SITE_URL" "$env_file"; then
        echo "PAYLOAD_PREVIEW_SITE_URL=https://lassez.fr" >> "$env_file"
        echo "Added PAYLOAD_PREVIEW_SITE_URL to $env_file"
    else
        sed -i 's|PAYLOAD_PREVIEW_SITE_URL=.*|PAYLOAD_PREVIEW_SITE_URL=https://lassez.fr|' "$env_file"
        echo "Updated PAYLOAD_PREVIEW_SITE_URL in $env_file"
    fi
}

patch_env /var/www/lassez-api/.env.local
patch_env /var/www/lassez-front/.env.local
patch_env /var/www/lassez-studio/.env.local

echo "=== Patched env files ==="
cat /var/www/lassez-api/.env.local
