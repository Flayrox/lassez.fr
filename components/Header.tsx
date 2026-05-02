'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SearchIcon, MenuIcon } from './icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNav } from './NavProvider';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const [search, setSearch] = useState('');
  const [today, setToday] = useState(new Date());
  const { navItems } = useNav();
  const router = useRouter();

  // Horloge
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else if (window.scrollY < 30) {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const toggleRedTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isRed = document.body.classList.toggle('theme-red');
    localStorage.setItem('theme', isRed ? 'red' : 'standard');

    const dot = e.currentTarget as HTMLElement;
    dot.style.transform = 'scale(1.5)';
    setTimeout(() => dot.style.transform = '', 200);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-paper transition-shadow duration-300 ease-out ${isScrolled ? 'shadow-hard' : ''}`}>
      {/* Top Banner */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out border-b-lassez-border ${isScrolled
          ? 'max-h-0 opacity-0 border-b-0'
          : 'max-h-10 opacity-100 border-b-2 py-1.5'
          }`}
      >
        <div className="px-4 flex justify-between items-center text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest bg-paper-bright text-ink">
          <div className="flex gap-3 md:gap-4 shrink-0">
            <span>Vol. 03 / No. 42</span>
            <span className="hidden sm:inline">Paris, FR</span>
          </div>
          <div className="flex items-center gap-2 truncate px-2">
            <span className="w-1.5 h-1.5 bg-lassez-red rounded-full shrink-0 animate-pulse"></span>
            <span className="truncate uppercase">{format(today, 'd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className="hidden lg:block shrink-0">
            Accès : Public / Illimité
          </div>
        </div>
      </div>

      <div className={`container mx-auto px-4 transition-all duration-300 ease-in-out ${isScrolled ? 'py-1' : 'py-2 md:py-4'}`}>
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0">

          <div className="flex-1 flex items-center justify-between w-full md:w-auto">
            {/* Menu Button */}
            <button
              onClick={onMenuClick}
              className={`md:hidden text-ink border-2 border-lassez-border hover:bg-ink hover:text-paper transition-all shadow-hard-sm bg-paper-bright active:scale-95 ${isScrolled ? 'p-2' : 'p-3'}`}
              aria-label="Menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            {/* Logo */}
            <div className="flex items-center flex-1 justify-center md:justify-start ml-2 md:ml-0 h-8 md:h-12 transition-all duration-300">
              <div className={`flex items-baseline transition-transform duration-300 ease-out origin-left ${isScrolled ? 'scale-75' : 'scale-100'}`}>
                <Link href="/" className="group flex items-center">
                  <h1 className="font-serif font-black tracking-tightest uppercase cursor-pointer leading-none text-center md:text-left text-ink text-3xl sm:text-4xl md:text-6xl">
                    L'Assez
                  </h1>
                </Link>
                <span
                  onClick={toggleRedTheme}
                  className="font-serif font-black text-lassez-red hover:animate-ping cursor-pointer inline-block ml-1 select-none text-3xl sm:text-4xl md:text-6xl"
                  title="Mode Alerte"
                >
                  .
                </span>
              </div>
            </div>

            {/* Mobile Search */}
            <Link
              href="/search"
              className={`md:hidden text-ink border-2 border-lassez-border shadow-hard-sm bg-paper-bright active:scale-95 ${isScrolled ? 'p-2' : 'p-3'}`}
              aria-label="Recherche"
            >
              <SearchIcon className="w-6 h-6" />
            </Link>
          </div>

          {/* Right Side */}
          <div className={`hidden sm:flex flex-col items-center md:items-end gap-2 transition-all duration-300 ${isScrolled ? 'origin-right scale-90' : ''}`}>
            <div className={`hidden lg:block font-serif italic text-right max-w-xs leading-tight border-r-4 border-lassez-red pr-4 text-ink transition-all duration-300 ${isScrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
              "L'avenir est antifasciste."
            </div>

            <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SCANNER..."
                className={`
                  pl-3 pr-10 border-b-4 border-lassez-border bg-transparent font-mono focus:outline-none focus:bg-marker-yellow/20 text-ink placeholder:text-ink/40 transition-all duration-300
                  ${isScrolled ? 'w-24 lg:w-48 py-1 text-xs' : 'w-32 lg:w-72 py-2 text-sm'}
                `}
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink hover:text-lassez-red">
                <SearchIcon className={`transition-all duration-300 ${isScrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className={`border-y-4 border-lassez-border bg-paper-bright transition-all duration-300 ${isScrolled ? 'border-t-0' : ''}`}>
        <div className="container mx-auto flex justify-start md:justify-center overflow-x-auto whitespace-nowrap scrollbar-hide overscroll-contain">
          {navItems.map(item => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.slug}
                href={item.path}
                className={`
                  relative font-black text-[10px] md:text-xs uppercase tracking-widest px-5 md:px-6 transition-all duration-200 border-r border-lassez-border/10
                  ${isScrolled ? 'py-1.5' : 'py-2.5 md:py-3'}
                  ${isActive
                    ? 'bg-ink text-paper cursor-default pointer-events-none shadow-inner'
                    : 'text-ink hover:bg-ink hover:text-paper active:bg-ink active:text-paper'
                  }
                `}
              >
                {item.label}
                {item.badge && (
                  <span className="absolute top-0 right-0 bg-lassez-red text-paper text-[7px] font-black px-1 py-0.5 leading-none animate-pulse z-10 shadow-sm">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

export default Header;
