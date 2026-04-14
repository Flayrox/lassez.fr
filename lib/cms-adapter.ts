import { getCMSApiBaseUrl, WORDPRESS_API_URL } from './api';
import { getCMSProvider } from './cms-provider';

export type CMSCategory = {
    id: number;
    name: string;
    slug: string;
    count?: number;
};

export type CMSPost = {
    id: number | string;
    slug: string;
    date: string;
    modified?: string;
    title: { rendered: string };
    excerpt: { rendered: string };
    content: { rendered: string };
    categories: number[];
    _embedded?: any;
    acf?: any;
};

function toWordPressQuery(path: string) {
    const baseUrl = getCMSProvider() === 'payload' ? getCMSApiBaseUrl() : WORDPRESS_API_URL;
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchCmsPosts(query = ''): Promise<CMSPost[]> {
    const res = await fetch(toWordPressQuery(`/posts${query ? `?${query}` : ''}`), {
        next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
}

export async function fetchCmsCategories(query = ''): Promise<CMSCategory[]> {
    const res = await fetch(toWordPressQuery(`/categories${query ? `?${query}` : ''}`), {
        next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
}

export async function fetchCmsTags(query = ''): Promise<CMSCategory[]> {
    const res = await fetch(toWordPressQuery(`/tags${query ? `?${query}` : ''}`), {
        next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
}