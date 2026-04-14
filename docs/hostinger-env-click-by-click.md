# Hostinger Env Setup Step by Step

This is the exact setup for your current monolith architecture.

## 1. Open Hostinger panel

1. Go to Websites.
2. Open your site.
3. Open Advanced.
4. Open Node.js.
5. Open Environment Variables.

## 2. Add variables

Create keys from .env.example (canonical list), then apply Hostinger-specific overrides from .env.hostinger.example.

Use these files as sources:

- [Canonical keys](../.env.example)
- [Hostinger overrides](../.env.hostinger.example)

Minimum required keys to boot Payload:

1. NODE_ENV
2. NEXT_PUBLIC_SITE_URL
3. PAYLOAD_SERVER_URL
4. PAYLOAD_API_URL
5. CMS_PROVIDER
6. PAYLOAD_SECRET
7. DATABASE_URL

Minimum required keys for your Radar auth layer:

1. RADAR_ADMIN_USER
2. RADAR_ADMIN_PASSWORD
3. RADAR_SESSION_SECRET
4. RADAR_CACHE_SYNC_SECRET

## 3. Save and restart app

1. Save environment variables.
2. Restart Node.js app from Hostinger panel.

## 4. First runtime commands

Run in project root once the app has env variables:

1. npm install
2. npm run payload:generate:importmap
3. npm run payload:migrate
4. npm run payload:migrate:status
5. npm run payload:seed
6. npm run build

## 5. Validate URLs

1. https://api.lassez.fr/admin
2. https://api.lassez.fr/api/payload/posts
3. https://api.lassez.fr/api/payload-graphql
4. https://lassez.fr/api/wp/posts

## 6. Quick fallback if needed

If something breaks in production, set:

CMS_PROVIDER=wordpress

Then restart Node.js app.
