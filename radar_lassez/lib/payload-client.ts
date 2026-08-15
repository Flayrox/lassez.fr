/**
 * PayloadClient — couche d'accès du daemon à Payload via l'API REST.
 *
 * Remplace l'ancien client Prisma (SQLite) : le daemon lit/écrit désormais
 * dans les collections Payload (signals, sources, publications, seen-urls,
 * taxonomy-templates) et le global radar-settings.
 *
 * Compatibilité : les champs JSON (raw_data, final_draft, tags, …) sont
 * exposés en STRING JSON — comme l'ancien schéma Prisma — pour que les
 * nœuds du pipeline restent inchangés (ils font JSON.parse(...)).
 */

// URL de base de l'API Payload (ex: https://api.lassez.fr/api/payload)
function getApiBase(): string {
    const envUrl = process.env.PAYLOAD_API_URL || process.env.PAYLOAD_URL || process.env.PAYLOAD_SERVER_URL;
    const base = envUrl || 'http://localhost:5173';
    const normalized = base.replace(/\/+$/, '');
    return normalized.includes('/api/payload') ? normalized : `${normalized}/api/payload`;
}

function stringifyJson(value: any): string {
    if (value === undefined || value === null) return '[]';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return '[]'; }
}

/** Convertit un champ json Payload (objet) en string JSON (compat Prisma). */
function toJsonString(value: any, fallback = '{}'): string {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return fallback; }
}

