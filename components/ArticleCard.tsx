
import React from 'react';
import Link from 'next/link';
import { WPPost, WPTerm, WPCategory } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getArticleUrl } from '../lib/getArticleUrl';
import { sanitizeHtmlForRender } from '../lib/sanitizeHtmlForRender';

interface ArticleCardProps {
    post: WPPost;
    tag?: string;
    featured?: boolean;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ post, tag, featured = false }) => {
    const imageUrl = (typeof post.featuredImage === 'object' && post.featuredImage?.url) ? post.featuredImage.url : `https://picsum.photos/seed/${post.id}/800/600`;
    const author = (typeof post.author === 'object' && post.author?.name) ? post.author.name : "Rédaction";
    const categories = Array.isArray(post.categories) ? post.categories.filter((cat): cat is WPCategory => typeof cat === 'object') : [];
    const titleHtml = sanitizeHtmlForRender(post.title);
    const excerptHtml = sanitizeHtmlForRender(post.excerpt || '');

    return (
        <Link href={getArticleUrl(post)} className="block h-full group">
            <article
                className={`
            relative bg-paper-bright border-2 border-lassez-border transition-all duration-300
            ${featured ? 'shadow-hard-xl' : 'shadow-hard'}
            group-hover:-translate-y-1 group-hover:-translate-x-1 group-hover:shadow-hard-xl
            flex flex-col h-full overflow-hidden
        `}
            >
                <div className="absolute top-0 right-0 w-8 h-8 bg-paper border-l-2 border-b-2 border-lassez-border z-20 pointer-events-none transition-transform group-hover:scale-110"></div>

                <div className="absolute -top-1 -left-1 z-30">
                    {tag ? (
                        <div className="bg-lassez-red text-ink text-[10px] md:text-xs font-black uppercase px-4 py-2 border-2 border-lassez-border shadow-hard-sm transform -rotate-1">
                            {tag}
                        </div>
                    ) : (
                        categories.slice(0, 1).map(cat => (
                            <div key={cat.id} className="bg-ink text-paper text-[9px] md:text-[10px] font-black uppercase px-3 py-1.5 border-2 border-lassez-border shadow-hard-sm transform -rotate-1">
                                {cat.name}
                            </div>
                        ))
                    )}
                </div>

                <div className={`relative border-b-2 border-lassez-border bg-ink/5 scanline overflow-hidden ${featured ? 'h-64 sm:h-[450px]' : 'h-52'}`}>
                    <img
                        src={imageUrl}
                        alt={post.title}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500`}
                    />
                </div>

                <div className="p-3 md:p-4 flex flex-col flex-grow bg-paper-bright relative z-10">
                    <div className="mb-2 flex items-center text-[9px] font-mono font-bold uppercase tracking-widest text-ink/40 border-b border-ink/10 pb-1.5">
                        <span>{format(new Date(post.publishedAt || post.createdAt), 'dd.MM.yyyy', { locale: fr })}</span>
                        <span className="mx-2">/</span>
                        <span className="text-lassez-red">{author.toUpperCase()}</span>
                    </div>

                    <h3
                        className={`font-serif font-black leading-[1.1] text-ink transition-colors ${featured ? 'text-xl md:text-2xl lg:text-3xl tracking-tighter uppercase' : 'text-sm md:text-base tracking-tight uppercase'}`}
                    >
                        <span className="text-highlight" dangerouslySetInnerHTML={{ __html: titleHtml }} />
                    </h3>

                    <div
                        className={`mt-2 font-serif text-ink/70 line-clamp-2 leading-snug ${featured ? 'text-base md:text-lg border-l-4 border-lassez-border pl-4' : 'text-xs'}`}
                        dangerouslySetInnerHTML={{ __html: excerptHtml }}
                    />

                    <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase bg-ink text-paper px-2 py-0.5 group-hover:bg-lassez-red group-hover:text-ink transition-colors">
                            VOIR LE DOSSIER
                        </span>
                        <div className="flex gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                            <div className="w-1 h-1 bg-ink rounded-full"></div>
                            <div className="w-1 h-1 bg-ink rounded-full"></div>
                            <div className="w-1 h-1 bg-ink rounded-full"></div>
                        </div>
                    </div>
                </div>
            </article>
        </Link>
    );
};

export default ArticleCard;
