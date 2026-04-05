---
task_complexity: complex
design_depth: Quick
---

# Design Document: OFFENSIVE MUNICIPALES 2026 SEO

## 1. Problem Statement
The goal is to implement an aggressive SEO strategy ("OFFENSIVE MUNICIPALES 2026") to index 35,000 highly performant pages and dominate local search results (e.g., "Résultats municipales 2026 [Ville]"). The current election pages lack the strict hierarchical silo structure, dynamic performance optimizations (ISR for 35k pages, SSG for top 500), and automated semantic content required to rank highly without being penalized for duplicate content. Furthermore, the deployment strategy must account for server constraints (Hostinger) during the massive build process.

## 2. Requirements
**Functional Requirements:**
- Implement the strict URL Silo:
  - National Hub: `/elections/municipales-2026`
  - Department Hub: `/elections/municipales-2026/departement/[code-dept]`
  - Commune Page: `/elections/municipales-2026/commune/[code-insee]-[nom-ville]`
- Implement Dynamic Metadata with unique server-generated titles and descriptions.
- Develop a Semantic Content Generator (`lib/seo-engine.ts`) to output varied, readable summaries of election results to prevent duplicate content penalties.
- Inject Structured Data (JSON-LD BreadcrumbList and Dataset schemas).
- Implement an optimized Internal Linking strategy (Hub -> Dept -> Commune, Commune -> Dept, and 'Nearby Cities' widget).

**Non-Functional Requirements:**
- **Performance/Scale**: Pre-generate (SSG) the top 500 cities at build time; use ISR for the remaining ~34,500 cities to avoid server overload.
- **Freshness**: Revalidate pages every 60 seconds during election night.
- **Monitoring**: Track CTR and rankings via existing GSC and Matomo integrations.

**Constraints:**
- Data source: Use the existing SQLite database (`radar_lassez/radar.db`).
- Build Environment: Employ a local build strategy to pre-render the massive SSG payload before deploying artifacts to Hostinger.

## 3. Approach
**Selected Approach: Integrated SEO Silo**
This native Next.js implementation refactors the current election routing into a strict hierarchical silo. It relies heavily on `generateStaticParams` for SSG/ISR performance optimization. 

**Alternatives Considered:**
- **Overlay SEO Silo:** Keep existing SSR pages and add a parallel `/seo/municipales-2026/` route. Rejected because it creates technical debt and risks keyword cannibalization.
- **LLM Content Generation:** Use OpenAI/Gemini for semantic content. Rejected due to exorbitant cost and build time for 35,000 pages.

## 4. Architecture
**Data Flow:**
Data is sourced exclusively from the existing local SQLite database. During build time, Next.js queries this DB to identify the top 500 cities to pre-generate. When users visit the remaining 34.5k pages, ISR triggers, querying the DB and caching the result for 60 seconds.

**Component Diagram:**
- `app/elections/municipales-2026/page.tsx`: National Hub.
- `app/elections/municipales-2026/departement/[code-dept]/page.tsx`: Department Hub.
- `app/elections/municipales-2026/commune/[code-insee]-[nom-ville]/page.tsx`: The core silo page.
- `components/ElectionResultsLive.tsx`: Reused but potentially optimized for SSG/ISR context.
- `lib/seo-engine.ts`: Core utility containing conditional logic.
- `app/sitemap.ts`: Updated to reflect the new structure.

## 5. Agent Team
- **seo_specialist**: To ensure the exact URL silo hierarchy, metadata generation, and structured data.
- **coder**: To handle refactoring Next.js routes, implementing `generateStaticParams`, ISR logic, and building `lib/seo-engine.ts`.
- **performance_engineer**: To ensure the local build strategy works efficiently and ISR pages don't overload the server.
- **code_reviewer**: To conduct a final pass for SEO bleeding and architectural compliance.

## 6. Risk Assessment
**Risk Level:** Medium
- **Risk:** Build Timeouts on Hostinger. 
  - **Mitigation:** Rely on a **Local Build (Fast)** strategy and deploy compiled `.next` folder.
- **Risk:** Keyword Cannibalization. 
  - **Mitigation:** Ensure old routes are strictly redirected (301) to the new structure.
- **Risk:** SQLite Locking During Build/ISR. 
  - **Mitigation:** Ensure database queries are strictly read-only and optimized.

## 7. Success Criteria
- The top 500 cities load instantly (TTFB < 50ms) as static HTML; remaining 34,500 generate on first visit and revalidate efficiently every 60s.
- A crawl confirms the exact silo structure: National -> Department -> Commune, with no orphan pages.
- Manual inspection of 20 random city pages reveals varied, readable semantic text.
- Google Rich Results Test passes cleanly for Dataset and BreadcrumbList schemas.
- The dynamic `sitemap.ts` successfully outputs 35,000+ valid URLs.
