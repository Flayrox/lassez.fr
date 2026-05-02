import { NavItem } from '@/types';
import { getSettings } from './get-settings';
import { Category } from '@/payload-types';
import { getPayloadClient } from './payload';
import Database from 'better-sqlite3';
import path from 'path';

/**
 * Fetch navigation items.
 * Prioritizes Payload CMS settings.
 * Falls back to local SQLite if Payload nav is empty.
 */
export async function getNavItems(all: boolean = false): Promise<NavItem[]> {
    try {
        const settings = await getSettings();
        
        // 1. Explicit navigation from Settings
        if (settings.navigation && settings.navigation.length > 0) {
            return settings.navigation
                .filter(item => item.enabled !== false) // Default to true if undefined
                .map((item, index) => {
                    let path = item.customUrl || '/';
                    
                    if (item.linkType === 'category' && typeof item.category === 'object' && item.category !== null) {
                        const cat = item.category as Category;
                        path = `/${cat.slug}`;
                    }

                    return {
                        slug: `nav-${index}`,
                        label: item.label,
                        path: path,
                        enabled: true,
                        badge: item.badge || null,
                        sort_order: index,
                    };
                });
        }

        // 2. Automatic categories if no explicit nav
        const payload = await getPayloadClient();
        const cats = await payload.find({
            collection: 'categories',
            where: {
                and: [
                    { enabled: { equals: true } },
                    { showInHeader: { equals: true } },
                ]
            },
            sort: 'sortOrder',
            limit: 20,
        });

        if (cats.docs.length > 0) {
            const navItems: NavItem[] = cats.docs.map((cat: any, index: number) => ({
                slug: cat.slug,
                label: cat.name,
                path: `/${cat.slug}`,
                enabled: true,
                badge: null,
                sort_order: index,
            }));

            return [
                { slug: 'la-une', label: 'La Une', path: '/', enabled: true, badge: null, sort_order: -1 },
                ...navItems
            ];
        }

    } catch (error) {
        console.error('[Nav] Failed to fetch settings/categories for navigation:', error);
    }

    // FINAL HARDCODED FALLBACK (If Payload returns nothing)
    const fallback: NavItem[] = [
        { slug: 'la-une', label: 'La Une', path: '/', enabled: true, badge: null, sort_order: 0 },
        { slug: 'enquetes', label: 'Enquêtes', path: '/enquetes', enabled: true, badge: null, sort_order: 1 },
        { slug: 'revelations', label: 'Flux Révélation', path: '/revelations', enabled: true, badge: null, sort_order: 2 },
        { slug: 'investigation', label: 'Investigation', path: '/investigation', enabled: true, badge: null, sort_order: 3 },
        { slug: 'comprendre', label: 'Comprendre', path: '/comprendre', enabled: true, badge: null, sort_order: 4 },
        { slug: 'elections', label: 'Élections', path: '/elections', enabled: true, badge: 'LIVE', sort_order: 5 },
        { slug: 'soutenir', label: 'Soutenir', path: '/soutenir', enabled: true, badge: null, sort_order: 6 },
    ];
    
    return all ? fallback : fallback.filter(item => item.enabled);
}
