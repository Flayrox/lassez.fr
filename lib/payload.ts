import { getPayload } from 'payload';
import config from '@payload-config';

let cachedPayload: any = null;

export const getPayloadClient = async () => {
    if (cachedPayload) return cachedPayload;

    try {
        cachedPayload = await getPayload({ config });
        return cachedPayload;
    } catch (error) {
        console.error('[Payload Client] Initialization failed:', error);
        throw error;
    }
};
