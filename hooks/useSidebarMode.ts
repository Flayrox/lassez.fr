'use client';

import { usePathname } from 'next/navigation';

export type SidebarMode = 'enquetes' | 'revelations' | 'elections' | 'default';

/**
 * Hook to detect the current sidebar mode based on the URL pathname.
 * 
 * Logic:
 * - /revelations or /tag/... -> revelations
 * - /elections or /elections/... -> elections
 * - /enquetes or /[cat]/[slug] where [cat] is not elections/revelations -> enquetes
 * - / (Home) -> default
 */
export function useSidebarMode(): SidebarMode {
  const pathname = usePathname();

  if (!pathname || pathname === '/') {
    return 'default';
  }

  // Revelations and Tags use the same filter sidebar
  if (pathname.startsWith('/revelations') || pathname.startsWith('/tag/')) {
    return 'revelations';
  }

  // Elections mode
  if (pathname.startsWith('/elections')) {
    return 'elections';
  }

  // Explicit Enquetes route
  if (pathname.startsWith('/enquetes')) {
    return 'enquetes';
  }

  // Logic for /[cat]/[slug] where [cat] is not elections/revelations
  const segments = pathname.split('/').filter(Boolean);
  
  // If it's a category or article page (e.g., /politique/article-slug)
  if (segments.length >= 1) {
    const cat = segments[0];
    
    // List of routes that should NOT be treated as 'enquetes'
    const nonEnquetesRoutes = [
      'revelations', 
      'elections', 
      'tag', 
      'a-propos', 
      'mentions-legales', 
      'soutenir', 
      'search', 
      'podcasts', 
      'comprendre', 
      'investigation', 
      'radar-admin', 
      'radar-login',
      'api'
    ];

    if (!nonEnquetesRoutes.includes(cat)) {
      return 'enquetes';
    }
  }

  return 'default';
}
