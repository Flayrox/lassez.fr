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
    request_id?: string;
    post_id?: number;
    post_ids?: number[];
    cache_scope?: string[];
    tags?: string[];
    paths?: string[];
};

const seenNonces = new Map<string, number>();
const seenRequests = new Map<string, { expiresAt: number; bodyHash: string; tags: string[]; paths: string[] }>();
const NONCE_TTL_MS = 10 * 60 * 1000;
const REQUEST_ID_TTL_MS = 30 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TAGS = ['radar-config', 'wp-posts', 'wp-categories'];

function pruneNonces(now = Date.now()) {
    for (const [nonce, expiresAt] of seenNonces.entries()) {
        if (expiresAt <= now) {
            seenNonces.delete(nonce);
        }
    }
}

function pruneRequests(now = Date.now()) {
    for (const [requestId, record] of seenRequests.entries()) {
        if (record.expiresAt <= now) {
            seenRequests.delete(requestId);
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

function normalizeIp(value: string) {
    const clean = String(value || '').trim();
    if (!clean) return '';

    // Common proxy format for IPv4 over IPv6 sockets.
    if (clean.startsWith('::ffff:')) {
        return clean.slice('::ffff:'.length);
    }

    return clean;
}

function getClientIps(request: Request) {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const realIp = request.headers.get('x-real-ip') || '';
    const forwarded = forwardedFor
        .split(',')
        .map((value) => normalizeIp(value))
        .filter(Boolean);
    const candidates = [...forwarded, normalizeIp(realIp)].filter(Boolean);
    return Array.from(new Set(candidates));
}

function getAllowedIps() {
    return (process.env.RADAR_CACHE_SYNC_ALLOWED_IPS || '')
        .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}

function isIpAllowlistEnforced() {
    const flag = (process.env.RADAR_CACHE_SYNC_ENFORCE_IPS || '').trim();
    return flag === '1' || flag.toLowerCase() === 'true';
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

function buildSuccessResponse(tags: string[], paths: string[], requestId: string) {
    return NextResponse.json({
        success: true,
        invalidated: {
            tags,
            paths,
        },
        request_id: requestId || null,
    }, {
        headers: {
            'Cache-Control': 'no-store',
            'X-Radar-Request-Id': requestId || '',
        },
    });
}

export async function POST(request: Request) {
    const secret = process.env.RADAR_CACHE_SYNC_SECRET || '';

    if (!secret) {
        return NextResponse.json({ success: false, error: 'cache_sync_not_configured' }, { status: 503 });
    }

    const allowedIps = getAllowedIps();
    const enforceIpAllowlist = isIpAllowlistEnforced();
    const clientIps = getClientIps(request);
    const hasAllowedIp = allowedIps.some((ip) => clientIps.includes(ip));
    if (enforceIpAllowlist && allowedIps.length > 0 && !hasAllowedIp) {
        logToDaemon(`[CACHE-SYNC] Rejet IP non autorisée: ${clientIps.join(',') || 'unknown'}`);
        return NextResponse.json({ success: false, error: 'ip_not_allowed' }, { status: 403 });
    }

    const timestamp = request.headers.get('x-radar-timestamp') || '';
    const nonce = request.headers.get('x-radar-nonce') || '';
    const signature = request.headers.get('x-radar-signature') || '';
    const event = (request.headers.get('x-radar-event') || '') as CacheSyncEvent;
    const requestId = (request.headers.get('x-radar-idempotency-key') || '').trim();

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
        logToDaemon(`[CACHE-SYNC] Signature invalide pour event=${event || 'unknown'} ips=${clientIps.join(',') || 'unknown'}`);
        return NextResponse.json({ success: false, error: 'invalid_signature' }, { status: 401 });
    }

    let payload: CacheSyncPayload;
    try {
        payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
        return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
    }

    const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    if (requestId) {
        pruneRequests();
        const previous = seenRequests.get(requestId);

        if (previous) {
            if (previous.bodyHash !== bodyHash) {
                return NextResponse.json({ success: false, error: 'idempotency_key_conflict' }, { status: 409 });
            }

            logToDaemon(`[CACHE-SYNC] Rejeu idempotent request_id=${requestId} event=${payload.event || event || 'unknown'} ips=${clientIps.join(',') || 'unknown'}`);
            return buildSuccessResponse(previous.tags, previous.paths, requestId);
        }
    }

    seenNonces.set(nonce, Date.now() + NONCE_TTL_MS);

    const tags = getScopeTags(payload);
    const paths = getScopePaths(payload);

    for (const tag of tags) {
        try {
            revalidateTag(tag, 'max');
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

    logToDaemon(`[CACHE-SYNC] Accepté event=${payload.event || event || 'unknown'} tags=${tags.join(',')} paths=${paths.join(',')} ips=${clientIps.join(',') || 'unknown'}`);

    const response = buildSuccessResponse(tags, paths, requestId);

    if (requestId) {
        seenRequests.set(requestId, {
            expiresAt: Date.now() + REQUEST_ID_TTL_MS,
            bodyHash,
            tags,
            paths,
        });
    }

    return response;
}