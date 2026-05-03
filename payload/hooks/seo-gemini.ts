import { CollectionBeforeValidateHook } from 'payload';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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

const FALLBACK_GEMINI_MODEL = 'gemini-3-flash-preview';

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

function buildSeoPrompt({ collectionLabel, title, body }: GeminiSeoOptions) {
    return [
        `Tu es le rédacteur SEO en chef du média français l'Assez.`,
        `Écris des métadonnées naturelles, nettes, crédibles et optimisées pour Google News, Google Search et les réseaux sociaux.`,
        `Collection: ${collectionLabel}`,
        `Titre source: ${title || '(vide)'}`,
        `Contenu source: ${body || '(vide)'}`,
        '',
        `L'Assez est un média d'éducation populaire radical. Le ton doit être professionnel mais engagé.`,
    ].join('\n');
}

const responseSchema = {
  type: "object",
  properties: {
    meta_title: { type: "string" },
    meta_description: { type: "string" },
    seo_title: { type: "string" },
    seo_description: { type: "string" }
  },
  required: ["meta_title", "meta_description", "seo_title", "seo_description"]
};

export async function generateGeminiSeo(options: GeminiSeoOptions): Promise<SeoPayload | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const title = String(options.title || '').trim();
    const body = String(options.body || '').trim().slice(0, 4000);
    if (!title && !body) return null;
    
    const modelName = String(options.model || process.env.GEMINI_SEO_MODEL || FALLBACK_GEMINI_MODEL).trim() || FALLBACK_GEMINI_MODEL;

    try {
        const client = new GoogleGenAI({ 
            apiKey,
            httpOptions: { timeout: 120000 }
        });
        const response = await client.models.generateContent({ 
            model: modelName,
            contents: buildSeoPrompt({
                collectionLabel: options.collectionLabel,
                title,
                body,
            }),
            config: {
                temperature: 0.2,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW
                },
                responseMimeType: 'application/json',
                responseJsonSchema: responseSchema as any,
            }
        });

        const parsed = JSON.parse(response.text);
        return {
            meta_title: parsed.meta_title || null,
            meta_description: parsed.meta_description || null,
            seo_title: parsed.seo_title || null,
            seo_description: parsed.seo_description || null,
        };
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
