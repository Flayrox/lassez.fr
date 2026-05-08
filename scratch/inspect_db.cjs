const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.globalSettings.findFirst();
    console.log('--- SETTINGS ---');
    console.log(settings);

    const topicsCount = await prisma.newsTopic.count();
    console.log('\n--- TOPICS COUNT ---');
    console.log(topicsCount);

    const latestTopics = await prisma.newsTopic.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
    });
    console.log('\n--- LATEST TOPICS ---');
    console.log(JSON.stringify(latestTopics, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
