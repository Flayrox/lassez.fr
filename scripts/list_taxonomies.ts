import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const t = await prisma.taxonomyTemplate.findUnique({ where: { name: 'FLASH' } });
    if (t) {
      console.log(`=== TAXONOMY: ${t.name} ===`);
      console.log(`displayName: ${t.displayName}`);
      console.log(`accentColor: ${t.accentColor}`);
      console.log(`formatInstructions:\n${t.formatInstructions}`);
      console.log(`outputSchemaJson:\n${t.outputSchemaJson}`);
      console.log(`examplesJson:\n${t.examplesJson}`);
      console.log(`===========================\n`);
    } else {
      console.log('FLASH taxonomy not found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
