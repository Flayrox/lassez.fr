/**
 * Couche données / provider de contenu — stub en attendant le futur provider.
 *
 * Point d'accès unique du front pour le contenu (posts, catégories, settings…).
 * Les routes et pages consomment `getContentClient()` (même forme que l'ancien
 * client CMS, pour ne rien casser) ; quand le provider sera branché, il
 * suffira d'implémenter `find` / `findGlobal` / `findByID` ici.
 */
import type { Post, Category, Tag, Setting, NavItem } from './types';

export type Where = Record<string, any>;

export type FindArgs = {
    collection: string;
    where?: Record<string, any>;
    limit?: number;
    page?: number;
    depth?: number;
    sort?: string;
    draft?: boolean;
    overrideAccess?: boolean;
    id?: string | number;
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

// Client de contenu exposé aux routes/pages — même forme que l'ancien client CMS.
export const getContentClient = async () => ({
    find,
    findGlobal,
    findByID,
    count: async (_args: any) => ({ totalDocs: 0 }),
    update: async (_args: any) => ({}),
    delete: async (_args: any) => ({}),
});

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

// Nav fallback — navigation par défaut tant que le provider n'est pas branché.
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
