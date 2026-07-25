'use client';

import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useUI } from './UIProvider';
import { useSettings } from './SettingsProvider';

import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Fonction utilitaire de détection du mode de prévisualisation (Preview / Live Preview)
 * 
 * Détermine si la page actuelle est affichée à l'intérieur de l'iframe de prévisualisation
 * du CMS Payload ou via une URL de brouillon.
 */
function checkIsPreview(pathname: string | null, searchParams: ReturnType<typeof useSearchParams>) {
    if (!pathname) return false;
    if (pathname.startsWith('/preview')) return true;
    if (searchParams?.has('preview_token')) return true;
    if (searchParams?.has('preview_id')) return true;
    return false;
}

/**
 * Composant Wrapper de l'En-tête (Header)
 * 
 * Masque automatiquement l'en-tête global du site sur les routes d'administration,
 * les fenêtres d'aperçu brouillon (Preview iframe) ou lorsque le mode sans distraction est activé.
 */
export function HeaderWrapper() {
    const { setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const isPreview = checkIsPreview(pathname, searchParams);
    
    // Masquer sur les pages de prévisualisation brouillon pour un rendu d'article pur
    if (isPreview) {
        return null;
    }
    
    // Masquer sur les routes d'administration du Studio Radar
    if (pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login')) {
        return null;
    }
    
    // Masquer si désactivé dans la configuration CMS globale ou via le mode Focus UI
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Header onMenuClick={() => setIsSidebarOpen(true)} />;
}

/**
 * Composant Wrapper de la Barre Latérale (Sidebar)
 * 
 * Masque la barre latérale de navigation sur les fenêtres de prévisualisation
 * et les routes d'administration.
 */
export function SidebarWrapper() {
    const { isSidebarOpen, setIsSidebarOpen, headerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPreview = checkIsPreview(pathname, searchParams);

    if (isPreview) {
        return null;
    }
    
    if (pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login')) {
        return null;
    }
    
    if (!headerVisible || settings.displaySettings?.showHeader === false) {
        return null;
    }
    
    return <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />;
}

/**
 * Composant Wrapper du Pied de Page (Footer)
 * 
 * Masque le pied de page global du site sur les fenêtres de prévisualisation
 * pour offrir une zone de lecture épurée et sans distraction dans l'éditeur.
 */
export function FooterWrapper() {
    const { footerVisible } = useUI();
    const settings = useSettings();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPreview = checkIsPreview(pathname, searchParams);

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
