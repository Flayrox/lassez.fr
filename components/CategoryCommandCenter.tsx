'use client';

import React from 'react';
import Link from 'next/link';
import { 
    FileTextIcon, 
    AlertTriangleIcon, 
    UsersIcon, 
    SearchIcon, 
    LockIcon,
    HomeIcon,
    HeartIcon
} from './icons';

const categories = [
    { name: 'Révélations', slug: 'revelations', id: '12', code: 'PROT_01', icon: AlertTriangleIcon, color: 'text-lassez-red' },
    { name: 'Comprendre', slug: 'comprendre', id: '13', code: 'EDUC_22', icon: LockIcon, color: 'text-blue-500' },
    { name: 'Enquêtes', slug: 'enquetes', id: '11', code: 'FILE_66', icon: FileTextIcon, color: 'text-ink' },
    { name: 'Politique', slug: 'politique', id: '3', code: 'SYS_09', icon: SearchIcon, color: 'text-orange-500' },
    { name: 'Economie', slug: 'economie', id: '4', code: 'FIN_44', icon: HomeIcon, color: 'text-green-600' },
    { name: 'Santé', slug: 'sante', id: '7', code: 'BIO_77', icon: HeartIcon, color: 'text-pink-500' },
    { name: 'International', slug: 'international', id: '9', code: 'GLOB_88', icon: UsersIcon, color: 'text-ink' },
    { name: 'Social', slug: 'social', id: '6', code: 'CIV_33', icon: UsersIcon, color: 'text-ink' },
    { name: 'Education', slug: 'education', id: '5', code: 'STUD_55', icon: SearchIcon, color: 'text-ink' },
    { name: 'Travail', slug: 'travail', id: '8', code: 'LABOR_11', icon: UsersIcon, color: 'text-ink' },
];

const CategoryCommandCenter: React.FC = () => {
    return (
        <div className="w-full py-8">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-[2px] flex-grow bg-ink/10"></div>
                <h2 className="font-mono font-black text-[10px] uppercase tracking-[0.4em] text-ink/40">Secteurs_Exploration</h2>
                <div className="h-[2px] flex-grow bg-ink/10"></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {categories.map((cat) => (
                    <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        className="group relative bg-paper border-2 border-ink p-3 md:p-4 hover:bg-ink hover:text-paper transition-all duration-300 shadow-hard-xs hover:shadow-hard overflow-hidden"
                    >
                        {/* Background Code Decor */}
                        <div className="absolute -right-2 -bottom-2 font-mono text-4xl font-black opacity-[0.03] group-hover:opacity-10 group-hover:text-lassez-red transition-all">
                            {cat.code}
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[9px] font-black opacity-30 group-hover:opacity-100 transition-opacity">
                                    {cat.code}
                                </span>
                                <cat.icon className={`w-3 h-3 ${cat.color} group-hover:text-paper transition-colors`} />
                            </div>
                            
                            <h3 className="font-serif font-black uppercase text-xs md:text-sm tracking-tight leading-none">
                                {cat.name}
                            </h3>
                            
                            <div className="mt-3 flex items-center gap-1 overflow-hidden">
                                <div className="h-[2px] w-4 bg-lassez-red transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span className="font-mono text-[7px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity delay-100">Accéder</span>
                            </div>
                        </div>

                        {/* Corner Accents */}
                        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-transparent group-hover:border-lassez-red transition-all"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-transparent group-hover:border-lassez-red transition-all"></div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default CategoryCommandCenter;
