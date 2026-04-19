const BASE_URL = String(
  process.env.BRIDGE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173'
).replace(/\/$/, '');

async function fetchJson(pathname) {
  const url = `${BASE_URL}${pathname}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  console.log(`[payload] base URL: ${BASE_URL}`);

  const categoryCacheBuster = (Date.now() % 97) + 1;
  const categoriesRaw = await fetchJson(`/api/categories?slug=enquetes&per_page=${categoryCacheBuster}`);
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw?.docs;
  if (!Array.isArray(categories)) {
    throw new Error('Expected /api/categories to return docs.');
  }
  console.log(`[payload] categories ok (${categories.length})`);

  const fixtureSlug = String(process.env.BRIDGE_FIXTURE_SLUG || '').trim();
  const postsCacheBuster = Date.now();
  const postsPath = fixtureSlug
    ? `/api/posts?slug=${encodeURIComponent(fixtureSlug)}&depth=1&order=desc&orderby=cache-${postsCacheBuster}`
    : `/api/posts?search=fixture&depth=1&order=desc&orderby=cache-${postsCacheBuster}`;

  const postsRaw = await fetchJson(postsPath);
  const posts = Array.isArray(postsRaw) ? postsRaw : postsRaw?.docs;
  if (!Array.isArray(posts)) {
    throw new Error('Expected /api/posts to return docs.');
  }
  console.log(`[payload] posts ok (${posts.length})`);

  const payloadRaw = await fetchJson('/api/payload/posts?limit=1');
  const payloadDocs = Array.isArray(payloadRaw) ? payloadRaw : payloadRaw?.docs;
  if (!Array.isArray(payloadDocs)) {
    throw new Error('Expected /api/payload/posts to return docs.');
  }
  console.log(`[payload] api ok (${payloadDocs.length} doc(s) in sample)`);

  if (fixtureSlug) {
    if (posts.length === 0) {
      throw new Error(`Fixture slug not found via /api/posts: ${fixtureSlug}`);
    }
    console.log(`[payload] fixture slug visible (${fixtureSlug})`);
  }

  console.log('Payload API validation succeeded.');
}

main().catch((error) => {
  console.error('Payload API validation failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
