/**
 * Couche données — stub en attendant le nouveau provider
 * Remplace lib/payload.ts + db-nav + radar-db
 * TODO: brancher Supabase / API custom ici
 */
import type { Post, Category, Tag, Setting } from '@/types';

export type FindArgs = {
  collection: string;
  where?: Record<string, any>;
  limit?: number;
  page?: number;
  depth?: number;
  sort?: string;
};

const emptyFindResult = () => ({
  docs: [] as any[],
  totalDocs: 0,
  totalPages: 0,
  page: 1,
  limit: 10,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
});

export async function find(_args: FindArgs) {
  return emptyFindResult();
}

export async function findGlobal(_args: { slug: string }) {
  return {} as any;
}

export async function findByID(_args: any) {
  return null;
}

// Helpers front
export async function getPosts(): Promise<Post[]> {
  return [];
}
export async function getCategories(): Promise<Category[]> {
  return [];
}
export async function getTags(): Promise<Tag[]> {
  return [];
}
export async function getSettingsData(): Promise<Setting | null> {
  return null;
}

// Nav fallback — remplace lib/db-nav.ts
import type { NavItem } from '@/types';
export async function getNavItems(all: boolean = false): Promise<NavItem[]> {
  const fallback: NavItem[] = [
    { slug: 'la-une', label: 'La Une', path: '/', enabled: true, badge: null, sort_order: 0 },
    { slug: 'enquetes', label: 'Enquêtes', path: '/enquetes', enabled: true, badge: null, sort_order: 1 },
    { slug: 'revelations', label: 'Flux Révélation', path: '/revelations', enabled: true, badge: null, sort_order: 2 },
    { slug: 'investigation', label: 'Investigation', path: '/investigation', enabled: true, badge: null, sort_order: 3 },
    { slug: 'comprendre', label: 'Comprendre', path: '/comprendre', enabled: true, badge: null, sort_order: 4 },
    { slug: 'elections', label: 'Élections', path: '/elections', enabled: true, badge: 'LIVE', sort_order: 5 },
    { slug: 'soutenir', label: 'Soutenir', path: '/soutenir', enabled: true, badge: null, sort_order: 6 },
  ];
  return all ? fallback : fallback.filter(i => i.enabled);
}
