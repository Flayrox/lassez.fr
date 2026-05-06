const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showDrafts() {
    const topics = await prisma.newsTopic.findMany({
        where: { status: 'DRAFTED' }
    });

    console.log(`Trouvé ${topics.length} articles rédigés (statut: DRAFTED) en base de données :\n`);

    topics.forEach((t, i) => {
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
    .catch(console.error)
    .finally(() => prisma.$disconnect());