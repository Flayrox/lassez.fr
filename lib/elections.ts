export function formatElectionLabel(slug: string): string {
    const map: Record<string, string> = {
        municipales: 'Municipales',
        presidentielles: 'Presidentielles',
        legislatives: 'Legislatives',
        europeennes: 'Europeennes',
        regionales: 'Regionales',
        departementales: 'Departementales',
        cantonales: 'Cantonales',
        referendums: 'Referendums',
    };

    return String(slug || '')
        .split('-')
        .filter(Boolean)
        .map((part) => {
            if (/^\d{4}$/.test(part)) return part;
            const raw = part.toLowerCase();
            if (map[raw]) return map[raw];
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        })
        .join(' ')
        .trim();
}

export function parseJsonArray(raw: string | undefined, fallback: string[] = []): string[] {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : fallback;
    } catch {
        return fallback;
    }
}
