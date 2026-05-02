'use client';

import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useUI } from './UIProvider';
import { useSettings } from './SettingsProvider';

export function HeaderWrapper() {
    const { setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    
    // Hide if disabled in CMS OR if focus mode (via UIProvider)
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Header onMenuClick={() => setIsSidebarOpen(true)} />;
}

export function SidebarWrapper() {
    const { isSidebarOpen, setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    
    // Sidebar is linked to Header visibility
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />;
}

export function FooterWrapper() {
    const { footerVisible } = useUI();
    const settings = useSettings();
    
    if (!footerVisible || settings.displaySettings?.showFooter === false) {
        return null;
    }
    
    return <Footer />;
}
