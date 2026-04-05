import { Metadata } from 'next';
import Layout from '../../components/Layout';

export const metadata: Metadata = {
    title: "Le Manifeste | L'Assez",
    description: "Notre mission : briser le silence. Découvrez qui nous sommes et pourquoi nous ne sommes pas neutres.",
};

export default function AProposPage() {
    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-12">
                <header className="mb-12 text-center">
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4">
                        Le <span className="underline decoration-4 decoration-lassez-red underline-offset-8">Manifeste</span>
                    </h1>
                    <div className="inline-block border-2 border-black px-4 py-1 font-mono text-sm uppercase tracking-widest bg-white rotate-2 shadow-sm">
                        Document Fondateur v.1.0
                    </div>
                </header>

                <div className="bg-white p-8 md:p-16 border-4 border-black shadow-hard-xl relative">
                    <div className="absolute -top-3 left-8 w-4 h-8 border-l-2 border-r-2 border-t-2 border-gray-400 rounded-t-full"></div>

                    <div className="hidden md:flex absolute top-10 right-10 border-4 border-lassez-red rounded-full w-32 h-32 items-center justify-center transform -rotate-12 opacity-20 pointer-events-none">
                        <span className="text-lassez-red font-black text-xl text-center uppercase leading-none">Certifié<br />Indépendant</span>
                    </div>

                    <div className="prose prose-lg max-w-none font-serif text-ink leading-relaxed prose-p:mb-6 prose-headings:font-sans prose-headings:font-black prose-headings:uppercase">
                        <p className="first-letter:text-5xl first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:mt-[-10px]">
                            <strong>L'Assez</strong> est né d'un constat simple : l'information dominante sert les intérêts d'une élite déconnectée des réalités des classes populaires. Les magouilles gouvernementales, les dérives autoritaires et les inégalités cachées sont trop souvent passées sous silence.
                        </p>

                        <h3 className="text-2xl border-l-4 border-lassez-red pl-4 bg-gray-50 py-2 mt-8">Notre Mission</h3>
                        <p>
                            Briser le silence. Nous menons des enquêtes rigoureuses et nous les restituons dans un langage clair, direct, sans concession. <strong>Nous ne sommes pas neutres</strong> : nous sommes du côté de celles et ceux qui subissent les injustices du système.
                        </p>

                        <h3 className="text-2xl border-l-4 border-black pl-4 bg-gray-50 py-2 mt-8">L'Information comme Arme</h3>
                        <p>
                            Nous croyons que l'information est une arme pour comprendre, pour s'organiser, pour agir. Nos enquêtes sont des outils pour l'action collective, pour que plus personne ne puisse dire "on ne savait pas".
                        </p>

                        <blockquote className="font-black text-xl italic text-center my-10 border-y-2 border-black py-6 bg-marker-yellow transform -rotate-1 shadow-hard-sm">
                            "L'avenir est antifasciste."
                        </blockquote>

                        <div className="font-mono text-sm text-right mt-12 pt-4 border-t-2 border-gray-200">
                            <p>Rédigé par le Collectif L'Assez.</p>
                            <p>Paris, France.</p>
                        </div>
                    </div>
                </div>

                <section className="mt-20">
                    <h2 className="text-3xl font-black uppercase mb-8 border-b-4 border-black inline-block">Le Noyau Dur</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {['Camille D. / Investigation', 'Tarik B. / Data', 'Sarah L. / Terrain'].map((member, i) => (
                            <div key={i} className="bg-black text-white p-4 border-2 border-white outline outline-2 outline-black shadow-hard">
                                <div className="w-12 h-12 bg-gray-700 mb-4 rounded-full overflow-hidden grayscale border-2 border-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`https://picsum.photos/seed/${i + 55}/100`} alt="Avatar" className="object-cover w-full h-full" />
                                </div>
                                <p className="font-mono font-bold uppercase tracking-widest text-sm">{member}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Layout>
    );
}
