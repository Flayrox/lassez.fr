'use client';

import React from 'react';
import { RichText } from '@payloadcms/richtext-lexical/react';
import Image from 'next/image';

interface RichTextRendererProps {
    data: any;
    className?: string;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({ data, className }) => {
    if (!data) return null;

    return (
        <div className={`rich-text-content ${className || ''}`}>
            <RichText 
                data={data} 
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
                                        {node.value.caption}
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
                    list: ({ node, nodesToJSX }: any) => {
                        const Tag = node.tag === 'ol' ? 'ol' : 'ul';
                        return (
                            <Tag className={`my-6 pl-8 space-y-2 ${node.tag === 'ol' ? 'list-decimal font-mono text-sm' : 'list-disc'}`}>
                                {nodesToJSX({ nodes: node.children })}
                            </Tag>
                        );
                    },
                    listitem: ({ node, nodesToJSX }: any) => {
                        return (
                            <li className="leading-relaxed">
                                {nodesToJSX({ nodes: node.children })}
                            </li>
                        );
                    },
                    paragraph: ({ node, nodesToJSX }: any) => {
                        if (node.children?.length === 0) return <br className="my-2" />;
                        return (
                            <p className="my-5 leading-relaxed">
                                {nodesToJSX({ nodes: node.children })}
                            </p>
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
                            <Tag className={classes[Tag] || ''}>
                                {nodesToJSX({ nodes: node.children })}
                            </Tag>
                        );
                    },
                })}
            />
        </div>
    );
};

export default RichTextRenderer;
