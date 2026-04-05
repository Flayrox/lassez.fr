import React from 'react';

interface GlitchImageProps {
  src: string;
  alt: string;
  className?: string;
}

const GlitchImage: React.FC<GlitchImageProps> = ({ src, alt, className }) => {
  return (
    <div className={`relative overflow-hidden group ${className}`}>
      {/* Base Image */}
      <img 
        src={src} 
        alt={alt} 
        className="w-full h-full object-cover relative z-10"
      />
      
      {/* Glitch Layer 1 (Cyan/Red shift) */}
      <img 
        src={src} 
        alt="" 
        className="absolute top-0 left-0 w-full h-full object-cover opacity-0 group-hover:opacity-50 z-20 mix-blend-hard-light glitch-layer-1 filter contrast-200"
        style={{ transform: 'translate(-5px, 0)' }}
        aria-hidden="true"
      />

      {/* Glitch Layer 2 (Slice) */}
      <img 
        src={src} 
        alt="" 
        className="absolute top-0 left-0 w-full h-full object-cover opacity-0 group-hover:opacity-70 z-30 glitch-layer-2"
        style={{ transform: 'translate(5px, 0)' }}
        aria-hidden="true"
      />
      
      {/* CRT Scanline overlay on hover */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-0 group-hover:opacity-40 z-40 transition-opacity duration-100"></div>
    </div>
  );
};

export default GlitchImage;