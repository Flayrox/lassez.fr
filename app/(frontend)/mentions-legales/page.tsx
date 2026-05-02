import { Metadata } from 'next';
import Layout from '@/components/Layout';
import { getLegalData } from '@/lib/get-pages-data';
import RichTextRenderer from '@/components/RichTextRenderer';

export async function generateMetadata(): Promise<Metadata> {
    const data = await getLegalData();
    return {
        title: `${data.title} | L'Assez`,
        description: "Informations légales, hébergement et politique de confidentialité.",
        alternates: {
            canonical: 'https://lassez.fr/mentions-legales',
        },
    };
}

export default async function MentionsLegalesPage() {
    const data = await getLegalData();

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-12 pt-6 px-4">
                <header className="mb-12 text-center border-b-4 border-lassez-border pb-8">
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 text-ink">
                        {data.title.split(' ').map((word, i) => (
                            word.toLowerCase() === 'légales' ? (
                                <span key={i} className="text-lassez-red underline decoration-4 underline-offset-8"> {word} </span>
                            ) : ` ${word} `
                        ))}
                    </h1>
                    {data.lastUpdated && (
                        <p className="font-mono text-xs md:text-sm uppercase tracking-widest opacity-60">
                            {data.lastUpdated}
                        </p>
                    )}
                </header>

                <div className="bg-paper-bright p-8 md:p-12 border-2 border-lassez-border shadow-hard space-y-12 text-ink">
                    {data.sections && data.sections.map((section, i) => (
                        <section key={i}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-black font-mono">
                                    {(i + 1).toString().padStart(2, '0')}
                                </div>
                                <h2 className="text-2xl font-black uppercase">{section.title}</h2>
                            </div>
                            <div className="font-serif leading-relaxed prose prose-slate max-w-none">
                                <RichTextRenderer data={section.content} />
                            </div>
                            {section.highlightBox && (
                                <div className="bg-lassez-red/10 border-l-4 border-lassez-red p-4 font-mono text-sm mt-6">
                                    <RichTextRenderer data={section.highlightBox} />
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </Layout>
    );
}
