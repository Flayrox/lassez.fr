import React from 'react';
import { Metadata } from 'next';
import Layout from '@/components/Layout';
import { getAboutData } from '@/lib/get-pages-data';
import RichTextRenderer from '@/components/RichTextRenderer';
import Image from 'next/image';

export async function generateMetadata(): Promise<Metadata> {
    const data = await getAboutData();
    return {
        title: `${data.title} | L'Assez`,
        description: "Découvrez la ligne éditoriale, la mission et le collectif derrière L'Assez.",
        alternates: {
            canonical: 'https://lassez.fr/a-propos',
        },
    };
}

export default async function AProposPage() {
    const data = await getAboutData();

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-12">
                <header className="mb-12 text-center">
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4">
                        {data.title.split(' ').map((word, i) => (
                            word.toLowerCase() === 'manifeste' ? (
                                <span key={i} className="underline decoration-4 decoration-lassez-red underline-offset-8"> {word} </span>
                            ) : ` ${word} `
                        ))}
                    </h1>
                    {data.version && (
                        <div className="inline-block border-2 border-black px-4 py-1 font-mono text-sm uppercase tracking-widest bg-white rotate-2 shadow-sm">
                            {data.version}
                        </div>
                    )}
                </header>

                <div className="bg-white p-8 md:p-16 border-4 border-black shadow-hard-xl relative">
                    <div className="absolute -top-3 left-8 w-4 h-8 border-l-2 border-r-2 border-t-2 border-gray-400 rounded-t-full"></div>

                    <div className="hidden md:flex absolute top-10 right-10 border-4 border-lassez-red rounded-full w-32 h-32 items-center justify-center transform -rotate-12 opacity-20 pointer-events-none">
                        <span className="text-lassez-red font-black text-xl text-center uppercase leading-none">Certifié<br />Indépendant</span>
                    </div>

                    <div className="prose prose-lg max-w-none font-serif text-ink leading-relaxed prose-p:mb-6 prose-headings:font-sans prose-headings:font-black prose-headings:uppercase">
                        {data.introText && (
                            <p className="first-letter:text-5xl first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:mt-[-10px]">
                                {data.introText}
                            </p>
                        )}

                        {data.manifestoSections && data.manifestoSections.map((section: any, i: number) => (
                            <React.Fragment key={i}>
                                <h3 className={`text-2xl border-l-4 ${section.variant === 'red' ? 'border-lassez-red' : 'border-black'} pl-4 bg-gray-50 py-2 mt-8 font-black uppercase`}>
                                    {section.title}
                                </h3>
                                <RichTextRenderer data={section.content} />
                            </React.Fragment>
                        ))}

                        {data.quote && (
                            <blockquote className="font-black text-xl italic text-center my-10 border-y-2 border-black py-6 bg-marker-yellow transform -rotate-1 shadow-hard-sm">
                                {data.quote}
                            </blockquote>
                        )}

                        {(data.signature?.line1 || data.signature?.line2) && (
                            <div className="font-mono text-sm text-right mt-12 pt-4 border-t-2 border-gray-200">
                                {data.signature.line1 && <p>{data.signature.line1}</p>}
                                {data.signature.line2 && <p>{data.signature.line2}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {data.team && data.team.length > 0 && (
                    <section className="mt-20">
                        <h2 className="text-3xl font-black uppercase mb-8 border-b-4 border-black inline-block">Le Noyau Dur</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {data.team.map((member, i) => {
                                const avatarUrl = typeof member.avatar === 'object' && member.avatar?.url 
                                    ? member.avatar.url 
                                    : `https://picsum.photos/seed/${i + 55}/100`;
                                
                                return (
                                    <div key={i} className="bg-black text-white p-4 border-2 border-white outline outline-2 outline-black shadow-hard">
                                        <div className="w-12 h-12 bg-gray-700 mb-4 rounded-full overflow-hidden grayscale border-2 border-white relative">
                                            <Image 
                                                src={avatarUrl} 
                                                alt={member.name} 
                                                fill 
                                                className="object-cover"
                                            />
                                        </div>
                                        <p className="font-mono font-bold uppercase tracking-widest text-sm">{member.name} / {member.role}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </Layout>
    );
}
