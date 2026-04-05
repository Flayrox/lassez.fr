# Design Document: Server-Side Navigation Flow for L'Assez

## 1. Problem Statement

L'Assez, a news and monitoring platform, experiences inconsistent updates in its header navigation rubriques (sections) between the **Radar-Admin** panel and the public frontend.

The current implementation in `@app/components/Header.tsx` relies on `sessionStorage` with a 60-second TTL and a client-side fetch mechanism. When an administrator activates or deactivates a rubrique in the Radar-Admin, these changes are not immediately reflected for users due to browser-level caching (`sessionStorage`) and CDN caching (`s-maxage=60`). This leads to a fragmented and unreliable user experience where the navigation does not accurately reflect the latest database state.

The goal is to eliminate reliance on `sessionStorage` and client-side caching by fetching navigation items directly from the database on the server and passing them as props to the Header component.

## 2. Requirements

### Functional Requirements
- **Server-Side Navigation Fetching**: Navigation items must be fetched on the server (e.g., in `app/layout.tsx`) directly from the SQLite database.
- **Immediate Consistency**: Changes made in the Radar-Admin to activate/deactivate header rubriques must be reflected on the public frontend on the next page load.
- **Removal of LocalStorage/SessionStorage**: The `Header.tsx` component must no longer rely on `sessionStorage` or client-side caching to determine which rubriques to display.
- **Props-Driven Rendering**: The `Header` component must accept `navItems` as props and render them as part of the initial HTML delivered to the client.

### Non-Functional Requirements
- **Performance**: The server-side fetch must be efficient and not significantly increase page load latency.
- **SEO**: Header navigation items must be present in the initial server-rendered HTML for search engine crawlers.
- **Maintainability**: The implementation should leverage existing database utility functions and patterns where possible.
- **Error Handling**: A robust fallback mechanism (e.g., static default navigation) must be available if the database fetch fails.

### Constraints
- **Next.js App Router**: The solution must be compatible with the current Next.js App Router architecture.
- **Client Component Header**: The `Header` component remains a Client Component to handle client-side interactivity (search, menu toggles, etc.).

## 3. Architecture

### Component Overview
The architecture is based on the **Server-Side Data Flow (SSDF)** strategy, which transitions the navigation fetching from the client to the server for improved consistency and performance.

### Component Diagram
- **`app/api/radar/nav/route.ts`**: The existing API endpoint that provides navigation items. This will be adapted or leveraged for server-side fetching.
- **`lib/db-nav.ts` (Proposed)**: A new server-side utility function to fetch `navItems` directly from the `radar.db` SQLite database using `better-sqlite3`. This avoids additional HTTP requests from the layout.
- **`app/layout.tsx` (Server Component)**: The root layout of the application. It calls the `lib/db-nav.ts` utility to fetch the latest navigation state on every server-rendered page load.
- **`components/Header.tsx` (Client Component)**: Receives the `navItems` as props from `layout.tsx`. It maps these items directly to the navigation bar, removing any dependency on `sessionStorage` or internal `useEffect` fetches for navigation.

### Data Flow
1. **Server-Side Render (SSR)**: When a request is made, `app/layout.tsx` is executed on the server.
2. **Database Query**: `layout.tsx` calls `getNavItems()` from `lib/db-nav.ts`, which queries the `radar_nav_config` table in `radar.db`.
3. **Prop Passing**: The fetched `navItems` are passed into the `Header` component as props.
4. **Client-Side Hydration**: The `Header` component renders the navigation based on the provided props, ensuring that the navigation items are available immediately without any client-side delay.

### Key Interfaces
- **`NavItem`**: Interface defined in `app/api/radar/nav/route.ts` will be shared or reused for type safety.
- **`HeaderProps`**: Updated to include `navItems: NavItem[]`.

## 4. Agent Team
- **`coder` (Implementation Lead)**: Responsible for the primary refactoring of `app/layout.tsx` and `components/Header.tsx`. They will also create the `lib/db-nav.ts` utility.
- **`refactor` (Data Management)**: Responsible for adapting the existing `/api/radar/nav` endpoint to be compatible with the server-side fetch or creating a new shared logic layer.
- **`tester` (Verification)**: Responsible for verifying that navigation items are correctly fetched on the server and that any local storage or client-side caching mechanisms have been successfully removed.

## 5. Risk Assessment & Mitigation

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Database Connection Blocking**: Multiple concurrent server-side queries could lead to database locking with `better-sqlite3`. | High | Use a shared, single database connection instance or ensure connections are correctly closed after each query. |
| **Layout Shift**: Moving fetching to the server could cause a small initial delay if the query is slow, although this is usually faster than client-side Popping. | Medium | Optimize the `radar_nav_config` query and provide a robust fallback (e.g., static default navigation) if the fetch fails. |
| **Cache Staleness**: CDN or server-side caching (like `revalidate`) might still cache the layout HTML longer than desired. | Medium | Use `export const dynamic = 'force-dynamic'` or ensure proper cache headers are set to minimize staleness for navigation. |

## 6. Success Criteria
- **Verified Database Synchronization**: Toggling a header rubrique in the Radar-Admin must reflect the change on the public frontend on the next page refresh.
- **No Client-Side Popping**: Navigation items must be present in the initial HTML delivered to the browser.
- **SessionStorage Removal**: `sessionStorage.getItem('lassez_nav')` must be removed from `components/Header.tsx` and no longer used for navigation rendering.
- **Passing Automated Tests**: Any existing or new tests verifying navigation items must pass consistently.
- **Type Safety**: The navigation items data flow must be fully typed across the server and client components.
