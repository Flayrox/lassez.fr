import { CollectionBeforeValidateHook } from 'payload';
import { GoogleGenerativeAI } from '@google/generative-ai';

type SeoPayload = {
    meta_title?: string | null;
    meta_description?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
};

type HookOptions = {
    collectionLabel: string;
    titleFields: string[];
    bodyFields: string[];
    outputMode: 'meta' | 'legacy' | 'both';
};

type GeminiSeoOptions = {
    collectionLabel: string;
    title: string;
    body: string;
    model?: string | null;
};

const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

function isObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractText(value: unknown, depth = 0): string {
    if (value == null || depth > 6) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        return value.map(item => extractText(item, depth + 1)).filter(Boolean).join(' ');
    }

    if (isObject(value)) {
        if (typeof value.text === 'string') return value.text.trim();
        if (typeof value.rendered === 'string') return value.rendered.trim();
        if (Array.isArray(value.children)) return extractText(value.children, depth + 1);
        if (value.root) return extractText(value.root, depth + 1);

        const keys = ['title', 'titre', 'name', 'excerpt', 'description', 'content', 'contenu_rapide', 'body'];
        return keys.map(key => extractText(value[key], depth + 1)).filter(Boolean).join(' ');
    }

    return '';
}

function firstText(source: Record<string, any> | undefined, keys: string[]): string {
    if (!source) return '';
    for (const key of keys) {
        const text = extractText(source[key]);
        if (text) return text;
    }
    return '';
}

function parseSeoResponse(raw: string): SeoPayload | null {
    const clean = raw.trim();
    if (!clean) return null;

    const match = clean.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : clean.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

    try {
        const parsed = JSON.parse(jsonText);
        return {
            meta_title: typeof parsed.meta_title === 'string' ? parsed.meta_title.trim() : null,
            meta_description: typeof parsed.meta_description === 'string' ? parsed.meta_description.trim() : null,
            seo_title: typeof parsed.seo_title === 'string' ? parsed.seo_title.trim() : null,
            seo_description: typeof parsed.seo_description === 'string' ? parsed.seo_description.trim() : null,
        };
    } catch {
        return null;
    }
}

function buildSeoPrompt({ collectionLabel, title, body }: GeminiSeoOptions) {
    return [
        `Tu es le rédacteur SEO en chef du média français l'Assez.`,
        `Écris des métadonnées naturelles, nettes, crédibles et optimisées pour Google News, Google Search et les réseaux sociaux.`,
        `Collection: ${collectionLabel}`,
        `Titre source: ${title || '(vide)'}`,
        `Contenu source: ${body || '(vide)'}`,
        '',
        `Réponds uniquement en JSON valide avec ces clés exactes:`,
        `{`,
        `  "meta_title": "titre SEO de 50 à 60 caractères",`,
        `  "meta_description": "description SEO de 150 à 160 caractères",`,
        `  "seo_title": "variante courte si utile",`,
        `  "seo_description": "variante courte si utile"`,
        `}`,
    ].join('\n');
}

export async function generateGeminiSeo(options: GeminiSeoOptions): Promise<SeoPayload | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const title = String(options.title || '').trim();
    const body = String(options.body || '').trim().slice(0, 2500);
    if (!title && !body) return null;
    const modelName = String(options.model || process.env.GEMINI_SEO_MODEL || FALLBACK_GEMINI_MODEL).trim() || FALLBACK_GEMINI_MODEL;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
            }
        });

        const result = await model.generateContent(buildSeoPrompt({
            collectionLabel: options.collectionLabel,
            title,
            body,
        }));

        const response = await result.response;
        return parseSeoResponse(response.text());
    } catch (error) {
        console.error('[SEO-GEMINI]', options.collectionLabel, error);
        return null;
    }
}

export function createGeminiSeoHook(options: HookOptions): CollectionBeforeValidateHook {
    return async ({ data, originalDoc, req }) => {
        const current = { ...(data || {}) } as Record<string, any>;
        const previous = { ...(originalDoc || {}) } as Record<string, any>;
        let modelOverride: string | null = null;

        try {
            const settings = await req?.payload?.findGlobal?.({ slug: 'settings', req });
            modelOverride = String(settings?.seoGeminiModel || '').trim() || null;
        } catch {
            modelOverride = null;
        }

        const existingMetaTitle = extractText(current.meta?.title || previous.meta?.title);
        const existingMetaDescription = extractText(current.meta?.description || previous.meta?.description);
        const existingSeoTitle = extractText(current.seoTitle);
        const existingSeoDescription = extractText(current.seoDescription);

        if (options.outputMode === 'meta' && existingMetaTitle && existingMetaDescription) return data;
        if (options.outputMode === 'legacy' && existingSeoTitle && existingSeoDescription) return data;
        if (options.outputMode === 'both' && existingMetaTitle && existingMetaDescription && existingSeoTitle && existingSeoDescription) return data;

        const title = firstText(current, options.titleFields) || firstText(previous, options.titleFields);
        const body = options.bodyFields
            .map(field => firstText(current, [field]) || firstText(previous, [field]))
            .filter(Boolean)
            .join('\n\n');

        if (!title && !body) return data;

        const seo = await generateGeminiSeo({
            collectionLabel: options.collectionLabel,
            title,
            body,
            model: modelOverride,
        });

        if (!seo) return data;

        if (options.outputMode === 'meta' || options.outputMode === 'both') {
            current.meta = current.meta || {};
            if (!current.meta.title && seo.meta_title) current.meta.title = seo.meta_title;
            if (!current.meta.description && seo.meta_description) current.meta.description = seo.meta_description;
        }

        if (options.outputMode === 'legacy' || options.outputMode === 'both') {
            if (!current.seoTitle && (seo.seo_title || seo.meta_title)) current.seoTitle = seo.seo_title || seo.meta_title;
            if (!current.seoDescription && (seo.seo_description || seo.meta_description)) current.seoDescription = seo.seo_description || seo.meta_description;
        }

        return current;
    };
}
