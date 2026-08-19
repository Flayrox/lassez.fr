import type { PayloadHandler } from 'payload';

/**
 * Endpoint custom Payload : publie un sujet (signal) directement en
 * révélation publiée, sans attendre le prochain cycle du daemon.
 *
 * Réplique la logique du canal PAYLOAD du publisher Go (daemon/internal/
 * publish/payload.go) : titre → headline, corps → contenu_rapide (Lexical),
 * tags créés si absents, niveau d'alerte selon la taxonomie, zone géo, et
 * lien bidirectionnel signal ↔ révélation.
 *
 * Exposé sur : POST /api/payload/radar/publish-signal  { id }
 */
export const radarPublishSignalEndpoint: PayloadHandler = async (req) => {
    const user = req.user as { roles?: (string | { value: string })[] } | null;
    const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r?.value));
    if (!roles.includes('admin')) {
        return Response.json({ success: false, error: 'Accès refusé.' }, { status: 401 });
    }

    const body = (await req.json?.().catch(() => null)) || {};
    const id = body.id;
    if (!id) {
        return Response.json({ success: false, error: 'Identifiant du sujet manquant.' }, { status: 400 });
    }

    const signal = await req.payload.findByID({ collection: 'signals', id, depth: 0 }).catch(() => null);
    if (!signal) {
        return Response.json({ success: false, error: 'Sujet introuvable.' }, { status: 404 });
    }

    const draft = (signal.final_draft || {}) as Record<string, any>;
    const headline = String(draft.headline || signal.source_title || '').trim();
    if (!headline) {
        return Response.json({ success: false, error: 'Ce sujet n’a pas de titre rédigé (final_draft vide).' }, { status: 400 });
    }
    const bodyText = String(draft.body || '').trim();

    // Zone géo : France → france, sinon international (même règle que le Go).
    const geo = String(signal.geo || '').toUpperCase();
    const zoneGeo = geo === 'FRANCE' ? 'france' : 'international';

    // Niveau d'alerte : URGENT / FLASH → Confidentiel (même règle que le Go).
    const taxonomy = String(signal.taxonomy || '').toUpperCase();
    const niveauAlerte = taxonomy.includes('URGENT') || taxonomy.includes('FLASH') ? 'Confidentiel' : 'Public';

    // Tags : retrouver ou créer chacun (le daemon le fait de la même façon).
    let tags: string[] = [];
    if (Array.isArray(draft.tags)) tags = draft.tags.map(String).filter((t) => t.trim());
    if (!tags.length && Array.isArray(signal.tags)) tags = signal.tags.map(String).filter((t) => t.trim());

    const tagIDs: number[] = [];
    for (const name of tags) {
        const clean = name.trim();
        if (!clean) continue;
        const existing = await req.payload
            .find({ collection: 'tags', where: { name: { equals: clean } }, limit: 1, depth: 0 })
            .catch(() => null);
        if (existing?.docs?.length) {
            tagIDs.push(Number(existing.docs[0].id));
        } else {
            const created = await req.payload
                .create({ collection: 'tags', data: { name: clean, slug: clean } })
                .catch(() => null);
            if (created) tagIDs.push(Number(created.id));
        }
    }

    const now = new Date().toISOString();

    // Révélation publiée immédiatement.
    const revelation = await req.payload.create({
        collection: 'revelations',
        data: {
            titre: headline,
            slug: '', // généré par le hook beforeValidate
            contenu_rapide: lexicalParagraph(bodyText) as any,
            niveau_alerte: niveauAlerte,
            zone_geo: zoneGeo,
            ...(tagIDs.length ? { tags: tagIDs } : {}),
            source_signal: Number(signal.id),
            _status: 'published',
        },
    });

    // Relation inverse + statut final du signal.
    await req.payload.update({
        collection: 'signals',
        id,
        data: { status: 'PUBLISHED', published_at: now, revelation: Number(revelation.id) },
    });

    return Response.json({ success: true, revelation: revelation.id, url: `/admin/collections/revelations/${revelation.id}` });
};

/** Enveloppe un texte brut dans la structure Lexical attendue par le richText. */
function lexicalParagraph(text: string): Record<string, any> {
    return {
        root: {
            type: 'root',
            version: 1,
            format: '',
            indent: 0,
            direction: 'ltr',
            children: [
                {
                    type: 'paragraph',
                    version: 1,
                    format: '',
                    indent: 0,
                    direction: 'ltr',
                    children: [
                        {
                            type: 'text',
                            version: 1,
                            text: text || ' ',
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                        },
                    ],
                },
            ],
        },
    };
}
