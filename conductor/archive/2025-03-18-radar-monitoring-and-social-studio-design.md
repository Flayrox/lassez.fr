# Design Document: Radar Monitoring Console & Enhanced Social Publishing

## 1. Problem Statement

L'Assez requires enhanced monitoring and more flexible social media publishing capabilities for its Radar system.

Currently, the Radar daemon operates as a "black box" with no real-time visibility into its scanning and publishing activities within the Admin panel. Additionally, social media posts for "FLASH" (feed-based) articles incorrectly include links, and when links are included for other articles, they point to the API (`api.lassez.fr`) instead of the public frontend (`lassez.fr`). Finally, there is no way to send "entirely customizable" social posts that aren't tied to a specific news article or feed.

The goal is to implement a real-time console for log viewing, fix the social media link logic, and provide a dedicated "Studio Social" for direct, customizable broadcasting to social networks.

## 2. Requirements

### Functional Requirements
- **Radar Monitoring Console**:
  - A "Console" tab in the Radar-Admin panel displaying real-time logs from `daemon.log`.
  - A new API endpoint `/api/radar/logs` to retrieve the latest log entries.
- **Social Media Link Enhancements**:
  - Implementation of a `skipLink` flag in `socials.js` to omit URLs for FLASH/feed articles.
  - Integration of a `FRONTEND_URL` environment variable to ensure correct public links (e.g., `lassez.fr`).
  - Logic in `publishPost.js` to automatically detect FLASH articles and set the `skipLink` flag.
- **Studio Social (Direct Post)**:
  - A "Studio Social" tab in the Admin panel with a form for custom Text and optional Image (URL or upload).
  - Ability to save drafts in a new `radar_social_drafts` database table.
  - A "Broadcast" action that sends content directly to Mastodon, Bluesky, and X via a new `/api/radar/social-custom` endpoint.

### Non-Functional Requirements
- **Performance**: Log polling should be efficient and not degrade Admin panel performance.
- **Transparency**: Logs must provide detailed information on scan starts, publishing successes/failures, and errors.
- **Usability**: The "Studio Social" form must be intuitive and allow for rapid drafting and sending.

### Constraints
- **SQLite Persistence**: All new data (drafts, settings) must be stored in the existing `radar.db`.
- **Pipeline Reusage**: Custom posts must leverage the existing `broadcastToSocials` logic in `socials.js`.

## 3. Architecture

### Component Overview
The architecture expands the existing Radar system with monitoring and direct social publishing modules, ensuring a clear separation between automated feed processing and manual social engagement.

### Component Diagram
- **`radar_lassez/daemon.log`**: The source of truth for all daemon activities.
- **`radar_lassez/socials.js`**: Enhanced to support `skipLink` and uses `FRONTEND_URL` for link construction.
- **`radar_lassez/publishPost.js`**: Updated to inject the `skipLink` flag for FLASH/feed-based articles.
- **`app/api/radar/logs/route.ts` (New)**: A server-side endpoint that reads and returns the last `N` lines of `daemon.log`.
- **`app/api/radar/social-custom/route.ts` (New)**: A server-side endpoint that accepts manual social drafts and calls `broadcastToSocials` directly.
- **`radar_lassez/radar.db`**: Updated with a `radar_social_drafts` table.
- **`app/radar-admin/page.tsx`**: Updated with two new tabs: "Console" (log viewer) and "Studio Social" (custom post form).

### Data Flow
1. **Monitoring**:
   - The "Console" tab periodically polls `/api/radar/logs`.
   - The API reads the latest entries from `daemon.log` and returns them as a JSON array.
   - The UI renders these logs in a mono-spaced terminal-style window.
2. **Custom Social Posting**:
   - User enters text/image in "Studio Social".
   - Clicking "Broadcast" sends the data to `/api/radar/social-custom`.
   - The API saves the draft to SQLite and then triggers `broadcastToSocials` in `socials.js`.
   - Social networks (Mastodon, Bluesky, X) receive the update immediately.

### Key Interfaces
- **`radar_social_drafts` Schema**: `id`, `text`, `image_url`, `status` (DRAFT, SENT), `created_at`.
- **`/api/radar/logs` Response**: `{ success: boolean, logs: string[] }`.

## 4. Agent Team
- **`coder` (Implementation Lead)**: Responsible for the primary UI updates in `app/radar-admin/page.tsx` and creating the two new API routes (`logs` and `social-custom`).
- **`data_engineer` (Data & Logic)**: Responsible for the `radar_social_drafts` table creation, updating `publishPost.js` and `socials.js` with the new link logic, and configuring the `FRONTEND_URL` environment variable.
- **`tester` (Verification)**: Responsible for verifying the log streaming, testing the link-skipping logic for FLASH articles, and ensuring that custom social posts are broadcasted correctly to all networks.

## 5. Risk Assessment & Mitigation

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Log File Size**: Reading a very large `daemon.log` could be slow or memory-intensive. | Medium | Use a streaming file reader or a "tail" logic to only read the last 500-1000 lines. |
| **Social API Failures**: Custom posts could fail to send to one or more networks. | High | Use the existing `Promise.allSettled` in `socials.js` and provide clear feedback in the "Studio Social" UI. |
| **Environment Variable Missing**: Forgetting to set `FRONTEND_URL` would result in broken links. | Medium | Add a validation check in the API and `publishPost.js` to fallback to a sensible default or log a clear error. |

## 6. Success Criteria
- **Real-time Visibility**: The "Console" tab correctly displays the latest activities from the Radar daemon.
- **Link Integrity**: FLASH/feed articles on socials no longer include links, and other articles link to `lassez.fr` correctly.
- **Direct Broadcasting**: Custom posts drafted in the "Studio Social" are successfully sent to Mastodon, Bluesky, and X without requiring a WordPress post.
- **Persistence**: Custom social drafts are correctly saved and retrievable from the database.
- **Seamless UI**: The new tabs integrate naturally into the Radar-Admin panel without degrading performance or usability.
