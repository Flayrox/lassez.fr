/* Dé-échappe output_schema_json des formats éditoriaux (double échappement
 * \n littéral → vrai retour à la ligne) et vérifie les exemples. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = (process.env.PAYLOAD_API_URL || process.env.PAYLOAD_SERVER_URL || 'http://localhost:5173')
    .replace(/\/+$/, '')
    .replace(/\/api\/payload$/, '') + '/api/payload';
const EMAIL = process.env.PAYLOAD_BOT_EMAIL || 'bot@lassez.fr';
const PASSWORD = process.env.PAYLOAD_BOT_PASSWORD || '';

function fixEscapes(obj) {
    if (typeof obj === 'string') return obj.replace(/\\n/g, '\n');
    if (Array.isArray(obj)) return obj.map(fixEscapes);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const k of Object.keys(obj)) out[k] = fixEscapes(obj[k]);
        return out;
    }
    return obj;
}

(async () => {
    const login = await fetch(BASE + '/authors/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!login.ok) throw new Error('login HTTP ' + login.status);
    const token = (await login.json()).token;
    const H = { 'Content-Type': 'application/json', Authorization: 'JWT ' + token };

    const list = await fetch(BASE + '/taxonomy-templates?limit=20&depth=0', { headers: H }).then((r) => r.json());
    for (const d of list.docs || []) {
        let os = d.output_schema_json;
        let changed = false;

        if (typeof os === 'string') {
            // La colonne text contient le JSON brut (avec \n littéraux dans les strings).
            let obj = null;
            try { obj = JSON.parse(os); } catch { /* pas du JSON valide : on laisse */ }
            if (obj) {
                const fixed = fixEscapes(obj);
                const pretty = JSON.stringify(fixed, null, 2);
                if (pretty !== os) changed = true;
                os = pretty;
            }
        } else if (os && typeof os === 'object') {
            const fixed = fixEscapes(os);
            const pretty = JSON.stringify(fixed, null, 2);
            if (pretty !== JSON.stringify(os)) changed = true;
            os = pretty;
        }

        // Vérif : présence de vrais retours à la ligne dans le body
        const bodyHasRealNewline = typeof os === 'string' && os.includes('\\n\\n') === false && os.includes(String.fromCharCode(10));
        const stillEscaped = typeof os === 'string' && /\\n/.test(os);

        const r = changed
            ? await fetch(BASE + '/taxonomy-templates/' + d.id, {
                  method: 'PATCH',
                  headers: H,
                  body: JSON.stringify({ output_schema_json: os }),
              })
            : null;
        console.log(
            d.name,
            changed ? 'PATCH ' + r.status : 'inchangé',
            '| real newlines:', (os.match(/\n/g) || []).length,
            '| encore échappé:', stillEscaped,
            '| examples:', (d.examples || []).length,
        );
    }
})().catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
});
