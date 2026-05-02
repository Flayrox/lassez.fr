import { getPayload } from 'payload';
import config from '../payload.config';

async function createBot() {
    const payload = await getPayload({ config });
    const botEmail = 'bot@lassez.fr';
    const botPassword = 'LassezBotPassword2026!';
    
    try {
        const existing = await payload.find({
            collection: 'authors',
            where: { email: { equals: botEmail } }
        });
        
        if (existing.totalDocs > 0) {
            console.log('Bot already exists. Updating password...');
            await payload.update({
                collection: 'authors',
                id: existing.docs[0].id,
                data: { password: botPassword }
            });
            console.log('Bot password updated.');
        } else {
            console.log('Creating bot account...');
            await payload.create({
                collection: 'authors',
                data: {
                    name: 'Radar Bot',
                    slug: 'radar-bot',
                    email: botEmail,
                    password: botPassword,
                }
            });
            console.log('Bot account created successfully.');
        }
    } catch (e) {
        console.error('Failed to create bot:', e);
        process.exit(1);
    }
    process.exit(0);
}

createBot();