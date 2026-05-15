import { runPipeline } from './daemon';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

async function main() {
    logger.overrideConsole();
    console.log("--- MANUAL TRIGGER START ---");
    await runPipeline();
    console.log("--- MANUAL TRIGGER END ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
