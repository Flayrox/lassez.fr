# 🛠 Radar Admin v4.0 - Implementation Plan

## 📦 Phase 1: Infrastructure & Layout (Target: Today)
- [ ] 1.1: **Font Integration**: Add `Newsreader` and `Space Grotesk` to `app/layout.tsx` or create a new dedicated layout for `/radar-admin`.
- [ ] 1.2: **Sidebar Component**: Implement `BrutalSidebar` with navigation logic.
- [ ] 1.3: **Header Component**: Implement `BrutalHeader` with status indicators.
- [ ] 1.4: **Layout Wrapper**: Wrap `app/radar-admin/page.tsx` and `app/radar-admin/studio/page.tsx` in the new design.

## 📡 Phase 2: Radar Feed (Moderation View)
- [ ] 2.1: **BrutalRadarCard**: Refactor `RadarCard` to use the new design (larger news headlines, brutal buttons).
- [ ] 2.2: **Feed Controls**: Update the search bar, geo-filter, and tag cloud to the new style.
- [ ] 2.3: **Side Panels**:
    - [ ] 2.3.1: **DaemonStatus**: Real-time switches for `daemon_rss_enabled`, `daemon_elections_enabled`.
    - [ ] 2.3.2: **StatsPanel**: Latency and active alerts.
    - [ ] 2.3.3: **HotSources**: Fetch and display recent scan source activity.

## 🎨 Phase 3: Studio & Network Sections
- [ ] 3.1: **Studio Integration**: Migrate the current Studio logic into the new dashboard layout.
- [ ] 3.2: **Network Section**: New view to manage `rss_feeds` and `telegram_channels`.
- [ ] 3.3: **Lab Section**: New view for `Console` and `Test IA`.

## ⚙ Phase 4: Unified Settings
- [ ] 4.1: **Settings Overhaul**: Move settings from the modal/tab into a full-page sidebar-integrated view.
- [ ] 4.2: **Maintenance & Comms**: Integrate diagnostic tools and popup configuration.

## 🚀 Phase 5: Polish & Deployment
- [ ] 5.1: **Grain & Shadows**: Apply the final stylistic touches (grain overlay, hard shadows).
- [ ] 5.2: **Bulk Actions**: Update the floating bulk action bar.
- [ ] 5.3: **Validation**: Final testing of all API interactions.

---

## 🛠 File Changes Overview
- **Modify**: `app/radar-admin/page.tsx` (Main overhaul)
- **Modify**: `app/radar-admin/studio/page.tsx` (Layout update)
- **Modify**: `app/radar-admin/components/RadarCard.tsx` (Visual rewrite)
- **Create**: `app/radar-admin/components/BrutalSidebar.tsx`
- **Create**: `app/radar-admin/components/BrutalHeader.tsx`
- **Create**: `app/radar-admin/components/BrutalSidePanels.tsx`
- **Create**: `app/radar-admin/components/DashboardLayout.tsx`
