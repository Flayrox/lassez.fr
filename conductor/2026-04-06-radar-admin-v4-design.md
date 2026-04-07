# 🎨 Radar Admin v4.0 - Design Specification

## 🚀 Objective
Completely overhaul the `radar-admin` interface to match the new "Brutalist" design language from the `BIENTOT` prototype. Transition from a tab-based single-page view to a sidebar-driven professional dashboard.

## 📐 Design Language (Brutalist v4)
- **Borders**: Heavy 4px solid `#1A1C1C` (Stone-900).
- **Shadows**: Hard 4px/8px offset shadows without blur (`shadow-[4px_4px_0px_0px_#1A1C1C]`).
- **Typography**:
  - Headlines: `Newsreader` (Serif) for high-impact titles.
  - Body/Labels: `Space Grotesk` (Sans) for data and controls.
- **Palette**:
  - `Surface`: `stone-50` (F9F9F9)
  - `Primary`: `red-700` (BC0100)
  - `Text`: `stone-900` (1A1C1C)
- **Icons**: Material Symbols Outlined.

---

## 🏗 Information Architecture

### 1. Global Navigation (Sidebar)
- **Radar**: Main feed for moderating signals (Pending, Approved, etc.).
- **Studio**: Social media graphic creator (adapted from current `/studio`).
- **Network**: Sources management (RSS/Telegram) and live stats.
- **Lab**: Terminal console, AI prompt testing, and diagnostic tools.
- **Settings**: Global configuration (Daemon intervals, Social APIs, Comms).

### 2. Radar Section (Core Feed)
- **Top Bar**: Search bar + Live Stats (Active Alerts, Latency).
- **Sub-Navigation**: Tab bar for statuses: `PENDING`, `APPROVED`, `PUBLISHED`, `REJECTED`, `IGNORED`.
- **Filters**: Geo-toggle (FR/INTL) and Trending Tags cloud.
- **Feed**: List of `RadarCard` components updated to the new Brutalist style.
- **Side Panels**:
  - **Daemon Status**: Toggles for specific scrapers (RSS, Telegram, Elections).
  - **Network Density**: Activity chart (moved from health diagnostics).
  - **Hot Sources**: Real-time hits per source.

### 3. Settings Section
- Unified view for:
  - **Moteur IA**: Prompt editor.
  - **Diffusion**: Social media API keys and timing delays.
  - **Santé**: Maintenance mode, popup announcements, and logs.

---

## 🛠 Technical Implementation Plan

### Phase 1: Layout & Core Components
- Create `BrutalSidebar` and `BrutalHeader` components.
- Implement the `DashboardLayout` to wrap the admin pages.
- Integrate `Newsreader` and `Space Grotesk` fonts.

### Phase 2: Radar Section Overhaul
- Update `RadarAdminPage` to use the new layout.
- Rewrite `RadarCard` for the new design (larger headlines, brutal buttons).
- Implement `DaemonStatusPanel` with live toggles linked to `/api/radar/settings`.

### Phase 3: Feature Migration
- Create dedicated views for `Studio`, `Network` (Sources), and `Lab`.
- Move the complex settings modal into the `Settings` sidebar section.
- Adapt the "Bulk Action Bar" to match the new dark/high-contrast style.

### Phase 4: Refinement
- Add the "Grain Overlay" for texture.
- Implement `framer-motion` transitions between sections.
- Ensure full responsiveness for tablet/mobile.

---

## ✅ Success Criteria
- [ ] 1:1 visual parity with `BIENTOT/dashboard_radar_l_assez/code.html`.
- [ ] 100% feature parity with current `radar-admin` (all settings and actions preserved).
- [ ] Improved user flow for moderating high volumes of OSINT signals.
