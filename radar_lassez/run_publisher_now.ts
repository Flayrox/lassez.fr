import { runPublisherNode } from './nodes/publisher';
import { prisma } from './lib/prisma';

async function main() {
    console.log("--- MANUAL PUBLISHER TRIGGER START ---");
    // On lance le node publisher qui va dépiler tout ce qui est dû (y compris ce qu'on vient d'approuver)
    await runPublisherNode();
    console.log("--- MANUAL PUBLISHER TRIGGER END ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
