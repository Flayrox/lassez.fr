import payload from 'payload';
import type { SanitizedConfig } from 'payload';

export const script = async (config: SanitizedConfig) => {
    await payload.init({ config });

    const mandatoryCategories = [
        { name: 'Enquêtes', slug: 'enquetes' },
        { name: 'Révélations', slug: 'revelations' },
        { name: 'Comprendre', slug: 'comprendre' },
    ];

    for (const category of mandatoryCategories) {
        const existing = await payload.find({
            collection: 'categories',
            where: { slug: { equals: category.slug } },
            limit: 1,
        });

        if (!existing.docs.length) {
            await payload.create({ collection: 'categories', data: { ...category, enabled: true, sortOrder: 0 } });
        }
    }

    payload.logger.info('Payload seed completed');
    process.exit(0);
};