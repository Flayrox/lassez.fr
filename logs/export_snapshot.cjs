const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  const stamp = process.argv[2];

  const counts = await prisma.newsTopic.groupBy({
    by: ['status'],
    _count: { _all: true }
  });

  const drafted = await prisma.newsTopic.findMany({
    where: { status: 'DRAFTED' },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      taxonomy: true,
      geo: true,
      tags: true,
      final_draft: true,
      updatedAt: true
    }
  });

  const researched = await prisma.newsTopic.findMany({
    where: { status: 'RESEARCHED' },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      taxonomy: true,
      geo: true,
      tags: true,
      final_draft: true,
      updatedAt: true
    }
  });

  const safeParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const normalize = (rows) => rows.map((row) => ({
    id: row.id,
    status: row.status,
    taxonomy: row.taxonomy,
    geo: row.geo,
    tags: safeParse(row.tags || '[]', row.tags),
    updatedAt: row.updatedAt,
    final_draft: row.final_draft ? safeParse(row.final_draft, row.final_draft) : null
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    counts,
    samples: {
      drafted: normalize(drafted),
      researched: normalize(researched)
    }
  };

  const outPath = `logs/pipeline_snapshot_${stamp}.json`;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  await prisma.$disconnect();
  console.log(`SNAPSHOT_FILE=${outPath}`);
})();
