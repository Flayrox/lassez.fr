import { verifyPostPreviewToken } from './preview-token';

export type PreviewContext = {
    previewToken: string;
    previewId: string;
};

type SearchParamsRecord = Record<string, string | string[] | undefined> | undefined;

function cleanString(value: unknown) {
    return String(value || '').trim();
}

/**
 * Normalise la récupération du contexte de preview pour Next.js 15+
 * Gère à la fois les objets records et les Promises.
 */
export async function getPreviewContext(searchParams: Promise<SearchParamsRecord> | SearchParamsRecord) {
    const resolved = await searchParams;
    return getPreviewContextFromRecord(resolved);
}


function firstValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return cleanString(value[0]);
    }

    return cleanString(value);
}

export function hasPreviewAttempt(searchParams: URLSearchParams) {
    return Boolean(cleanString(searchParams.get('preview_token')) || cleanString(searchParams.get('preview_id')));
}

function toPreviewContext(token: string, previewId: string): PreviewContext | null {
    if (!token || !previewId) return null;

    const verified = verifyPostPreviewToken({ token, postId: previewId });
    if (!verified.valid) return null;

    return {
        previewToken: token,
        previewId,
    };
}

export function getPreviewContextFromURLSearchParams(searchParams: URLSearchParams) {
    const token = cleanString(searchParams.get('preview_token'));
    const previewId = cleanString(searchParams.get('preview_id'));
    return toPreviewContext(token, previewId);
}

export function getPreviewContextFromRecord(searchParams: SearchParamsRecord) {
    if (!searchParams) return null;
    const token = firstValue(searchParams.preview_token);
    const previewId = firstValue(searchParams.preview_id);
    return toPreviewContext(token, previewId);
}

export function applyPreviewParams(target: URLSearchParams, previewContext: PreviewContext | null) {
    if (!previewContext) return;

    target.set('preview_token', previewContext.previewToken);
    target.set('preview_id', previewContext.previewId);
}

export function withPreviewQuery(pathname: string, previewContext: PreviewContext | null) {
    if (!previewContext) return pathname;

    const parsed = new URL(pathname, 'https://preview.local');
    applyPreviewParams(parsed.searchParams, previewContext);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
