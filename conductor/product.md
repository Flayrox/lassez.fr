# Initial Concept
A news, investigative journalism, and monitoring platform that provides in-depth articles, election results, and automated tracking of French parliamentary activity.

---

# Product Guide: L'Assez

## Product Vision
L'Assez aims to provide a comprehensive, data-driven perspective on French news, elections, and investigative reports ("enquêtes", "révélations") with a modern, high-performance web interface and an automated backend for real-time monitoring and social sharing.

## Technical Specs
- **Frontend:** Next.js Headless frontend connected to the WordPress API for content delivery.
- **Backend:** Hybrid backend using SQLite (via `better-sqlite3`) for the Radar-Admin and monitoring components.
- **SEO Strategy:** URL structure organized in SEO silos (e.g., categories like elections, enquetes, revelations).
- **Data Overrides:** Ability to manually override official data feeds (Assemblée Nationale, election results) to ensure data accuracy or provide additional context.

## Core Features
1. **News & Articles:** Publishing system for articles and category-based content.
2. **Election Tracking:** Real-time or detailed display of election results and data.
3. **Investigative Journalism:** Specialized sections for long-form "enquêtes" and "révélations".
4. **Parliamentary Monitoring (Radar L'Assez):** Automated collection of data from the French Assemblée Nationale, including scrutins (votes) and parliamentary activities.
5. **Automated Social Sharing:** Integrated posting of monitoring results to X (Twitter), Mastodon, and Bluesky.
6. **Data Visualization:** Use of graphs and charts (e.g., `react-force-graph-2d`) to represent complex investigative data.

## Target Audience
- Journalists and editors looking for efficient content management and data-driven storytelling.
- Readers interested in in-depth investigative journalism and real-time election results.
- Users looking for a one-stop-shop for news monitoring across multiple platforms.
