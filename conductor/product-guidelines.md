# Product Guidelines: L'Assez

## 1. Prose Style & Branding
- **Tone:** Engaged, radical, and left-wing. The editorial line assumes a clear break with the neoliberal consensus and focuses on social struggles and the decoding of power dynamics.
- **Voice:** "The Mechanic" — Surgical, direct, and high-impact. Avoid "corporate fluff" and marketing jargon. Sentences must be short, focused on factual demonstration and political impact.
- **Branding:** Consistently use "L'Assez" to reinforce brand authority and recognition.

## 2. Design & UX Principles (Brutalist Premium)
- **Aesthetic:** Radical Brutalist style. Zero "glitch" effects, zero gradients, zero rounded corners. Everything must look raw, solid, and definitive.
- **Color Palette:** Strictly limited to Black, White, and Red (#DC2626).
- **Typography:** Massive headlines in Playfair Display for journalistic authority; technical mono-spaced fonts (e.g., IBM Plex Mono) for data, numbers, and technical details.
- **Grid & Structure:** Use thick borders (2px/3px), hard shadows, and visible grids to separate content blocks, mimicking the layout of a modern combative newspaper.
- **Interactivity:** Animations (via Framer Motion) must be "hard" and intentional. Prioritize loading speed and information clarity over decorative elements.

## 3. Technical Standards
- **Architecture:** Next.js (App Router) Headless frontend, connected to the WordPress REST API for editorial content delivery.
- **Data Management:** Hybrid backend utilizing SQLite (via better-sqlite3) for the Radar-Admin and monitoring components.
- **Data Integrity (The Golden Rule):** Manual entries ("overrides") performed in the Radar-Admin are the absolute source of truth. They must systematically override external API feeds (Government, Assembly) to ensure editorial accuracy.
- **SEO Strategy:** Strict adherence to SEO Silo structure for URLs (/[category]/[slug]). Systematic implementation of NewsArticle and LiveBlogPosting JSON-LD schemas.
- **Performance:** Maximum optimization for instantaneous mobile loading, essential for live event coverage.

## 4. Automation Workflows
- **Radar L'Assez:** Automated collection of parliamentary and social data, processed by internal scripts as raw source material prior to validation.
- **Social Pipeline (Antigravity):** Automated generation of visuals respecting the "Brutalist Premium" guidelines for instantaneous sharing on X (Twitter), Mastodon, and Bluesky.
