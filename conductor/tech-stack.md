# Tech Stack: L'Assez

## Frontend & UI
- **Framework:** Next.js (App Router) — Providing a high-performance, SEO-friendly React environment.
- **Language:** TypeScript — For type safety and better developer experience.
- **Content Delivery:** WordPress REST API (Headless) — Used for editorial content management.
- **Styling:** Tailwind CSS — For utility-first, consistent styling.
- **Animations:** Framer Motion — Implementing the "hard" and intentional interactivity defined in the guidelines.

## Backend & Data Management
- **Local Data Storage:** SQLite (via `better-sqlite3`) — Powering the Radar-Admin and monitoring components.
- **Data Processing:** 
  - **PapaParse:** Used for high-efficiency CSV election data processing.
  - **Sharp:** Powering automated social image generation for consistent visuals.
- **Data Integrity:** Manual Radar-Admin overrides take absolute precedence over external feeds.

## Infrastructure & Automation
- **Deployment:** PM2 (managed via `ecosystem.config.cjs`) with a **custom `server.js` bridge** as the entry point for Hostinger environments.
- **Automated Social Sharing:** Custom integration with X (Twitter), Mastodon, and Bluesky.
- **Instagram Studio:** AI-powered studio within the Radar component for easy Instagram post generation.
- **Monitoring Scripts:** Automated data collection and processing for Radar L'Assez.

## Tooling & Standards
- **Development Tools:** ESLint, Prettier, TypeScript.
- **Package Management:** npm (via `package.json`).
- **Data Visualization:** `react-force-graph-2d` for complex data representations.
