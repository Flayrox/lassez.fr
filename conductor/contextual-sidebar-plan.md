# Plan: Contextual Sidebars Implementation

The goal is to implement a contextual sidebar system that adapts to the current page/category, specifically for Enquêtes, Elections Municipales, and Flux Révélation.

## Objective
- Provide specialized sidebar content based on the user's location in the app.
- Improve UX by moving relevant filters and navigation to the sidebar.
- Enhance SEO for elections through structured city/region navigation.

## Key Files & Context
- `components/Sidebar.tsx`: The main sidebar container and orchestrator.
- `components/sidebar/`: New directory for specialized sidebar components.
- `components/RevelationsClient.tsx`: Needs to be updated to sync with the new sidebar filters.
- `components/ElectionsClient.tsx`: Will benefit from moved city navigation.
- `lib/geo-data.ts`: New file for French regions/departments mapping.

## Implementation Steps

### Phase 1: Sidebar Orchestration
1. **Create `hooks/useSidebarMode.ts`**:
    - Detect current mode: `enquetes`, `revelations`, `elections`, `tag`, `default`.
    - Use `usePathname` for detection.
2. **Refactor `components/Sidebar.tsx`**:
    - Extract common layout (shell, mobile header, overlay) into the main component.
    - Render sub-components based on `useSidebarMode`.

### Phase 2: Revelations Sidebar
1. **Create `components/sidebar/RevelationsSidebar.tsx`**:
    - Port Geo filters (Global, France, International).
    - Port Tag filters (Signaux Clés).
    - Use `useSearchParams` and `useRouter` from `next/navigation` to update URL params.
2. **Update `components/RevelationsClient.tsx`**:
    - Remove internal header filters (redundant once in sidebar).
    - Read `geo` and `tag` from URL search params.

### Phase 3: Elections Sidebar
1. **Create `lib/geo-data.ts`**:
    - Define French regions and their associated departments.
2. **Create `components/sidebar/ElectionsSidebar.tsx`**:
    - **Map Block**: A visual placeholder or mini-map linking to the main election page.
    - **Drill-down Menus**:
        - Select Region -> Shows Departments.
        - Select Department -> Shows link to a list of cities or top cities.
    - **SEO Links**: Structural links for SEO categories.
3. **Fetch Cities**:
    - Implement a small utility to fetch top cities per department from `radar.db` (if needed) or use a static list for major cities.

### Phase 4: Enquête Sidebar
1. **Create `components/sidebar/EnqueteSidebar.tsx`**:
    - Move existing category-based navigation logic from the old `Sidebar.tsx`.

### Phase 5: Tag/Signaux Clés
1. **Update `useSidebarMode`**:
    - Detect `/tag/[slug]` and use `RevelationsSidebar` or a variant.

## Verification & Testing
- **Navigation**: Check that the sidebar changes correctly when moving between `/enquetes`, `/revelations`, and `/elections`.
- **Filtering**: Verify that clicking a filter in the Révélations sidebar updates the feed content.
- **Elections Drill-down**: Test the Region > Department navigation flow.
- **Mobile Support**: Ensure all specialized sidebars work correctly on mobile (sliding menu).
- **SEO**: Verify that election links are correctly generated and crawlable.

## Migration & Rollback
- The old `Sidebar.tsx` will be kept as a reference and its logic moved.
- Rollback is easy by reverting `Sidebar.tsx` to its previous state.
