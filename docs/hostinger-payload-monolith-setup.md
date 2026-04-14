# Hostinger Payload Monolith Setup

This project now runs Payload in the same Next.js process (single build, single port), compatible with Hostinger Business Node.js managed hosting.

## 1) What is already implemented

- Payload App Router integration is present in app/(payload)
- Admin route: /admin
- REST route base: /api/payload
- GraphQL route: /api/payload-graphql
- GraphQL playground route: /api/payload-graphql-playground
- Payload is configured for Postgres via @payloadcms/db-postgres
- Next config is wrapped with withPayload

## 2) Required environment variables on Hostinger

Copy values from .env.example and set them in Hostinger environment settings.

Minimum required:

- PAYLOAD_SECRET
- PAYLOAD_SERVER_URL
- DATABASE_URL
- NEXT_PUBLIC_SITE_URL
- CMS_PROVIDER=payload

Recommended:

- PAYLOAD_API_URL
- RADAR_CACHE_SYNC_SECRET
- RADAR_CACHE_SYNC_ENFORCE_IPS
- RADAR_CACHE_SYNC_ALLOWED_IPS

## 3) Supabase connection notes

Use your Supabase Postgres URL.

Provided direct host example:

postgresql://postgres:YOUR_PASSWORD@db.gdmvxijcxzcuassezrwy.supabase.co:5432/postgres

If your Hostinger environment has IPv4 limitations, use the Supabase Session Pooler URL from Supabase dashboard instead.

## 4) One-time commands after deployment

Run in project root:

npm install
npm run payload:generate:importmap
npm run payload:migrate
npm run payload:migrate:status
npm run payload:seed
npm run build

## 5) Verify endpoints

- Admin UI: https://api.lassez.fr/admin (or https://lassez.fr/admin)
- REST test: https://api.lassez.fr/api/payload/posts
- GraphQL: https://api.lassez.fr/api/payload-graphql
- App bridge test: https://lassez.fr/api/wp/posts

## 6) Domain routing options

Option A (preferred): api.lassez.fr points to the same Node app as lassez.fr.

- Use api.lassez.fr for Payload access
- Keep public pages on lassez.fr

Option B (fallback): expose everything on lassez.fr.

- Admin at /admin
- API at /api/payload

## 7) Safe rollback

If needed, switch:

CMS_PROVIDER=wordpress

No code rollback required.

## 8) Day-1 checklist

- First admin account can log in
- Categories seeded: enquetes, revelations, comprendre
- /api/payload/posts returns 200
- /api/wp/posts returns 200 with CMS_PROVIDER=payload
- Cache invalidation webhook still works
