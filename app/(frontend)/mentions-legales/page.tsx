import { Metadata } from 'next';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Mentions Légales | L'Assez",
    description: "Informations légales, hébergement et politique de confidentialité.",
};

export default function MentionsLegalesPage() {
    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-12 pt-6 px-4">
                <header className="mb-12 text-center border-b-4 border-lassez-border pb-8">
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 text-ink">
                        Mentions <span className="text-lassez-red underline decoration-4 underline-offset-8">Légales</span>
                    </h1>
                    <p className="font-mono text-xs md:text-sm uppercase tracking-widest opacity-60">
                        Mises à jour annuellement.
                    </p>
                </header>

                <div className="bg-paper-bright p-8 md:p-12 border-2 border-lassez-border shadow-hard space-y-12 text-ink">
                    <section>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-black font-mono">01</div>
                            <h2 className="text-2xl font-black uppercase">L'Éditeur</h2>
                        </div>
                        <p className="font-serif leading-relaxed">
                            Le site <strong>L'Assez</strong> est édité par l'association <strong>[NOM DE L'ASSOCIATION]</strong>,
                            régie par la loi du 1er juillet 1901.
                        </p>
                        <ul className="list-disc list-inside mt-4 font-mono text-sm space-y-2 ml-4">
                            <li><strong>Siège social :</strong> [ADRESSE DE L'ASSOCIATION]</li>
                            <li><strong>Email de contact :</strong> contact@lassez.fr</li>
                            <li><strong>Directeur de la publication :</strong> [VOTRE NOM]</li>
                        </ul>
                    </section>

                    <section>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-black font-mono">02</div>
                            <h2 className="text-2xl font-black uppercase">L'Hébergeur</h2>
                        </div>
                        <p className="font-serif leading-relaxed">
                            Le site est hébergé par la société <strong>Hostinger International Ltd.</strong>
                        </p>
                        <ul className="list-disc list-inside mt-4 font-mono text-sm space-y-2 ml-4">
                            <li><strong>Siège social :</strong> 61 Lordou Vironos Street, 6023 Larnaca, Chypre</li>
                            <li><strong>Site web :</strong> <a href="https://www.hostinger.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-lassez-red">www.hostinger.fr</a></li>
                        </ul>
                    </section>

                    <section>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-black font-mono">03</div>
                            <h2 className="text-2xl font-black uppercase">Propriété Intellectuelle</h2>
                        </div>
                        <p className="font-serif leading-relaxed">
                            Sauf mention contraire, tous les contenus de ce site (textes, images, graphismes, logo) sont la propriété exclusive de <strong>L'Assez</strong>.
                            Toute reproduction, distribution, modification, adaptation, retransmission ou publication, même partielle, de ces différents éléments est strictement interdite sans l'accord exprès par écrit de l'éditeur.
                        </p>
                    </section>

                    <section>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-black font-mono">04</div>
                            <h2 className="text-2xl font-black uppercase">Données & Libertés</h2>
                        </div>
                        <p className="font-serif leading-relaxed mb-4">
                            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant.
                        </p>
                        <div className="bg-lassez-red/10 border-l-4 border-lassez-red p-4 font-mono text-sm">
                            <p><strong>Aucun cookie publicitaire n'est utilisé sur ce site.</strong> Nous utilisons uniquement des outils de mesure d'audience anonymes respectueux de votre vie privée.</p>
                        </div>
                    </section>
                </div>
            </div>
        </Layout>
    );
}
