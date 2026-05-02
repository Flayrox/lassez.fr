import payload from 'payload';
import config from '../payload.config.js';

function buildLexical(text) {
    return {
        root: {
            type: 'root',
            children: [
                {
                    type: 'paragraph',
                    version: 1,
                    format: '',
                    indent: 0,
                    direction: 'ltr',
                    children: [
                        {
                            type: 'text',
                            version: 1,
                            text: String(text),
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                        },
                    ],
                },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
        },
    };
}

async function run() {
    try {
        await payload.init({ config });

        console.log('Resetting Legal Global to simple text...');
        await payload.updateGlobal({
            slug: 'legal',
            data: {
                title: 'Mentions Légales',
                lastUpdated: 'Mise à jour : 02 Mai 2026',
                sections: [
                    {
                        title: "Éditeur",
                        content: buildLexical("Le site L'Assez est édité par le Collectif L'Assez."),
                    },
                    {
                        title: "Hébergeur",
                        content: buildLexical("Hébergé par Hostinger."),
                    }
                ],
            },
        });

        console.log('Legal Global reset successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
