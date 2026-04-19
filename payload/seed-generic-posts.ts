import payload from 'payload';
import type { SanitizedConfig } from 'payload';
import { resolveCanonicalArticlePath } from './lib/editorial';

type PostFixture = {
    type: 'posts';
    categorySlug: string;
    title: string;
    excerpt: string;
    status: 'draft' | 'published';
};

type RevelationFixture = {
    type: 'revelations';
    title: string;
    excerpt: string;
    status: 'draft' | 'published';
    niveau_alerte: 'Public' | 'Confidentiel';
};

type LessonFixture = {
    type: 'lessons';
    title: string;
    excerpt: string;
    chapitre: string;
    status: 'draft' | 'published';
    niveau_difficulte: 'debute' | 'intermediaire' | 'avance';
};

type FixtureSpec = PostFixture | RevelationFixture | LessonFixture;

const FIXTURE_PREFIX = 'fixture-radar';

function buildLexicalParagraph(text: string): any {
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
                            text,
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

function buildFixtureSpecs(stamp: string): FixtureSpec[] {
    return [
        {
            type: 'posts',
            categorySlug: 'enquetes',
            title: `[Fixture] Enquete generique ${stamp}`,
            excerpt: 'Article de test genere automatiquement pour verifier le flux Payload -> API -> front.',
            status: 'published',
        },
        {
            type: 'revelations',
            title: `[Fixture] Revelation generique ${stamp}`,
            excerpt: 'Fixture de validation pour le silo Revelations.',
            status: 'draft',
            niveau_alerte: 'Public'
        },
        {
            type: 'lessons',
            title: `[Fixture] Lecon generique ${stamp}`,
            excerpt: 'Ce contenu est une lecon didactique.',
            chapitre: 'Initiation au radar',
            status: 'draft',
            niveau_difficulte: 'debute'
        },
    ];
}

export const script = async (config: SanitizedConfig) => {
    await payload.init({ config });

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fixtures = buildFixtureSpecs(stamp);
    const createdSummaries: string[] = [];

    // Ensure revelations category exists for frontend client
    const revelationsCatCheck = await payload.find({
        collection: 'categories',
        where: { slug: { equals: 'revelations' } },
        limit: 1,
    });
    if (!revelationsCatCheck.docs.length) {
        payload.logger.info('Ensuring "revelations" category exists...');
        await payload.create({
            collection: 'categories',
            overrideAccess: true,
            data: {
                name: 'Révélations',
                slug: 'revelations',
                enabled: true,
                sortOrder: 0
            }
        });
    }

    for (let index = 0; index < fixtures.length; index += 1) {
        const fixture = fixtures[index];
        const slug = `${FIXTURE_PREFIX}-${fixture.type}-${stamp}-${index + 1}`;

        if (fixture.type === 'posts') {
            let categoryLookup = await payload.find({
                collection: 'categories',
                where: { slug: { equals: fixture.categorySlug } },
                limit: 1,
            });

            if (!categoryLookup.docs.length) {
                payload.logger.info(`Creating missing category: ${fixture.categorySlug}`);
                await payload.create({
                    collection: 'categories',
                    overrideAccess: true,
                    data: {
                        name: fixture.categorySlug.charAt(0).toUpperCase() + fixture.categorySlug.slice(1),
                        slug: fixture.categorySlug,
                        enabled: true,
                        sortOrder: 0
                    }
                });
                
                categoryLookup = await payload.find({
                    collection: 'categories',
                    where: { slug: { equals: fixture.categorySlug } },
                    limit: 1,
                });
            }

            const existing = await payload.find({
                collection: 'posts',
                where: { slug: { equals: slug } },
                limit: 1,
                overrideAccess: true,
            });

            if (existing.docs.length) {
                createdSummaries.push(`EXISTS POST ${slug} (${fixture.status})`);
                continue;
            }

            await payload.create({
                collection: 'posts',
                overrideAccess: true,
                data: {
                    title: fixture.title,
                    slug,
                    excerpt: fixture.excerpt,
                    content: buildLexicalParagraph(
                        `${fixture.title}. Ce contenu est un fixture editorial pour valider la chaine complete de publication.`
                    ),
                    categories: [categoryLookup.docs[0].id],
                    status: fixture.status,
                    acf: {
                        securityLevel: 'PUBLIC',
                        sourcePdfUrl: 'https://lassez.fr',
                    }
                },
            });

            createdSummaries.push(`CREATED POST ${slug} (${fixture.status})`);
        }

        if (fixture.type === 'revelations') {
            const existing = await payload.find({
                collection: 'revelations',
                where: { titre: { equals: fixture.title } },
                limit: 1,
                overrideAccess: true,
            });

            if (existing.docs.length) {
                createdSummaries.push(`EXISTS REVELATION ${fixture.title}`);
                continue;
            }

            await payload.create({
                collection: 'revelations',
                overrideAccess: true,
                data: {
                    titre: fixture.title,
                    contenu_rapide: buildLexicalParagraph(fixture.excerpt),
                    niveau_alerte: fixture.niveau_alerte,
                    status: fixture.status
                }
            });
            createdSummaries.push(`CREATED REVELATION ${fixture.title}`);
        }

        if (fixture.type === 'lessons') {
            const existing = await payload.find({
                collection: 'lessons',
                where: { slug: { equals: slug } },
                limit: 1,
                overrideAccess: true,
            });

            if (existing.docs.length) {
                createdSummaries.push(`EXISTS LESSON ${slug}`);
                continue;
            }

            await payload.create({
                collection: 'lessons',
                overrideAccess: true,
                data: {
                    title: fixture.title,
                    slug: slug,
                    chapitre: fixture.chapitre,
                    numero_lecon: index,
                    niveau_difficulte: fixture.niveau_difficulte,
                    content: buildLexicalParagraph(fixture.excerpt),
                    status: fixture.status
                }
            });
            createdSummaries.push(`CREATED LESSON ${slug}`);
        }
    }

    if (!createdSummaries.length) {
        payload.logger.warn('No fixtures were created.');
    } else {
        createdSummaries.forEach((line) => payload.logger.info(line));
    }

    payload.logger.info('Generic fixtures completed.');
    process.exit(0);
};

try {
    const configModule = await import('../payload.config');
    const config = await Promise.resolve(configModule.default as SanitizedConfig | Promise<SanitizedConfig>);
    await script(config);
} catch (error) {
    console.error('Generic post fixture seed failed.');
    console.error(error);
    process.exit(1);
}
