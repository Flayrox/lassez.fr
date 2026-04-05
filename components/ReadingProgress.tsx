
import React, { useState, useEffect } from 'react';

const ReadingProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  const handleScroll = () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPosition = window.scrollY;
    // Evite la division par zéro
    if (totalHeight > 0) {
      const currentProgress = (scrollPosition / totalHeight) * 100;
      setProgress(currentProgress);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[60] pointer-events-none mix-blend-difference">
      <div
        className="h-full bg-lassez-red shadow-[0_0_8px_rgba(220,38,38,0.8)] transition-all duration-75 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

export default ReadingProgress;
