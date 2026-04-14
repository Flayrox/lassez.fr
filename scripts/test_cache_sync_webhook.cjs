#!/usr/bin/env node

/*
  Quick manual test for /api/internal/cache-sync
  Usage (PowerShell):
  $env:RADAR_CACHE_SYNC_WEBHOOK_URL='https://lassez.fr/api/internal/cache-sync'
  $env:RADAR_CACHE_SYNC_SECRET='replace-me'
  node scripts/test_cache_sync_webhook.cjs
*/

const crypto = require('crypto');

const webhookUrl = process.env.RADAR_CACHE_SYNC_WEBHOOK_URL;
const secret = process.env.RADAR_CACHE_SYNC_SECRET;

if (!webhookUrl || !secret) {
  console.error('Missing RADAR_CACHE_SYNC_WEBHOOK_URL or RADAR_CACHE_SYNC_SECRET');
  process.exit(1);
}

async function main() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = {
    event: 'manual.revalidate',
    source: 'manual-test',
    sent_at: new Date().toISOString(),
    tags: ['radar-config', 'wp-posts', 'wp-categories'],
    paths: ['/'],
  };

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest('hex');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Radar-Timestamp': timestamp,
      'X-Radar-Nonce': nonce,
      'X-Radar-Signature': signature,
      'X-Radar-Event': payload.event,
      'X-Radar-Source': payload.source,
    },
    body,
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);

  if (!res.ok) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
