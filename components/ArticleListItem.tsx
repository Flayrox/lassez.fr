
import React from 'react';
import Link from 'next/link';
import { WPPost, WPTerm } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import GlitchImage from './GlitchImage';
import { getArticleUrl } from '../lib/getArticleUrl';

interface ArticleListItemProps {
    post: WPPost;
}

const ArticleListItem: React.FC<ArticleListItemProps> = ({ post }) => {
    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://picsum.photos/seed/${post.id}/400/300`;
    const author = post._embedded?.author[0]?.name || "Rédaction";
    const categories: WPTerm[] = post._embedded?.['wp:term']?.[0] || [];

    return (
        <Link href={getArticleUrl(post)} className="block">
            <article
                className="group relative flex flex-col md:flex-row bg-white border-3 border-black shadow-hard hover:shadow-hard-xl hover:-translate-y-1 hover:-translate-x-1 transition-all duration-200 cursor-pointer min-h-[200px]"
            >
                <div className="md:w-64 h-48 md:h-auto flex-shrink-0 border-b-3 md:border-b-0 md:border-r-3 border-black relative bg-gray-100">
                    <div className="absolute top-0 left-0 flex flex-wrap gap-1 z-20">
                        {categories.slice(0, 2).map((cat) => (
                            <div key={cat.id} className="bg-black text-white text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5 border-r border-b border-white">
                                {cat.name}
                            </div>
                        ))}
                    </div>

                    <div className="absolute inset-0 w-full h-full">
                        <div className="absolute inset-0 bg-lassez-red mix-blend-multiply opacity-0 group-hover:opacity-20 transition-opacity z-10 pointer-events-none"></div>
                        <GlitchImage
                            src={imageUrl}
                            alt={post.title.rendered}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>
                </div>

                <div className="flex flex-col p-4 md:p-6 flex-grow justify-between relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                        <div className="w-2 h-2 bg-black rounded-full"></div>
                        <div className="w-2 h-2 border-2 border-black rounded-full"></div>
                    </div>

                    <div>
                        <div className="flex items-center text-[10px] font-mono font-bold text-gray-500 mb-3 border-b-2 border-gray-100 pb-2 uppercase tracking-widest">
                            <span>{format(new Date(post.date), 'dd.MM.yy', { locale: fr })}</span>
                            <span className="mx-2 text-lassez-red">///</span>
                            <span>Ag. {author.split(' ')[0]}</span>
                        </div>

                        <h3
                            className="text-lg md:text-2xl font-serif font-black text-ink leading-tight mb-3 group-hover:text-lassez-red transition-colors uppercase"
                            dangerouslySetInnerHTML={{ __html: post.title.rendered }}
                        />

                        <div
                            className="text-gray-600 font-sans text-sm leading-relaxed line-clamp-2 md:line-clamp-3"
                            dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }}
                        />
                    </div>

                    <div className="flex items-center justify-end pt-4 mt-2">
                        <span className="text-[10px] font-mono font-bold uppercase bg-white border-2 border-black px-3 py-1 group-hover:bg-black group-hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                            Ouvrir le dossier
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
};

export default ArticleListItem;
