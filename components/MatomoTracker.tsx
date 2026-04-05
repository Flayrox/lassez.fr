'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
    interface Window {
        _paq: any[];
    }
}

const MatomoTracker = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const firstRender = useRef(true);

    useEffect(() => {
        // Ensure Matomo is initialized
        if (!window._paq) return;

        if (firstRender.current) {
            // First page view is handled by index.html script (for verification)
            firstRender.current = false;
            return;
        }

        // Track subsequent page views
        // We delay slightly to ensure the title matches the new page content if possible, 
        // although React Helmet or similar would be needed for perfect title syncing.
        // For now we just track the URL.
        window._paq.push(['setCustomUrl', window.location.href]);
        window._paq.push(['trackPageView']);

    }, [pathname, searchParams]);

    return null;
};

export default MatomoTracker;
