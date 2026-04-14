# Payload Day-1 Checklist

## A. Infra
- [ ] Provision Payload runtime (staging first).
- [ ] Attach persistent database.
- [ ] Configure storage for uploads.
- [ ] Set admin user and strong credentials.

## B. Env vars (staging)
- [ ] CMS_PROVIDER=payload
- [ ] PAYLOAD_API_URL=https://<payload-host>/api
- [ ] PAYLOAD_SERVER_TOKEN=<server-side token for radar write path>
- [ ] Keep WP vars available for rollback during migration window.

## C. Collections
- [ ] categories
- [ ] tags
- [ ] authors
- [ ] media
- [ ] posts

## D. Seed data
- [ ] categories: enquetes
- [ ] categories: revelations
- [ ] categories: comprendre
- [ ] one author
- [ ] one test post per category

## E. Functional tests
- [ ] List posts by category slug.
- [ ] Get single post by slug.
- [ ] List tags.
- [ ] Upload and serve featured image.

## F. Radar contract tests
- [ ] Publish one post from daemon payload.
- [ ] Retry same request (idempotency behavior checked).
- [ ] Trigger cache-sync webhook and verify invalidation logs.

## G. SEO safety tests
- [ ] Canonical present on article pages.
- [ ] Sitemap generation still valid.
- [ ] Existing route structure unchanged.

## H. Exit criteria for Day-1
- [ ] Payload reachable and stable.
- [ ] Mandatory categories and basic post flow validated.
- [ ] Green light for Next adapter wiring (phase B).
