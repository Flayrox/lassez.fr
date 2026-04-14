# Payload Migration Runbook (L'Assez)

## 1. Decision
- Recommended target: PayloadCMS (self-hosted).
- Goal: replace WordPress progressively, keep Next.js live, keep Radar publishing flow.
- Strategy: parallel run, no big-bang migration.

## 2. Scope
- In scope:
  - Editorial content: posts, categories, tags, authors, media.
  - Front reads from Payload APIs.
  - Radar writes into Payload.
  - Cache invalidation webhook remains active.
- Out of scope (phase 1):
  - Complex legacy WP plugin behavior.
  - Full historical SEO cleanup beyond canonical/redirects baseline.

## 3. Target Content Model

### 3.1 collections: categories
- name (text, required)
- slug (text, required, unique)
- description (textarea)
- seoTitle (text)
- seoDescription (textarea)
- sortOrder (number)
- enabled (checkbox, default true)

### 3.2 collections: tags
- name (text, required)
- slug (text, required, unique)

### 3.3 collections: authors
- name (text, required)
- slug (text, required, unique)
- bio (textarea)
- avatar (upload relation)

### 3.4 collections: media
- Payload upload collection (images + optional docs)
- alt, caption, credit fields

### 3.5 collections: posts
- title (text, required)
- slug (text, required, unique)
- excerpt (textarea)
- content (richText, required)
- categories (relationship many -> categories, required)
- tags (relationship many -> tags)
- author (relationship one -> authors)
- featuredImage (relationship one -> media)
- publishedAt (date)
- status (select: draft, published)
- sourcePdfUrl (text)
- securityLevel (select: PUBLIC, CONFIDENTIEL)
- seoTitle (text)
- seoDescription (textarea)
- canonicalUrl (text)

## 4. Mandatory category slugs (phase 1)
- enquetes
- revelations
- comprendre

## 5. API Contract (phase 1)
- Public read endpoint for posts list with filters:
  - category slug
  - tag slug
  - pagination
  - search
- Public endpoint for categories list.
- Public endpoint for tags list.
- Single post by slug.

## 6. Radar publishing contract
- Radar creates/updates posts through Payload server API.
- Required payload from daemon:
  - title
  - slug
  - excerpt
  - content
  - categories (at least revelations for live flow)
  - tags (optional)
  - publishedAt
  - status=published
- After successful write:
  - trigger existing cache-sync webhook (same signed flow).

## 7. Migration phases

### Phase A (1-2 days): foundation
- Deploy Payload in staging.
- Create collections and access rules.
- Seed mandatory categories.
- Validate basic CRUD from admin.

### Phase B (2-3 days): read path in Next
- Add a CMS adapter layer in Next (wordpress/payload switch by env).
- Keep current UI and route structure.
- Switch only:
  - home feed
  - revelations
  - enquetes
- Validate sitemap generation with payload source.

### Phase C (2-3 days): Radar write path
- Add Radar -> Payload publish endpoint/service.
- Keep cache-sync webhook as-is.
- Test with one synthetic publication and one retry scenario.

### Phase D (1-2 days): cutover
- Set CMS provider to payload in prod.
- Keep WP read fallback disabled by default but available behind flag for rollback.
- Monitor errors and indexing for 72h.

## 8. Rollback plan
- Feature flag: CMS_PROVIDER=wordpress.
- Keep old WP read proxies for one release cycle.
- If incidents: switch provider flag, restart app, keep Radar writes paused.

## 9. KPI checklist (go/no-go)
- Home/revelations/enquetes response time stable.
- No increase in 5xx on article routes.
- Sitemap contains expected routes.
- Radar publication success >= 99% over 48h.
- No duplicate slug collisions.

## 10. Immediate next step
- Implement CMS adapter interface in Next and wire phase-B pages behind provider flag.
