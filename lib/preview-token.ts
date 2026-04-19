import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_PREVIEW_TTL_SECONDS = 20 * 60;

type PostPreviewTokenData = {
    postId: string;
    slug: string;
    exp: number;
};

function cleanString(value: unknown) {
    return String(value || '').trim();
}

function getPreviewSecret() {
    return cleanString(process.env.PAYLOAD_PREVIEW_SECRET || process.env.PAYLOAD_SECRET);
}

function signEncodedPayload(encodedPayload: string) {
    const secret = getPreviewSecret();
    if (!secret) return '';
    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(a: string, b: string) {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) return false;
    return timingSafeEqual(aBuffer, bBuffer);
}

export function createPostPreviewToken(args: { postId: string | number; slug: string; ttlSeconds?: number }) {
    const postId = cleanString(args.postId);
    const slug = cleanString(args.slug);
    const ttlSeconds = Number(args.ttlSeconds || DEFAULT_PREVIEW_TTL_SECONDS);

    if (!postId || !slug) return '';

    const secret = getPreviewSecret();
    if (!secret) return '';

    const ttl = Number.isFinite(ttlSeconds) ? Math.max(60, Math.min(60 * 60, ttlSeconds)) : DEFAULT_PREVIEW_TTL_SECONDS;

    const now = Date.now();
    const tokenBucketMs = 60 * 1000;
    const bucketStart = Math.floor(now / tokenBucketMs) * tokenBucketMs;

    const payload: PostPreviewTokenData = {
        postId,
        slug,
        exp: bucketStart + ttl * 1000,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const signature = signEncodedPayload(encodedPayload);

    if (!signature) return '';
    return `${encodedPayload}.${signature}`;
}

export function verifyPostPreviewToken(args: { token: string; postId?: string | number; slug?: string }) {
    const token = cleanString(args.token);
    if (!token) return { valid: false as const };

    const secret = getPreviewSecret();
    if (!secret) return { valid: false as const };

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return { valid: false as const };

    const expectedSignature = signEncodedPayload(encodedPayload);
    if (!expectedSignature || !safeEqual(signature, expectedSignature)) {
        return { valid: false as const };
    }

    try {
        const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as PostPreviewTokenData;
        const postId = cleanString(parsed.postId);
        const slug = cleanString(parsed.slug);
        const exp = Number(parsed.exp || 0);

        if (!postId || !slug || !Number.isFinite(exp) || Date.now() > exp) {
            return { valid: false as const };
        }

        const expectedPostId = cleanString(args.postId);
        if (expectedPostId && expectedPostId !== postId) {
            return { valid: false as const };
        }

        const expectedSlug = cleanString(args.slug);
        if (expectedSlug && expectedSlug !== slug) {
            return { valid: false as const };
        }

        return {
            valid: true as const,
            postId,
            slug,
            exp,
        };
    } catch {
        return { valid: false as const };
    }
}
