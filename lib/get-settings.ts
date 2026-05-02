import { getPayloadClient } from './payload';
import { Setting } from '@/payload-types';
import { unstable_cache } from 'next/cache';

export const getSettings = unstable_cache(
    async (): Promise<Setting> => {
        const payload = await getPayloadClient();
        const settings = await payload.findGlobal({
            slug: 'settings',
        });
        return settings as Setting;
    },
    ['site-settings'],
    { revalidate: 300, tags: ['site-settings'] }
);
