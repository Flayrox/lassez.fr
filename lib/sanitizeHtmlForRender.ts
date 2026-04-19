export function sanitizeHtmlForRender(value: unknown): string {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return '';

    return raw
        // React warns on script tags in client-rendered HTML; strip them entirely.
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove inline event handlers (onclick, onerror, ...).
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        // Neutralize javascript: URLs in href/src attributes.
        .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"');
}
