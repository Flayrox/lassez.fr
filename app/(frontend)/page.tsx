import React from 'react';
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import HeroCarousel from '@/components/HeroCarousel';
import JoinUsBlock from '@/components/JoinUsBlock';
import { Metadata } from 'next';
import { WPPost, WPCategory } from '@/types';
import Layout from '@/components/Layout';
import TacticalNewsletter from '@/components/TacticalNewsletter';
import { getArticleUrl } from '@/lib/getArticleUrl';
import { getPayloadClient } from '@/lib/payload';
import { FlashInfoTicker } from '@/components/FlashInfoTicker';

export const metadata: Metadata = {
    title: {
        default: "L'Assez | Média d'investigation indépendant",
        template: "%s | L'Assez",
    },
    description: "L'Assez publie des enquêtes, des révélations et des décryptages politiques pour comprendre l'actualité sans filtre.",
    keywords: [
        "L'Assez",
        "l'Assez media",
        "journalisme d'investigation",
        "révélations",
        "enquêtes",
        "actualité politique",
    ],
    alternates: {
        canonical: 'https://lassez.fr',
    },
};

export default async function Home() {
    const payload = await getPayloadClient();

    // 1. Fetch main posts (Enquêtes & Dossiers - which are now strictly in the 'posts' collection)
    const postsRes = await payload.find({
        collection: 'posts',
        where: { _status: { equals: 'published' } },
        limit: 14,
        depth: 1,
        sort: '-publishedAt',
    });
    const filteredPosts = postsRes.docs as WPPost[];

    // 2. Fetch revelations from the new dedicated 'revelations' collection
    const revRes = await payload.find({
        collection: 'revelations',
        where: { _status: { equals: 'published' } },
        limit: 5,
        depth: 1,
        sort: '-createdAt',
    });
    const revelations = revRes.docs;

    const mainPosts = filteredPosts.slice(0, 3) || [];
    const secondaryPosts = filteredPosts.slice(3, 8) || [];

    return (
        <Layout>
            <div className="pb-12 md:pb-20 space-y-6 md:space-y-12">

                {/* Main Newspaper Layout */}
                <div className="flex flex-col gap-10 md:gap-14 max-w-5xl mx-auto w-full px-4 md:px-0">
                    {/* Top Section: Hero Article */}
                    <div className="w-full relative">
                        {mainPosts && mainPosts.length > 0 ? (
                            <HeroCarousel posts={mainPosts} />
                        ) : (
                            <div className="h-64 lg:h-[450px] bg-ink/5 animate-pulse border-4 border-lassez-border w-full"></div>
                        )}
                    </div>

                    <FlashInfoTicker />

                    {/* Tactical Newsletter Entry Point */}
                    <div className="w-full">
                        <TacticalNewsletter />
                    </div>

                    {/* Main Content Split: Recent Articles & Live Feed */}
                    <div className="flex flex-col lg:flex-row gap-8 md:gap-10">
                        {/* Left Column: Recent Articles (Bento/Brutalist Redesign) */}
                        <div className="lg:w-2/3 flex flex-col gap-6">
                            <div className="flex items-center justify-between border-b-4 border-ink pb-2">
                                <h2 className="font-serif font-black uppercase text-2xl md:text-3xl tracking-tighter text-ink flex items-center gap-3">
                                    <span className="bg-lassez-red text-ink px-2 py-0.5 transform -rotate-2">Articles</span>
                                    Récents
                                </h2>
                                <span className="font-mono text-[10px] font-bold tracking-widest text-ink/40 hidden sm:block">DATA_DUMP_RECENT</span>
                            </div>

                            <div className="flex flex-col gap-8 w-full">
                                {/* Article "Sub-Hero" (Premier des récents) */}
                                {secondaryPosts.length > 0 && (
                                    <div className="w-full">
                                        <ArticleCard post={secondaryPosts[0]} featured={true} />
                                    </div>
                                )}

                                {/* Grille "Bento" pour les 4 suivants */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full mt-2">
                                    {secondaryPosts.slice(1).map(post => (
                                        <div key={post.id} className="w-full h-full flex">
                                            <ArticleCard post={post} featured={false} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: En Direct Feed */}
                        <div className="lg:w-1/3 flex flex-col">
                            <div className="flex items-center justify-between mb-6 border-b-2 border-ink pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex items-center justify-center">
                                        <span className="absolute w-3 h-3 bg-lassez-red rounded-full animate-ping opacity-75"></span>
                                        <span className="relative w-2 h-2 bg-lassez-red rounded-full"></span>
                                    </div>
                                    <h3 className="font-mono font-black text-[10px] md:text-xs uppercase tracking-widest text-ink">Direct_Radar</h3>
                                </div>
                                <div className="font-mono text-[7px] text-lassez-red font-black uppercase tracking-widest animate-pulse">
                                    Live
                                </div>
                            </div>

                            <div className="space-y-4 relative flex-grow">
                                {revelations.length > 0 ? revelations.map((post: any, i: number) => (
                                    <Link
                                        key={post.id}
                                        href={`/revelations/${(post as any).slug || post.id}`}
                                        className="group block relative"
                                        style={{
                                            transform: `rotate(${(i % 2 === 0 ? 0.2 : -0.2) * (i + 1)}deg)`,
                                            zIndex: revelations.length - i
                                        }}
                                    >
                                        <div className="bg-paper border-2 border-ink shadow-hard-xs group-hover:shadow-hard group-hover:bg-yellow-50 transition-all duration-200 overflow-hidden relative">
                                            {/* Torn edge effect */}
                                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[radial-gradient(circle_at_left,_transparent_2px,_#000_2.5px)] bg-[length:4px_6px] opacity-10"></div>
                                            <div className="absolute top-0 right-0 bottom-0 w-1 bg-[radial-gradient(circle_at_right,_transparent_2px,_#000_2.5px)] bg-[length:4px_6px] opacity-10"></div>

                                            <div className="flex flex-col p-3">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="font-mono text-[9px] font-black bg-ink text-paper px-1.5 py-0.5">
                                                        {new Date(post.createdAt || new Date()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="font-mono text-[7px] text-ink/30 uppercase font-black">Lvl_{post.niveau_alerte || 'Public'}</span>
                                                </div>
                                                <h4 className="font-serif font-black text-ink uppercase text-[11px] md:text-xs leading-tight mb-1 group-hover:underline decoration-lassez-red decoration-2 underline-offset-4" dangerouslySetInnerHTML={{ __html: post.titre }} />
                                                <div className="font-serif text-[9px] text-ink/60 line-clamp-1 italic" dangerouslySetInnerHTML={{ __html: String(post.contenu_rapide_html || '').replace(/<[^>]+>/g, '') }} />
                                            </div>
                                        </div>
                                    </Link>
                                )) : (
                                    <div className="text-center py-6 border-2 border-dashed border-ink/10 rounded-lg">
                                        <span className="font-mono text-[9px] text-ink/20 font-black uppercase tracking-widest">Waiting_Input...</span>
                                    </div>
                                )}

                                {/* View all button */}
                                <div className="pt-1 flex justify-start">
                                    <Link href="/revelations" className="group flex items-center gap-3 text-ink hover:text-lassez-red transition-colors">
                                        <div className="h-[1px] w-4 bg-ink group-hover:w-8 group-hover:bg-lassez-red transition-all"></div>
                                        <span className="font-mono font-black text-[8px] uppercase tracking-widest">Historique_Complet</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="pt-4 max-w-5xl mx-auto w-full px-4 md:px-0">
                    <JoinUsBlock />
                </div>
            </div>
        </Layout >
    );
}
