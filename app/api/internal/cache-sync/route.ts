import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { errorToDaemon, logToDaemon } from '../../logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CacheSyncEvent = 'post.published' | 'config.updated' | 'nav.updated' | 'manual.revalidate';

type CacheSyncPayload = {
    event?: string;
    source?: string;
    sent_at?: string;
    post_id?: number;
    cache_scope?: string[];
    tags?: string[];
    paths?: string[];
};

const seenNonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TAGS = ['radar-config', 'wp-posts', 'wp-categories'];

function pruneNonces(now = Date.now()) {
    for (const [nonce, expiresAt] of seenNonces.entries()) {
        if (expiresAt <= now) {
            seenNonces.delete(nonce);
        }
    }
}

function timingSafeEqualHex(expected: string, provided: string) {
    if (!expected || !provided || expected.length !== provided.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
    } catch {
        return false;
    }
}

function getClientIp(request: Request) {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const realIp = request.headers.get('x-real-ip') || '';
    const candidate = forwardedFor.split(',')[0]?.trim() || realIp.trim() || '';
    return candidate;
}

function getAllowedIps() {
    return (process.env.RADAR_CACHE_SYNC_ALLOWED_IPS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function getScopeTags(payload: CacheSyncPayload) {
    const tags = new Set<string>(DEFAULT_TAGS);

    for (const tag of payload.tags || []) {
        const cleanTag = String(tag || '').trim();
        if (cleanTag) {
            tags.add(cleanTag);
        }
    }

    for (const tag of payload.cache_scope || []) {
        const cleanTag = String(tag || '').trim();
        if (cleanTag) {
            tags.add(cleanTag);
        }
    }

    return Array.from(tags);
}

function getScopePaths(payload: CacheSyncPayload) {
    const paths = new Set<string>(['/']);

    for (const path of payload.paths || []) {
        const cleanPath = String(path || '').trim();
        if (cleanPath) {
            paths.add(cleanPath);
        }
    }

    return Array.from(paths);
}

export async function POST(request: Request) {
    const secret = process.env.RADAR_CACHE_SYNC_SECRET || '';

    if (!secret) {
        return NextResponse.json({ success: false, error: 'cache_sync_not_configured' }, { status: 503 });
    }

    const allowedIps = getAllowedIps();
    const clientIp = getClientIp(request);
    if (allowedIps.length > 0 && (!clientIp || !allowedIps.includes(clientIp))) {
        logToDaemon(`[CACHE-SYNC] Rejet IP non autorisée: ${clientIp || 'unknown'}`);
        return NextResponse.json({ success: false, error: 'ip_not_allowed' }, { status: 403 });
    }

    const timestamp = request.headers.get('x-radar-timestamp') || '';
    const nonce = request.headers.get('x-radar-nonce') || '';
    const signature = request.headers.get('x-radar-signature') || '';
    const event = (request.headers.get('x-radar-event') || '') as CacheSyncEvent;

    if (!timestamp || !nonce || !signature) {
        return NextResponse.json({ success: false, error: 'missing_security_headers' }, { status: 400 });
    }

    const timestampNum = Number(timestamp);
    if (!Number.isFinite(timestampNum)) {
        return NextResponse.json({ success: false, error: 'invalid_timestamp' }, { status: 400 });
    }

    if (Math.abs(Date.now() - timestampNum) > MAX_CLOCK_SKEW_MS) {
        return NextResponse.json({ success: false, error: 'timestamp_out_of_range' }, { status: 403 });
    }

    pruneNonces();
    if (seenNonces.has(nonce)) {
        return NextResponse.json({ success: false, error: 'nonce_replayed' }, { status: 409 });
    }

    const rawBody = await request.text();
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${nonce}.${rawBody}`)
        .digest('hex');

    if (!timingSafeEqualHex(expectedSignature, signature)) {
        logToDaemon(`[CACHE-SYNC] Signature invalide pour event=${event || 'unknown'} ip=${clientIp || 'unknown'}`);
        return NextResponse.json({ success: false, error: 'invalid_signature' }, { status: 401 });
    }

    let payload: CacheSyncPayload;
    try {
        payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
        return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
    }

    seenNonces.set(nonce, Date.now() + NONCE_TTL_MS);

    const tags = getScopeTags(payload);
    const paths = getScopePaths(payload);

    for (const tag of tags) {
        try {
            revalidateTag(tag);
        } catch (error: any) {
            errorToDaemon(`[CACHE-SYNC] revalidateTag(${tag}) a échoué:`, error);
        }
    }

    for (const path of paths) {
        try {
            revalidatePath(path);
        } catch (error: any) {
            errorToDaemon(`[CACHE-SYNC] revalidatePath(${path}) a échoué:`, error);
        }
    }

    logToDaemon(`[CACHE-SYNC] Accepté event=${payload.event || event || 'unknown'} tags=${tags.join(',')} paths=${paths.join(',')} ip=${clientIp || 'unknown'}`);

    return NextResponse.json({
        success: true,
        invalidated: {
            tags,
            paths,
        },
    });
}