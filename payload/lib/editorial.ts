type AnyRecord = Record<string, any>;

type PayloadRequestLike = {
    payload?: {
        findByID?: (args: { collection: string; id: string | number; depth?: number }) => Promise<any>;
    };
};

function cleanString(value: unknown) {
    return String(value || '').trim();
}

export function slugifyEditorialValue(value: unknown, fallback = 'article') {
    const normalized = cleanString(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

export function getPublishedAtDefault(currentValue: unknown) {
    return cleanString(currentValue) ? currentValue : new Date().toISOString();
}

async function resolveCategorySlug(categoryValue: unknown, req?: PayloadRequestLike) {
    if (!categoryValue) return null;

    if (typeof categoryValue === 'object') {
        const slug = cleanString((categoryValue as AnyRecord).slug);
        if (slug) return slug;

        const relationId = (categoryValue as AnyRecord).id;
        if (!relationId || !req?.payload?.findByID) return null;

        try {
            const relation = await req.payload.findByID({ collection: 'categories', id: relationId, depth: 0 });
            return cleanString(relation?.slug) || null;
        } catch {
            return null;
        }
    }

    if (!req?.payload?.findByID) return null;

    try {
        const relation = await req.payload.findByID({ collection: 'categories', id: categoryValue as string | number, depth: 0 });
        return cleanString(relation?.slug) || null;
    } catch {
        return null;
    }
}

export async function resolvePrimaryCategorySlug(doc: AnyRecord | undefined, req?: PayloadRequestLike) {
    const categories = Array.isArray(doc?.categories) ? doc.categories : [];
    if (!categories.length) return null;

    return resolveCategorySlug(categories[0], req);
}

export function resolveCanonicalArticlePath(slug: string, categorySlug?: string | null) {
    const cleanSlug = cleanString(slug);
    if (!cleanSlug) return null;

    const cleanCategorySlug = cleanString(categorySlug);
    if (!cleanCategorySlug) {
        return `/article/${cleanSlug}`;
    }

    if (cleanCategorySlug === 'revelations') {
        return `/revelations/${cleanSlug}`;
    }

    if (cleanCategorySlug === 'comprendre') {
        return `/comprendre/${cleanSlug}`;
    }

    return `/${cleanCategorySlug}/${cleanSlug}`;
}

export async function resolvePostCanonicalPath(doc: AnyRecord | undefined, req?: PayloadRequestLike) {
    const slug = cleanString(doc?.slug);
    if (!slug) return null;

    const explicitCanonicalUrl = cleanString(doc?.canonicalUrl);
    if (explicitCanonicalUrl) {
        return explicitCanonicalUrl;
    }

    const primaryCategorySlug = await resolvePrimaryCategorySlug(doc, req);
    return resolveCanonicalArticlePath(slug, primaryCategorySlug);
}

export async function buildPostPreviewUrl(doc: AnyRecord | undefined, req?: PayloadRequestLike) {
    return resolvePostCanonicalPath(doc, req);
}
