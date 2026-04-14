export type CMSProvider = 'wordpress' | 'payload';

export function getCMSProvider(): CMSProvider {
    const raw = String(process.env.CMS_PROVIDER || 'payload').trim().toLowerCase();
    if (raw === 'payload') return 'payload';
    return 'wordpress';
}

export function isPayloadProvider(): boolean {
    return getCMSProvider() === 'payload';
}

export function getPayloadApiUrl(): string {
    const explicit = String(process.env.PAYLOAD_API_URL || '').trim().replace(/\/$/, '');
    if (explicit) return explicit;

    const serverUrl = String(process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173')
        .trim()
        .replace(/\/$/, '');

    return `${serverUrl}/api/payload`;
}
