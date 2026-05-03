import React from 'react';

/**
 * Composant réutilisable pour l'esthétique 'Lassez' (Bruit, Halftone)
 */
export const Aesthetics = {
    Noise: ({ opacity = 0.05, zIndex = 10, mixBlendMode = 'normal' }: { opacity?: number, zIndex?: number, mixBlendMode?: any }) => (
        <div 
            className="noise-overlay absolute inset-0 pointer-events-none" 
            style={{ opacity, zIndex, mixBlendMode }}
        />
    ),
    
    Halftone: ({ opacity = 0.2, zIndex = 5 }: { opacity?: number, zIndex?: number }) => (
        <div 
            className="halftone absolute inset-0 pointer-events-none" 
            style={{ opacity, zIndex }}
        />
    )
};
