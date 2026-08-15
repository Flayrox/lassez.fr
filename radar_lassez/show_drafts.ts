import { payloadClient } from './lib/payload-client';

// Utilitaire : affiche les brouillons (statut DRAFTED) depuis Payload.
// Usage : npx tsx radar_lassez/show_drafts.ts
async function showDrafts() {
    const topics = await payloadClient.getSignalsByStatus('DRAFTED');

    console.log(`Trouvé ${topics.length} articles rédigés (statut: DRAFTED) dans Payload :\n`);

    topics.forEach((t: any, i: number) => {
        try {
            const draft = JSON.parse(t.final_draft);
            console.log(`\n=================================`);
            console.log(`   ARTICLE ${i + 1} - [${draft.taxonomie}]`);
            console.log(`=================================`);
            console.log(`📝 TITRE : ${draft.headline}`);
            console.log(`📍 GÉO : ${draft.geo}`);
            console.log(`🏷️ TAGS INTELLIGENTS : ${JSON.parse(t.tags).join(', ')}`);
            console.log(`\n💬 LEAD : ${draft.lead}`);
            console.log(`\n📄 CORPS : \n${draft.body}`);
            console.log(`\n🔍 REQUÊTE IMAGE : ${draft.image_search_queries?.join(', ')}`);
            console.log(`🎨 METADATA COULEUR : ${draft.metadata?.accent_color}`);
        } catch (e) {
            console.log(`Erreur de parsing sur l'article ${t.id}`);
        }
    });
}

showDrafts()
    .catch(console.error);
