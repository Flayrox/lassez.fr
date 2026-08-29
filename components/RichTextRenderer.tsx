'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface RichTextRendererProps {
    data: any;
    className?: string;
}

/**
 * Rendu autonome des nœuds Lexical en HTML — sans dépendance au CMS
 * (déconnecté). Reprend le style
 * des anciens converters (upload, citation, lien, titres, listes, paragraphes).
 */

const headingClasses: Record<string, string> = {
    h1: "text-3xl md:text-5xl font-black uppercase text-ink mt-12 mb-6 tracking-tighter leading-none",
    h2: "text-2xl md:text-3xl font-black uppercase tracking-tighter text-ink mt-10 mb-4 border-b-2 border-lassez-border pb-2",
    h3: "text-xl md:text-2xl font-bold uppercase tracking-tight text-lassez-red mt-8 mb-3",
    h4: "text-lg md:text-xl font-semibold text-ink mt-6 mb-2",
    h5: "text-base font-bold font-mono text-ink mt-4 mb-2 uppercase",
    h6: "text-sm font-bold font-mono text-ink mt-4 mb-2 uppercase opacity-50",
};

function TextNode({ node }: { node: any }) {
    const text: string = node.text ?? '';
    const format: number = node.format ?? 0;

    // Bitmask Lexical : 1 bold, 2 italic, 4 strikethrough, 8 underline, 16 code
    let content: React.ReactNode = text;
    if (format & 1) content = <strong>{content}</strong>;
    if (format & 2) content = <em>{content}</em>;
    if (format & 8) content = <u>{content}</u>;
    if (format & 4) content = <del>{content}</del>;
    if (format & 16) content = <code>{content}</code>;

    return <>{content}</>;
}

function Nodes({ nodes }: { nodes: any[] }) {
    if (!Array.isArray(nodes)) return null;
    return (
        <>
            {nodes.map((node, index) => (
                <Node key={index} node={node} />
            ))}
        </>
    );
}

function Node({ node }: { node: any }) {
    if (!node || typeof node !== 'object') return null;

    switch (node.type) {
        case 'root':
            return <Nodes nodes={node.children} />;

        case 'text':
            return <TextNode node={node} />;

        case 'linebreak':
            return <br />;

        case 'paragraph': {
            if (!node.children?.length) return <br className="my-2" />;
            return (
                <p className="my-5 text-base md:text-lg leading-relaxed">
                    <Nodes nodes={node.children} />
                </p>
            );
        }

        case 'heading': {
            const Tag = (node.tag || 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return (
                <Tag className={headingClasses[Tag] || ''} id={node.value?.id || undefined}>
                    <Nodes nodes={node.children} />
                </Tag>
            );
        }

        case 'quote':
            return (
                <div className="relative my-8 pl-6 pr-4 py-4 italic font-serif text-lg bg-paper-bright border-l-4 border-lassez-red shadow-hard-sm">
                    <span className="absolute -left-3 -top-3 text-3xl text-lassez-red font-black opacity-50 select-none">"</span>
                    <div className="text-ink">
                        <Nodes nodes={node.children} />
                    </div>
                </div>
            );

        case 'list': {
            const Tag = node.tag === 'ol' ? 'ol' : 'ul';
            return (
                <Tag className={`my-6 pl-8 space-y-2 ${node.tag === 'ol' ? 'list-decimal font-mono text-sm' : 'list-disc'}`}>
                    <Nodes nodes={node.children} />
                </Tag>
            );
        }

        case 'listitem':
            return (
                <li>
                    <Nodes nodes={node.children} />
                </li>
            );

        case 'link': {
            const fields = node.fields || {};
            const newTabProps = fields.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
            return (
                <Link
                    href={fields.url || '#'}
                    className="text-lassez-red font-bold underline decoration-2 underline-offset-4 decoration-lassez-red/30 hover:bg-lassez-red hover:text-white transition-all"
                    {...newTabProps}
                >
                    <Nodes nodes={node.children} />
                </Link>
            );
        }

        case 'horizontalrule':
            return <hr className="my-10 border-t-2 border-dashed border-lassez-border opacity-30" />;

        case 'upload': {
            if (!node.value?.url) return null;
            return (
                <figure className="my-8 border-2 border-lassez-border shadow-hard bg-paper-bright p-1 relative group">
                    <Image
                        src={node.value.url}
                        alt={node.value.alt || ''}
                        width={node.value.width || 1200}
                        height={node.value.height || 800}
                        sizes="(max-width: 768px) 100vw, 800px"
                        className="w-full h-auto object-cover grayscale-[30%] contrast-125 group-hover:grayscale-0 transition-all duration-500"
                    />
                    {node.value.caption && (
                        <figcaption className="text-center font-mono text-[10px] uppercase py-2 text-ink opacity-70">
                            {typeof node.value.caption === 'string' ? node.value.caption : 'MÉDIA ATTACHÉ'}
                        </figcaption>
                    )}
                </figure>
            );
        }

        case 'code':
            return (
                <pre className="my-6 p-4 bg-ink text-paper overflow-x-auto font-mono text-sm">
                    <code>
                        <Nodes nodes={node.children} />
                    </code>
                </pre>
            );

        default:
            return node.children ? <Nodes nodes={node.children} /> : null;
    }
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({ data, className }) => {
    if (!data) return null;

    return (
        <div className={`rich-text-content ${className || ''}`}>
            <Node node={data} />
        </div>
    );
};

export default RichTextRenderer;
