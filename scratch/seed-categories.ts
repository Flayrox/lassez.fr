
import { getPayload } from 'payload';
import config from '../payload.config';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function seed() {
    const payload = await getPayload({ config });

    const revelationsCat = await payload.find({
        collection: 'categories',
        where: { slug: { equals: 'revelations' } },
    });

    if (revelationsCat.docs.length === 0) {
        console.log('Creating "Révélations" category...');
        await payload.create({
            collection: 'categories',
            data: {
                name: 'Révélations',
                slug: 'revelations',
                enabled: true,
            },
        });
        console.log('Done.');
    } else {
        console.log('"Révélations" category already exists.');
    }
}

seed().catch(console.error);
