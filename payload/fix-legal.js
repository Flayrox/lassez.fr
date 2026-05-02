import payload from 'payload';
import config from '../payload.config.js';

const toLexical = (lines) => {
    const lineArray = Array.isArray(lines) ? lines : lines.split('\n').filter(l => l.trim() !== '');
    const children = [];
    
    let currentList = null;

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
                children: [{ 
                    type: 'text', 
                    text: trimmed.substring(2), 
                    version: 1,
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                }],
                version: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
            });
        } else {
            currentList = null;
            children.push({
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                direction: 'ltr',
                children: [{ 
                    type: 'text', 
                    text: trimmed, 
                    version: 1,
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                }],
            });
        }
    });

    return {
        root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: children.length > 0 ? children : [{
                type: 'paragraph',
                format: '',
                version: 1,
                direction: 'ltr',
                children: [{ 
                    type: 'text', 
                    text: '', 
                    version: 1,
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                }],
            }],
        },
    };
};

async function run() {
    try {
        await payload.init({ config });

        console.log('Updating Legal Global...');
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

        console.log('Legal Global updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
