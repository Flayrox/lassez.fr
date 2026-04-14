# Cache Sync Webhook Activation

This document enables the VPS -> public-site signed webhook flow for cache invalidation.

## 1) Required environment variables

### Public app (Hostinger, Next.js app)

Set on the server where `radar-admin` runs:

- `RADAR_CACHE_SYNC_SECRET`: shared HMAC secret (32+ random chars)
- `RADAR_CACHE_SYNC_ALLOWED_IPS`: comma-separated VPS IP allowlist (example: `116.203.158.47`)

### VPS daemon side

Set where `radar_lassez/daemon.js` executes:

- `RADAR_CACHE_SYNC_WEBHOOK_URL`: public endpoint URL (example: `https://lassez.fr/api/internal/cache-sync`)
- `RADAR_CACHE_SYNC_SECRET`: same shared HMAC secret as Hostinger

## 2) Endpoint contract

- URL: `POST /api/internal/cache-sync`
- Headers:
  - `X-Radar-Timestamp`: unix ms timestamp
  - `X-Radar-Nonce`: unique random UUID
  - `X-Radar-Signature`: hex HMAC SHA-256 of `${timestamp}.${nonce}.${rawBody}`
  - `X-Radar-Event`: event name
  - `X-Radar-Source`: source identifier
- Body (JSON):
  - `event`: `post.published` | `config.updated` | `nav.updated` | `manual.revalidate`
  - `cache_scope` or `tags`: array of cache tags
  - `paths`: optional path list, defaults to `/`
  - optional metadata: `post_id`, `post_ids`, `sent_at`, `source`

## 3) Security behavior

Receiver rejects request when:

- Signature missing/invalid
- Timestamp older/newer than 5 minutes window
- Nonce already seen (anti-replay)
- Source IP is not in `RADAR_CACHE_SYNC_ALLOWED_IPS` (when allowlist set)

## 4) Quick smoke test

From project root, run:

```powershell
$env:RADAR_CACHE_SYNC_WEBHOOK_URL='https://lassez.fr/api/internal/cache-sync'
$env:RADAR_CACHE_SYNC_SECRET='replace-with-shared-secret'
node scripts/test_cache_sync_webhook.cjs
```

Expected result:

- HTTP `200`
- Response body contains `success: true` and `invalidated.tags`

## 5) Runtime notes

- Daemon sends one webhook after a publishing cycle when at least one post is published.
- Current default tags invalidated:
  - `radar-config`
  - `wp-posts`
  - `wp-categories`

## 6) Rollback

If needed, disable without code rollback:

- Remove `RADAR_CACHE_SYNC_WEBHOOK_URL` and/or `RADAR_CACHE_SYNC_SECRET` on VPS daemon side
- Webhook sending becomes no-op automatically
