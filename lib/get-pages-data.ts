import { getPayloadClient } from './payload';
import { About, Legal } from '@/payload-types';
import { unstable_cache } from 'next/cache';

export const getAboutData = unstable_cache(
    async (): Promise<About> => {
        const payload = await getPayloadClient();
        const data = await payload.findGlobal({
            slug: 'about',
        });
        return data as About;
    },
    ['about-page'],
    { revalidate: 300, tags: ['about-page'] }
);

export const getLegalData = unstable_cache(
    async (): Promise<Legal> => {
        const payload = await getPayloadClient();
        const data = await payload.findGlobal({
            slug: 'legal',
        });
        return data as Legal;
    },
    ['legal-page'],
    { revalidate: 300, tags: ['legal-page'] }
);
