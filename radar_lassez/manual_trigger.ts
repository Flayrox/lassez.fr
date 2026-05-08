import { runPipeline } from './daemon';
import { prisma } from './lib/prisma';

async function main() {
    console.log("--- MANUAL TRIGGER START ---");
    await runPipeline();
    console.log("--- MANUAL TRIGGER END ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
