/**
 * Utility to handle image URLs safely within the Studio.
 * Bypasses CORS and COEP (require-corp) issues by using our internal proxy.
 */
export function getSafeImageUrl(url: string | undefined): string {
    if (!url) return '';
    
    // If it's already a data URL, blob, or internal upload, return as is
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/uploads/')) {
        return url;
    }

    // If it's an external URL, use our proxy
    if (url.startsWith('http')) {
        // We avoid double proxying
        if (url.includes('/api/proxy-image?url=')) return url;
        
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }

    return url;
}
