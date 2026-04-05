
import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex mb-6 font-mono text-[10px] md:text-xs uppercase font-bold tracking-wider overflow-x-auto whitespace-nowrap scrollbar-hide no-print">
      <ul className="flex items-center space-x-2">
        <li>
          <Link href="/" className="text-gray-400 hover:text-black transition-colors">ACCUEIL</Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center space-x-2">
            <span className="text-lassez-red font-black">/</span>
            {item.path ? (
              <Link
                href={item.path}
                className="text-gray-400 hover:text-black transition-colors max-w-[150px] md:max-w-none truncate inline-block"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-black border-b-2 border-black max-w-[200px] md:max-w-none truncate inline-block">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Breadcrumb;
