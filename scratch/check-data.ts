
import { getPayload } from 'payload';
import config from '../payload.config';

async function check() {
    const payload = await getPayload({ config });
    const cats = await payload.find({
        collection: 'categories',
        limit: 100,
    });
    console.log('Categories:', JSON.stringify(cats.docs.map(c => ({ id: c.id, name: c.name, slug: c.slug })), null, 2));

    const posts = await payload.find({
        collection: 'posts',
        limit: 5,
    });
    console.log('Latest Posts:', JSON.stringify(posts.docs.map(p => ({ id: p.id, slug: p.slug, title: p.title })), null, 2));
}

check().catch(console.error);