export class PayloadClient {
    private baseUrl: string;
    private token: string | null = null;
    private tokenExpiresAt: number = 0;
    private loginPromise: Promise<string> | null = null;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || getApiBase();
    }

    // ============================================================
    // AUTH JWT
    // ============================================================

    private async login(): Promise<string> {
        const now = Date.now();
        if (this.token && now < this.tokenExpiresAt) return this.token;

        if (!this.loginPromise) {
            this.loginPromise = (async () => {
                const email = process.env.PAYLOAD_ADMIN_EMAIL || process.env.PAYLOAD_BOT_EMAIL || 'bot@lassez.fr';
                const password = process.env.PAYLOAD_ADMIN_PASSWORD || process.env.PAYLOAD_BOT_PASSWORD || '';
                const res = await fetch(`${this.baseUrl}/authors/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`Payload login échoué (HTTP ${res.status}): ${text.slice(0, 200)}`);
                }
                const data = await res.json();
                if (!data.token) throw new Error('Payload login : aucun token reçu');
                this.token = data.token;
                // Le token Payload est valable 2h par défaut ; on rafraîchit à 90 min.
                this.tokenExpiresAt = now + 90 * 60 * 1000;
                return data.token;
            })().finally(() => {
                this.loginPromise = null;
            });
        }

        return this.loginPromise;
    }

    private async request<T = any>(method: string, path: string, body?: any, retry = true): Promise<T> {
        const token = await this.login();
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `JWT ${token}`,
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        // Token expiré : un seul refresh puis on renvoie.
        if (res.status === 401 && retry) {
            this.token = null;
            this.tokenExpiresAt = 0;
            return this.request(method, path, body, false);
        }

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Payload ${method} ${path} (HTTP ${res.status}): ${text.slice(0, 300)}`);
        }

        return res.json() as Promise<T>;
    }

    /** Token JWT courant (pour les appels directs à d'autres routes Payload). */
    async getToken(): Promise<string> {
        return this.login();
    }

    get apiBase(): string {
        return this.baseUrl;
    }

    // ============================================================
    // GLOBAL radar-settings (ex GlobalSettings)
    // ============================================================

    async getSettings(): Promise<any | null> {
        try {
            const data = await this.request('GET', '/globals/radar-settings');
            return data;
        } catch (e: any) {
            if (e.message.includes('404')) return null;
            throw e;
        }
    }

    /** Crée le global radar-settings s'il n'existe pas encore (défauts). */
    async ensureSettings(): Promise<any> {
        const existing = await this.getSettings();
        if (existing && existing.id) return existing;
        const data = await this.request('POST', '/globals/radar-settings', {});
        return data;
    }

    async updateSettings(data: any): Promise<any> {
        return this.request('PATCH', '/globals/radar-settings', data);
    }

    // ============================================================
    // SOURCES
    // ============================================================

    async getActiveSources(): Promise<any[]> {
        const data = await this.request<{ docs: any[] }>(
            'GET',
            '/sources?where[active][equals]=true&limit=1000&depth=0'
        );
        return (data.docs || []).map((doc) => ({
            id: doc.id,
            url: doc.url,
            type: doc.type,
            source_name: doc.source_name,
            source_bias: doc.source_bias,
            trust_score: doc.trust_score,
            allowSourceImages: doc.allow_source_images !== false,
            active: doc.active !== false,
            healthStatus: doc.health_status || 'OK',
            lastCheckAt: doc.last_check_at ? new Date(doc.last_check_at) : null,
            errorMessage: doc.error_message || null,
            responseTime: doc.response_time || null,
        }));
    }

    // ============================================================
    // SEEN URLS
    // ============================================================

    async getSeenUrls(): Promise<string[]> {
        const data = await this.request<{ docs: any[] }>(
            'GET',
            '/seen-urls?limit=0&depth=0&select[url]=true'
        );
        return (data.docs || []).map(d => d.url);
    }

    async addSeenUrls(urls: string[]): Promise<void> {
        for (const url of urls) {
            try {
                await this.request('POST', '/seen-urls', { url });
            } catch (e: any) {
                // Doublon possible (unique) : on ignore.
            }
        }
    }

    async purgeSeenUrls(before: Date): Promise<void> {
        const iso = before.toISOString();
        // Payload supporte la suppression multiple via where.
        await this.request('DELETE', `/seen-urls?where[createdAt][less_than]=${encodeURIComponent(iso)}`);
    }

    // ============================================================
    // SIGNALS (ex NewsTopic)
    // ============================================================

    async getSignal(id: string): Promise<any | null> {
        try {
            const data = await this.request<{ doc: any }>('GET', `/signals/${id}?depth=0`);
            if (!data?.doc) return null;
            return this.hydrateSignal(data.doc);
        } catch (e: any) {
            if (e.message.includes('404')) return null;
            throw e;
        }
    }

    async getSignalsByStatus(status: string, limit = 500): Promise<any[]> {
        const data = await this.request<{ docs: any[] }>(
            'GET',
            `/signals?where[status][equals]=${encodeURIComponent(status)}&limit=${limit}&depth=0&sort=createdAt`
        );
        return (data.docs || []).map(this.hydrateSignal);
    }

    async getSignalsSince(date: Date): Promise<any[]> {
        const iso = date.toISOString();
        const data = await this.request<{ docs: any[] }>(
            'GET',
            `/signals?where[createdAt][greater_than]=${encodeURIComponent(iso)}&limit=1000&depth=0`
        );
        return (data.docs || []).map(this.hydrateSignal);
    }

    /** Récupère les signals PENDING sans publication (relation single côté publications). */
    async getPendingSignalsWithoutPublications(): Promise<any[]> {
        const pending = await this.request<{ docs: any[] }>(
            'GET',
            '/signals?where[status][equals]=PENDING&limit=500&depth=0&sort=createdAt'
        );
        const pendingDocs = pending.docs || [];
        if (pendingDocs.length === 0) return [];

        // Récupère l'ensemble des signal_id déjà liés à une publication.
        const ids = pendingDocs.map((d: any) => d.id).join(',');
        const pubs = await this.request<{ docs: any[] }>(
            'GET',
            `/publications?where[signal][in]=${encodeURIComponent(ids)}&limit=500&depth=0`
        );
        const signalsWithPubs = new Set((pubs.docs || []).map((p: any) => String(typeof p.signal === 'string' ? p.signal : p.signal?.id)));

        return pendingDocs
            .filter((d: any) => !signalsWithPubs.has(String(d.id)))
            .map(this.hydrateSignal);
    }

    async updateSignal(id: string, data: any): Promise<void> {
        const payload: any = { ...data };
        for (const key of ['raw_data', 'final_draft', 'tags']) {
            if (payload[key] !== undefined) {
                payload[key] = safeParse(payload[key]);
            }
        }
        await this.request('PATCH', `/signals/${id}`, payload);
    }

    async updateManySignals(ids: string[], data: any): Promise<void> {
        for (const id of ids) {
            await this.updateSignal(id, data);
        }
    }

    async createSignals(rows: any[]): Promise<string[]> {
        const createdIds: string[] = [];
        for (const row of rows) {
            const payload: any = { ...row };
            for (const key of ['raw_data', 'final_draft', 'tags']) {
                if (payload[key] !== undefined) {
                    payload[key] = safeParse(payload[key]);
                }
            }
            // source_title sert de titre dans l'admin Payload : on l'extrait du raw_data si absent.
            if (!payload.source_title) {
                try {
                    const raw = typeof payload.raw_data === 'string' ? JSON.parse(payload.raw_data) : payload.raw_data;
                    payload.source_title = raw?.clusterTitle || raw?.headline || 'Sujet sans titre';
                } catch (e) {
                    payload.source_title = 'Sujet sans titre';
                }
            }
            try {
                const doc = await this.request<{ doc: any }>('POST', '/signals', payload);
                if (doc?.doc?.id) createdIds.push(doc.doc.id);
            } catch (e: any) {
                console.error('[PayloadClient] createSignal échoué:', e.message);
            }
        }
        return createdIds;
    }

    /** Reconstitue l'objet "topic" au format Prisma pour les nœuds. */
    private hydrateSignal(doc: any): any {
        return {
            id: doc.id,
            raw_data: toJsonString(doc.raw_data),
            final_draft: toJsonString(doc.final_draft, '{}'),
            status: doc.status,
            taxonomy: doc.taxonomy || null,
            tags: toJsonString(doc.tags, '[]'),
            geo: doc.geo || null,
            image_url: doc.image_url || null,
            scheduledAt: doc.scheduled_at ? new Date(doc.scheduled_at) : null,
            publishedAt: doc.published_at ? new Date(doc.published_at) : null,
            createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
            updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
            publications: doc.publications || [],
        };
    }

    // ============================================================
    // PUBLICATIONS
    // ============================================================

    async getLastScheduledPublication(platform: string): Promise<any | null> {
        const data = await this.request<{ docs: any[] }>(
            'GET',
            `/publications?where[platform][equals]=${encodeURIComponent(platform)}&limit=1&sort=-scheduled_at&depth=0`
        );
        const doc = data.docs?.[0];
        if (!doc) return null;
        return {
            id: doc.id,
            topicId: typeof doc.signal === 'string' ? doc.signal : doc.signal?.id,
            platform: doc.platform,
            status: doc.status,
            scheduledAt: doc.scheduled_at ? new Date(doc.scheduled_at) : null,
            publishedAt: doc.published_at ? new Date(doc.published_at) : null,
        };
    }

    async getDuePublications(limit = 50): Promise<any[]> {
        const nowIso = new Date().toISOString();
        const data = await this.request<{ docs: any[] }>(
            'GET',
            `/publications?where[status][equals]=PENDING&where[scheduled_at][less_than_equal]=${encodeURIComponent(nowIso)}&limit=${limit}&depth=1&sort=scheduled_at`
        );
        return (data.docs || []).map((doc) => ({
            id: doc.id,
            topicId: typeof doc.signal === 'string' ? doc.signal : doc.signal?.id,
            platform: doc.platform,
            status: doc.status,
            scheduledAt: doc.scheduled_at ? new Date(doc.scheduled_at) : null,
            publishedAt: doc.published_at ? new Date(doc.published_at) : null,
            // On embarque le topic complet pour la diffusion (depth=1).
            topic: doc.signal && typeof doc.signal !== 'string' ? this.hydrateSignal(doc.signal) : null,
        }));
    }

    async createPublications(rows: any[]): Promise<void> {
        for (const row of rows) {
            const payload: any = {
                signal: row.topicId,
                platform: row.platform,
                status: row.status || 'PENDING',
                scheduled_at: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : new Date().toISOString(),
            };
            if (row.publishedAt) payload.published_at = new Date(row.publishedAt).toISOString();
            try {
                await this.request('POST', '/publications', payload);
            } catch (e: any) {
                console.error('[PayloadClient] createPublication échoué:', e.message);
            }
        }
    }

    async updatePublication(id: string, data: any): Promise<void> {
        const payload: any = { ...data };
        if (payload.scheduledAt) payload.scheduled_at = new Date(payload.scheduledAt).toISOString();
        if (payload.publishedAt) payload.published_at = new Date(payload.publishedAt).toISOString();
        delete payload.scheduledAt;
        delete payload.publishedAt;
        await this.request('PATCH', `/publications/${id}`, payload);
    }

    async countPendingPublications(topicId: string): Promise<number> {
        const data = await this.request<{ totalDocs: number }>(
            'GET',
            `/publications?where[signal][equals]=${encodeURIComponent(topicId)}&where[status][equals]=PENDING&limit=1`
        );
        return data.totalDocs || 0;
    }

    // ============================================================
    // TAXONOMY TEMPLATES
    // ============================================================

    async getTaxonomyTemplates(activeOnly = true): Promise<any[]> {
        const where = activeOnly ? '?where[active][equals]=true' : '';
        const data = await this.request<{ docs: any[] }>(
            'GET',
            `/taxonomy-templates${where}&limit=500&depth=0&sort=sort_order`
        );
        return (data.docs || []).map((doc) => ({
            id: doc.id,
            name: doc.name,
            displayName: doc.display_name,
            description: doc.description || '',
            promptText: doc.format_instructions || '',
            sortOrder: doc.sort_order || 0,
            active: doc.active !== false,
            accentColor: doc.accent_color || '#000000',
            isFactory: doc.is_factory || false,
        }));
    }

    // ============================================================
    // LOGS
    // ============================================================

    async appendLog(level: string, nodeId: string, message: string): Promise<void> {
        try {
            await this.request('POST', '/logs', {
                level,
                node_id: nodeId,
                message,
                timestamp: new Date().toISOString(),
            });
        } catch (e: any) {
            // Les logs ne doivent jamais faire tomber le pipeline.
        }
    }

    async getLatestLog(): Promise<any | null> {
        try {
            const data = await this.request<{ docs: any[] }>(
                'GET',
                '/logs?limit=1&sort=-timestamp&depth=0'
            );
            const doc = data.docs?.[0];
            if (!doc) return null;
            return {
                id: doc.id,
                level: doc.level,
                nodeId: doc.node_id || 'SYSTEM',
                message: doc.message,
                timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
            };
        } catch (e: any) {
            return null;
        }
    }
}

function safeParse(value: any): any {
    if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return value; }
    }
    return value;
}

// Singleton partagé par tous les nœuds.
export const payloadClient = new PayloadClient();
