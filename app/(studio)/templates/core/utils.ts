/**
 * Utility to handle image URLs safely within the Studio.
 * Bypasses CORS and COEP (require-corp) issues by using our internal proxy.
 */
export function getSafeImageUrl(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return '';
    
    const trimmed = url.trim();
    if (!trimmed) return '';

    // If it's already a data URL, blob, or internal upload, return as is
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/uploads/')) {
        return trimmed;
    }

    // If it's an external URL, use our proxy
    if (trimmed.startsWith('http')) {
        // We avoid double proxying
        if (trimmed.includes('/api/proxy-image?url=')) return trimmed;
        
        return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
    }

    return trimmed;
}
