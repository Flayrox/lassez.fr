---
task_complexity: medium
design_depth: Quick
---

# Design Document: Sidebar City List for Municipales 2026

## 1. Problem Statement
The user wants to navigate to cities directly from the sidebar when a department is selected, without having to use a search box. Currently, the sidebar requires manual search or clicking a "Consulter le département" button. The goal is to display an alphabetical list of all cities in the selected department within the sidebar.

## 2. Requirements
- **Functional**:
    - Update the `/api/elections/results` endpoint to return a list of city names and INSEE codes for a specific department.
    - Update the `ElectionsSidebar` client component to fetch and display this list when a department is selected.
    - Ensure city links point to the new silo URL structure: `/elections/municipales-2026/commune/[code-insee]-[nom-ville]`.
    - Sort cities alphabetically.
- **Non-Functional**:
    - Use `swr` for efficient client-side fetching.
    - Maintain the existing visual style (fonts, colors, borders) of the sidebar.
    - Ensure performance for departments with many cities (scrollable list).

## 3. Approach
**Selected Approach: Integrated Sidebar List**
The implementation will follow these steps:
1.  **API Update**: Enhance the existing `GET` handler in `app/api/elections/results/route.ts` to support a `list=cities` parameter. When present, it will return a lightweight JSON of unique cities for the given department.
2.  **UI Update**: Refactor `components/sidebar/ElectionsSidebar.tsx` to:
    - Add `useSWR` for fetching the city list.
    - Import `formatCommuneSlug` from `lib/seo-engine`.
    - When a department is selected, display the list of cities alphabetically below the department name.
    - Ensure the list is scrollable within the sidebar's constraints.

## 4. Risk Assessment
- **Risk**: Performance of the sidebar with 800+ cities in a single list.
- **Mitigation**: Use simple list items and standard CSS scrolling. Ensure the API response is minimal (no result data, just name and INSEE).
- **Risk**: Overlapping UI with the "Consulter le département" button.
- **Mitigation**: Reorganize the "Selected Department" view to prioritize the city list while keeping the button for the department-wide hub.
