'use client';

import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useUI } from './UIProvider';
import { useSettings } from './SettingsProvider';

import { usePathname, useSearchParams } from 'next/navigation';

export function HeaderWrapper() {
    const { setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const isPreview = searchParams?.has('preview_token');
    
    if (isPreview) {
        return null;
    }
    
    // Hide on radar-admin (Studio) routes
    if (pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login')) {
        return null;
    }
    
    // Hide if disabled in CMS OR if focus mode (via UIProvider)
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Header onMenuClick={() => setIsSidebarOpen(true)} />;
}

export function SidebarWrapper() {
    const { isSidebarOpen, setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPreview = searchParams?.has('preview_token');

    if (isPreview) {
        return null;
    }
    
    // Hide on radar-admin
    if (pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login')) {
        return null;
    }
    
    // Sidebar is linked to Header visibility
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />;
}

export function FooterWrapper() {
    const { footerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPreview = searchParams?.has('preview_token');

    if (isPreview) {
        return null;
    }
    
    if (pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login')) {
        return null;
    }
    
    if (!footerVisible || settings.displaySettings?.showFooter === false) {
        return null;
    }
    
    return <Footer />;
}
