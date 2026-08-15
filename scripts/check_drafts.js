import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const topics = await prisma.newsTopic.findMany({
        where: {
            createdAt: {
                gte: new Date('2026-05-15T00:00:00Z')
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    console.log(`Found ${topics.length} topics since 2026-05-15`);
    for (const t of topics) {
        console.log(`Topic ID: ${t.id} | Status: ${t.status} | CreatedAt: ${t.createdAt.toISOString()}`);
        console.log(`Taxonomy: ${t.taxonomy}`);
        console.log(`Tags: ${t.tags}`);
        console.log(`Raw final_draft:`);
        console.log(t.final_draft);
        console.log(`------------------------------------`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
