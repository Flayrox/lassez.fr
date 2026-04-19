import payload from "payload";
import type { SanitizedConfig } from "payload";

export const script = async (config) => {
    await payload.init({ config });

    async function getTag(slug) {
        const r = await payload.find({ collection: "tags", where: { slug: { equals: slug } }, limit: 1 });
        return r.docs[0]?.id ?? null;
    }

    const tFR  = await getTag("france");
    const tIntl = await getTag("ukraine");
    const tPal = await getTag("palestine");
    const tFisc = await getTag("fiscalite");
    const tLob = await getTag("lobbies");
    const tCor = await getTag("corruption");
    const tMac = await getTag("macron");

    // Map: titre partiel -> { zone_geo, tags }
    const mapping = [
        { match: "LVMH",            zone: "france",        tags: [tFisc, tCor].filter(Boolean) },
        { match: "Sondage interne",  zone: "france",        tags: [tFR].filter(Boolean) },
        { match: "14 journalistes",  zone: "france",        tags: [tFR, tMac].filter(Boolean) },
        { match: "Netanyahu",        zone: "international", tags: [tPal].filter(Boolean) },
        { match: "APL",              zone: "france",        tags: [tFR, tMac].filter(Boolean) },
        { match: "Missiles",         zone: "international", tags: [tIntl].filter(Boolean) },
        { match: "Credit Suisse",    zone: "international", tags: [tFisc].filter(Boolean) },
    ];

    const all = await payload.find({ collection: "revelations", limit: 100, overrideAccess: true });
    for (const rev of all.docs) {
        const rule = mapping.find(m => rev.titre.includes(m.match));
        if (!rule) { payload.logger.info("SKIP " + rev.titre.substring(0,30)); continue; }
        await payload.update({ collection: "revelations", id: rev.id, overrideAccess: true,
            data: { zone_geo: rule.zone as 'france' | 'international', tags: rule.tags } });
        payload.logger.info("UPDATED " + rev.titre.substring(0,30) + " -> " + rule.zone);
    }

    payload.logger.info("Done.");
    process.exit(0);
};

try {
    const mod = await import("../payload.config");
    const config = await Promise.resolve(mod.default);
    await script(config);
} catch(e) { console.error(e); process.exit(1); }