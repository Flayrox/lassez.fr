'use client';

import React, { useEffect, useState, useRef } from 'react';
import { WPPost, WPTerm } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ShareIcon, SaveIcon, LoaderIcon, EyeIcon, UsersIcon } from './icons';
import ArticleCard from './ArticleCard';
import KeyPoints from './KeyPoints';
import CallToActionBlock from './CallToActionBlock';
import ReadingProgress from './ReadingProgress';
import GlitchImage from './GlitchImage';
import Breadcrumb from './Breadcrumb';
import { RichText } from '@payloadcms/richtext-lexical/react';
import { sanitizeHtmlForRender } from '../lib/sanitizeHtmlForRender';
import Image from 'next/image';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ArticleClientProps {
    post: WPPost;
    relatedPosts: WPPost[];
    slug: string;
    isPreview?: boolean;
    livePreviewServerURL: string;
    variant?: 'full' | 'editorial';
}

const ArticleClient: React.FC<ArticleClientProps> = ({ post: initialPost, relatedPosts, slug, isPreview = false, livePreviewServerURL, variant = 'full' }) => {
    const [post, setPost] = useState<WPPost>(initialPost as any);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isPreview) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'payload-live-preview') {
                if (event.data.data) {
                    setPost((prev) => ({ ...prev, ...event.data.data }));
                }
            }
        };

        window.addEventListener('message', handleMessage);

        const parent = window.opener || window.parent;
        if (parent && parent !== window) {
            parent.postMessage({ type: 'payload-live-preview', ready: true }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, [isPreview]);

    useEffect(() => {
        if (isPreview) {
            console.log('[LIVE PREVIEW DEBUG] Current data:', { title: post?.title, hasContent: !!post?.content });
        }
    }, [post, isPreview]);

    const isEditorialVariant = variant === 'editorial';

    const articleRef = useRef<HTMLElement>(null);
    const [shareFeedback, setShareFeedback] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [readerMode, setReaderMode] = useState(false);
    const [activeReaders, setActiveReaders] = useState(12);

    useEffect(() => {
        setActiveReaders(Math.floor(Math.random() * (150 - 20 + 1)) + 20);
    }, [slug]);

    const imageUrl = (typeof post.featuredImage === 'object' && post.featuredImage?.url) ? post.featuredImage.url : `https://picsum.photos/seed/${post.id}/1200/600`;
    const author = (typeof post.author === 'object' && post.author?.name) ? post.author.name : "Rédaction";
    const categories = Array.isArray(post.categories) ? post.categories.filter((cat): cat is typeof post.categories[0] & object => typeof cat === 'object') as WPTerm[] : [];
    const titleHtml = sanitizeHtmlForRender(post.title);
    const bodyHtml = sanitizeHtmlForRender(post.content_html || post.excerpt || '');

    const rawKeyPoints = post.acf?.key_points;
    let keyPoints: string[] = [];
    if (rawKeyPoints) {
        if (Array.isArray(rawKeyPoints)) keyPoints = rawKeyPoints;
        else if (typeof rawKeyPoints === 'string') keyPoints = rawKeyPoints.split('\n').filter(line => line.trim() !== '');
    }

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({ title: post.title, url: window.location.href });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setShareFeedback('COPIÉ');
                setTimeout(() => setShareFeedback(''), 2000);
            }
        } catch (e) { }
    };

    const handleSaveAsPdf = () => {
        if (articleRef.current) {
            setIsGeneratingPdf(true);
            html2canvas(articleRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#FBF9F4' }).then(canvas => {
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, canvas.height * 210 / canvas.width);
                pdf.save(`RAPPORT_LASSEZ_${post.id}.pdf`);
                setIsGeneratingPdf(false);
            }).catch(() => setIsGeneratingPdf(false));
        }
    };

    return (
        <div className={`max-w-4xl mx-auto relative pb-8 transition-all ${readerMode ? 'bg-paper-bright' : ''}`}>
            {isPreview && !isEditorialVariant && (
                <div className="sticky top-2 z-50 mx-4 md:mx-0 mb-3 flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border-2 border-lassez-border bg-yellow-400 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-ink shadow-hard-sm">
                        <span>Preview brouillon</span>
                        <span className="opacity-70">mode sécurisé</span>
                    </div>
                </div>
            )}

            {!isEditorialVariant && <ReadingProgress />}

            {!isEditorialVariant && (
                <div className="flex justify-between items-end mb-3 mt-2 px-4 md:px-0">
                    <Breadcrumb items={[{ label: categories[0]?.name.toUpperCase() || 'DOSSIER', path: categories[0]?.slug && categories[0]?.slug !== 'revelations' ? `/enquetes?secteur=${categories[0].slug}` : undefined }]} />
                    <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase bg-ink text-paper px-2 py-1 border border-lassez-border">
                        <UsersIcon className="w-2.5 h-2.5 text-lassez-red animate-ping" />
                        <span>{activeReaders} DIRECT</span>
                    </div>
                </div>
            )}

            <article
                ref={articleRef}
                className={`relative ${readerMode ? 'bg-paper-bright px-4 py-4 md:py-12' : 'bg-paper px-4 md:px-0'}`}
            >
                <header className="text-center mb-6">
                    <h1 className={`font-serif font-black text-ink leading-tight mb-4 ${readerMode ? 'text-2xl md:text-5xl' : 'text-xl sm:text-3xl md:text-6xl uppercase tracking-tighter'}`} dangerouslySetInnerHTML={{ __html: isPreview ? post.title : titleHtml }} />

                    <div className="flex justify-center items-center gap-3 py-1.5 border-y border-lassez-border font-mono text-[8px] md:text-xs uppercase">
                        <div>PAR: <span className="font-black text-lassez-red">{author.toUpperCase()}</span></div>
                        <div className="opacity-20">|</div>
                        <div>{format(new Date(post.publishedAt || post.createdAt || Date.now()), 'dd.MM.yy', { locale: fr })}</div>
                    </div>
                </header>

                {!readerMode && (
                    <figure className="relative border border-lassez-border shadow-hard mb-6 overflow-hidden">
                        <GlitchImage src={imageUrl} alt={post.title} className="w-full max-h-[250px] md:max-h-[500px] object-cover filter contrast-125 saturate-50" />
                    </figure>
                )}

                {!isEditorialVariant && (
                <div className="flex flex-col items-center gap-6 mb-8 no-print sticky top-24 z-30">
                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={() => setReaderMode(!readerMode)}
                            className={`
                        group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard transition-all duration-200 uppercase font-black text-xs tracking-widest
                        ${readerMode ? 'bg-ink text-paper' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper hover:shadow-hard-xl hover:-translate-y-1'}
                    `}
                        >
                            <EyeIcon className={`w-4 h-4 ${readerMode ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                            <span>{readerMode ? 'Mode Standard' : 'Mode Lecture'}</span>
                        </button>

                        <button
                            onClick={handleShare}
                            className="group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard bg-paper-bright text-ink hover:bg-lassez-red hover:text-white hover:shadow-hard-xl hover:-translate-y-1 transition-all duration-200 uppercase font-black text-xs tracking-widest"
                        >
                            <ShareIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            <span>Partager</span>
                        </button>

                        <button
                            onClick={handleSaveAsPdf}
                            className="group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard bg-paper-bright text-ink hover:bg-lassez-red hover:text-white hover:shadow-hard-xl hover:-translate-y-1 transition-all duration-200 uppercase font-black text-xs tracking-widest"
                        >
                            <SaveIcon className="w-4 h-4 group-hover:bounce transition-transform" />
                            <span>{isGeneratingPdf ? 'Génération...' : 'PDF'}</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                        <span className="font-mono text-[10px] uppercase opacity-50 self-center mr-2">Classé dans :</span>
                        {categories.map(cat => cat.slug === 'revelations' ? (
                            <span
                                key={cat.id}
                                className="bg-ink/5 text-ink border border-lassez-border px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                            >
                                #{cat.name}
                            </span>
                        ) : (
                            <Link
                                key={cat.id}
                                href={`/enquetes?secteur=${cat.slug}`}
                                className="bg-ink/5 hover:bg-lassez-red hover:text-white text-ink border border-lassez-border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors"
                            >
                                #{cat.name}
                            </Link>
                        ))}
                    </div>
                </div>
                )}

                {keyPoints.length > 0 && <div className="mb-6"><KeyPoints points={keyPoints} /></div>}

                {post.content ? (
                    <div suppressHydrationWarning className={`max-w-none ${readerMode ? 'font-serif text-justify' : 'font-sans text-ink'}`}>
                        <RichText 
                            data={post.content as any} 
                            converters={({ defaultConverters }: any) => ({
                                ...defaultConverters,
                                upload: ({ node }: any) => {
                                    if (!node.value?.url) return null;
                                    return (
                                        <figure className="my-8 border-2 border-lassez-border shadow-hard bg-paper-bright p-1 relative group">
                                            <Image 
                                                src={node.value.url} 
                                                alt={node.value.alt || ''}
                                                  unoptimized={true} 
                                                width={node.value.width || 1200} 
                                                height={node.value.height || 800} 
                                                className="w-full h-auto object-cover grayscale-[30%] contrast-125 group-hover:grayscale-0 transition-all duration-500"
                                            />
                                            {node.value.caption && (
                                                <figcaption className="text-center font-mono text-[10px] uppercase py-2 text-ink opacity-70">
                                                    {typeof node.value.caption === 'string' ? node.value.caption : 'MÉDIA ATTACHÉ'}
                                                </figcaption>
                                            )}
                                        </figure>
                                    );
                                },
                                quote: ({ node, nodesToJSX }: any) => {
                                    return (
                                        <div className="relative my-8 pl-6 pr-4 py-4 italic font-serif text-lg bg-paper-bright border-l-4 border-lassez-red shadow-hard-sm">
                                            <span className="absolute -left-3 -top-3 text-3xl text-lassez-red font-black opacity-50 select-none">"</span>
                                            <div className="text-ink">
                                                {nodesToJSX({ nodes: node.children })}
                                            </div>
                                        </div>
                                    );
                                },
                                horizontalrule: () => {
                                    return <hr className="my-10 border-t-2 border-dashed border-lassez-border opacity-30" />;
                                },
                                link: ({ node, nodesToJSX }: any) => {
                                    const fields = node.fields || {};
                                    const newTabProps = fields.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
                                    return (
                                        <Link 
                                            href={fields.url || '#'} 
                                            className="text-lassez-red font-bold underline decoration-2 underline-offset-4 decoration-lassez-red/30 hover:bg-lassez-red hover:text-white transition-all"
                                            {...newTabProps}
                                        >
                                            {nodesToJSX({ nodes: node.children })}
                                        </Link>
                                    );
                                },
                                heading: ({ node, nodesToJSX }: any) => {
                                    const Tag = node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
                                    const classes = {
                                        h1: "text-3xl md:text-5xl font-black uppercase text-ink mt-12 mb-6 tracking-tighter leading-none",
                                        h2: "text-2xl md:text-3xl font-black uppercase tracking-tighter text-ink mt-10 mb-4 border-b-2 border-lassez-border pb-2",
                                        h3: "text-xl md:text-2xl font-bold uppercase tracking-tight text-lassez-red mt-8 mb-3",
                                        h4: "text-lg md:text-xl font-semibold text-ink mt-6 mb-2",
                                        h5: "text-base font-bold font-mono text-ink mt-4 mb-2 uppercase",
                                        h6: "text-sm font-bold font-mono text-ink mt-4 mb-2 uppercase opacity-50",
                                    };
                                    return (
                                        <Tag className={classes[Tag] || ''} id={node.value?.id || undefined}>
                                            {nodesToJSX({ nodes: node.children })}
                                        </Tag>
                                    );
                                },
                                list: ({ node, nodesToJSX }: any) => {
                                    const Tag = node.tag === 'ol' ? 'ol' : 'ul';
                                    const baseClass = "my-6 pl-8 space-y-2";
                                    return (
                                        <Tag className={`${baseClass} ${node.tag === 'ol' ? 'list-decimal font-mono text-sm' : 'list-disc'}`}>
                                            {nodesToJSX({ nodes: node.children })}
                                        </Tag>
                                    );
                                },
                                paragraph: ({ node, nodesToJSX }: any) => {
                                    if (node.children?.length === 0) return <br className="my-2" />;
                                    return (
                                        <p className="my-5 text-base md:text-lg leading-relaxed">
                                            {nodesToJSX({ nodes: node.children })}
                                        </p>
                                    );
                                }
                            })}
                        />
                    </div>
                ) : (
                    <div
                        className={`prose prose-neutral prose-sm sm:prose-base max-w-none ${readerMode ? 'prose-p:text-justify font-serif' : 'text-ink'}`}
                        dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                )}

                <div className="mt-10 md:mt-16 pt-6 border-t-4 border-double border-lassez-border text-center font-mono text-[8px] uppercase tracking-widest text-ink/20">
                    /// TRANSMISSION TERMINÉE ///
                </div>


            </article>

            {!readerMode && !isEditorialVariant && (
                <div className="px-4 md:px-0 space-y-12">
                    <CallToActionBlock onShare={handleShare} />

                    <section className="no-print pb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter shrink-0 text-ink">À LIRE AUSSI</h2>
                            <div className="h-[2px] w-full bg-lassez-border opacity-20"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {relatedPosts && relatedPosts.length > 0 ? (
                                relatedPosts.map(p => (
                                    <ArticleCard key={p.id} post={p} />
                                ))
                            ) : (
                                <p className="col-span-full font-mono text-[10px] text-center opacity-30 uppercase">Aucun dossier connexe disponible.</p>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {shareFeedback && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-lassez-red text-ink font-mono px-4 py-2 border border-lassez-border shadow-hard-sm z-[100] uppercase text-[9px] font-black animate-bounce">
                    {shareFeedback}
                </div>
            )}
        </div>
    );
};

export default ArticleClient;
