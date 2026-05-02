import payload from 'payload';
import type { SanitizedConfig } from 'payload';

export const script = async (config: SanitizedConfig) => {
    await payload.init({ config });

    const mandatoryCategories = [
        { name: 'Enquêtes', slug: 'enquetes', showInHeader: true },
        { name: 'Révélations', slug: 'revelations', showInHeader: true },
        { name: 'Investigation', slug: 'investigation', showInHeader: true },
        { name: 'Comprendre', slug: 'comprendre', showInHeader: true },
    ];

    for (const category of mandatoryCategories) {
        const existing = await payload.find({
            collection: 'categories',
            where: { slug: { equals: category.slug } },
            limit: 1,
        });

        if (!existing.docs.length) {
            await payload.create({ collection: 'categories', data: { ...category, enabled: true, sortOrder: 0 } });
        } else {
            // Update to ensure showInHeader is true
            await payload.update({
                collection: 'categories',
                id: existing.docs[0].id,
                data: { showInHeader: true }
            });
        }
    }

    // Seed Global Settings Navigation if empty
    const settings = await payload.findGlobal({ slug: 'settings' });
    if (!settings.navigation || settings.navigation.length === 0) {
        await payload.updateGlobal({
            slug: 'settings',
            data: {
                navigation: [
                    { label: 'La Une', linkType: 'custom', customUrl: '/' },
                    { label: 'Enquêtes', linkType: 'category', category: (await payload.find({ collection: 'categories', where: { slug: { equals: 'enquetes' } } })).docs[0]?.id as any },
                    { label: 'Révélations', linkType: 'category', category: (await payload.find({ collection: 'categories', where: { slug: { equals: 'revelations' } } })).docs[0]?.id as any },
                    { label: 'Investigation', linkType: 'category', category: (await payload.find({ collection: 'categories', where: { slug: { equals: 'investigation' } } })).docs[0]?.id as any },
                    { label: 'Comprendre', linkType: 'category', category: (await payload.find({ collection: 'categories', where: { slug: { equals: 'comprendre' } } })).docs[0]?.id as any },
                    { label: 'Élections', linkType: 'custom', customUrl: '/elections', badge: 'LIVE' },
                    { label: 'Soutenir', linkType: 'custom', customUrl: '/soutenir' },
                ]
            }
        });
    }

    // Helper to wrap text into a properly structured Lexical RichText
    const toLexical = (lines: string | string[]) => {
        const lineArray = Array.isArray(lines) ? lines : lines.split('\n').filter(l => l.trim() !== '');
        const children: any[] = [];
        
        let currentList: any = null;

        lineArray.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                if (!currentList) {
                    currentList = {
                        type: 'list',
                        listType: 'bullet',
                        tag: 'ul',
                        children: [],
                        version: 1,
                    };
                    children.push(currentList);
                }
                currentList.children.push({
                    type: 'listitem',
                    children: [{ type: 'text', text: trimmed.substring(2), version: 1 }],
                    version: 1,
                });
            } else {
                currentList = null;
                children.push({
                    type: 'paragraph',
                    format: '',
                    indent: 0,
                    version: 1,
                    children: [{ type: 'text', text: trimmed, version: 1 }],
                });
            }
        });

        return {
            root: {
                type: 'root',
                format: '' as any,
                indent: 0,
                version: 1,
                children: children.length > 0 ? children : [{
                    type: 'paragraph',
                    format: '' as any,
                    children: [{ type: 'text', text: '', version: 1 }],
                }],
            },
        } as any;
    };

    // Seed About Global
    await payload.updateGlobal({
        slug: 'about',
        data: {
            title: 'Le Manifeste',
            version: 'Document Fondateur v.1.0',
            introText: "L'Assez est né d'un constat simple : l'information dominante sert les intérêts d'une élite déconnectée des réalités des classes populaires. Les magouilles gouvernementales, les dérives autoritaires et les inégalités cachées sont trop souvent passées sous silence.",
            manifestoSections: [
                {
                    title: 'Notre Mission',
                    variant: 'red',
                    content: toLexical("Briser le silence. Nous menons des enquêtes rigoureuses et nous les restituons dans un langage clair, direct, sans concession. Nous ne sommes pas neutres : nous sommes du côté de celles et ceux qui subissent les injustices du système."),
                },
                {
                    title: "L'Information comme Arme",
                    variant: 'black',
                    content: toLexical("Nous croyons que l'information est une arme pour comprendre, pour s'organiser, pour agir. Nos enquêtes sont des outils pour l'action collective, pour que plus personne ne puisse dire \"on ne savait pas\"."),
                },
            ],
            quote: '"L’avenir est antifasciste."',
            signature: {
                line1: "Rédigé par le Collectif L'Assez.",
                line2: 'Paris, France.',
            },
            team: [
                { name: 'Camille D.', role: 'Investigation' },
                { name: 'Tarik B.', role: 'Data' },
                { name: 'Sarah L.', role: 'Terrain' },
            ],
        },
    });

    // Seed Legal Global
    await payload.updateGlobal({
        slug: 'legal',
        data: {
            title: 'Mentions Légales',
            lastUpdated: 'Mises à jour annuellement.',
            sections: [
                {
                    title: "L'Éditeur",
                    content: toLexical([
                        "Le site L'Assez est édité par l'association [NOM DE L'ASSOCIATION], régie par la loi du 1er juillet 1901.",
                        "- Siège social : [ADRESSE DE L'ASSOCIATION]",
                        "- Email de contact : contact@lassez.fr",
                        "- Directeur de la publication : [VOTRE NOM]"
                    ]),
                },
                {
                    title: "L'Hébergeur",
                    content: toLexical([
                        "Le site est hébergé par la société Hostinger International Ltd.",
                        "- Siège social : 61 Lordou Vironos Street, 6023 Larnaca, Chypre",
                        "- Site web : www.hostinger.fr"
                    ]),
                },
                {
                    title: 'Propriété Intellectuelle',
                    content: toLexical("Sauf mention contraire, tous les contenus de ce site (textes, images, graphismes, logo) sont la propriété exclusive de L'Assez. Toute reproduction, distribution, modification, adaptation, retransmission ou publication, même partielle, de ces différents éléments est strictement interdite sans l'accord exprès par écrit de l'éditeur."),
                },
                {
                    title: 'Données & Libertés',
                    content: toLexical("Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant."),
                    highlightBox: toLexical("Aucun cookie publicitaire n'est utilisé sur ce site. Nous utilisons uniquement des outils de mesure d'audience anonymes respectueux de votre vie privée."),
                },
            ],
        },
    });

    payload.logger.info('Payload seed completed');
    process.exit(0);
};

try {
    const configModule = await import('../payload.config');
    const config = await Promise.resolve(configModule.default as SanitizedConfig | Promise<SanitizedConfig>);
    await script(config);
} catch (error) {
    console.error('Payload seed failed.');
    console.error(error);
    process.exit(1);
}