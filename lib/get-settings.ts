import { unstable_cache } from 'next/cache';
import type { Setting } from '@/types';

const FALLBACK_SETTINGS: Setting = {
  id: 'fallback',
  manifest: {
    siteName: "L'Assez",
    shortName: 'Lassez',
    description: "Média d'investigation indépendant",
    themeColor: '#ff3b30',
    backgroundColor: '#ffffff',
  },
  displaySettings: { flashInfoEnabled: false, showHeader: true, showFooter: true },
  flashInfoText: null,
  tickerItems: null,
  communication: { maintenanceMode: false, popupEnabled: false },
  navigation: null,
  socialLinks: null,
  updatedAt: null,
  createdAt: null,
};

// TODO: brancher nouveau provider (Supabase/API) ici
export const getSettings = unstable_cache(
  async (): Promise<Setting> => {
    return FALLBACK_SETTINGS;
  },
  ['site-settings'],
  { revalidate: 300, tags: ['site-settings'] }
);
