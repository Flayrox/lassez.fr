import { unstable_cache } from 'next/cache';
import type { About, Legal } from '@/types';

const FALLBACK_ABOUT: About = {
  id: 'fallback',
  title: 'À propos',
  introText: "L'Assez est un média d'investigation indépendant.",
  quote: null,
  manifestoSections: [],
  team: [],
};

const FALLBACK_LEGAL: Legal = {
  id: 'fallback',
  title: 'Mentions légales',
  lastUpdated: new Date().toISOString().slice(0, 10),
  sections: [],
};

// TODO: brancher nouveau provider ici
export const getAboutData = unstable_cache(
  async (): Promise<About> => FALLBACK_ABOUT,
  ['about-page'],
  { revalidate: 300, tags: ['about-page'] }
);

export const getLegalData = unstable_cache(
  async (): Promise<Legal> => FALLBACK_LEGAL,
  ['legal-page'],
  { revalidate: 300, tags: ['legal-page'] }
);
