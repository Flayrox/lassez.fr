/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — DAEMON AUTONOME
 *  À lancer UNE SEULE FOIS via PM2 sur le serveur Hostinger.
 *  PM2 le redémarre automatiquement en cas de crash.
 *
 *  Deux boucles parallèles :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ BOUCLE 1 : Scanner RSS/IA (toutes les N heures)          │
 *  │   → Scanne les flux RSS + Telegram                       │
 *  │   → Envoie à Gemini pour analyse                         │
 *  │   → Stocke les "flash_content" en PENDING dans SQLite   │
 *  │   → Notifie via Discord                                  │
 *  ├──────────────────────────────────────────────────────────┤
 *  │ BOUCLE 2 : Publisheur anti-bot (toutes les minutes)      │
 *  │   → Cherche les posts APPROVED dans SQLite               │
 *  │   → Si le délai aléatoire est écoulé, publie sur WP      │
 *  │   → Lance publishPost.js pour chaque post dû             │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Tous les paramètres (intervalles, délais) sont lus depuis
 *  la table `radar_settings` dans radar.db — modifiable en
 *  temps réel depuis le Dashboard Web sans redémarrer le daemon.
 * ═══════════════════════════════════════════════════════════════
 */

import { spawn } from 'child_process';
import { createHmac, randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { syncDatabase } from '../lib/radar-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Logging vers SQLite + Console ────────────────────────────
/**
 * Log a message to both console and the radar_logs table.
 * Traces to REQ-DB-LOGS.
 */
function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}`;
    console.log(line);
    
    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));
        db.prepare('INSERT INTO radar_logs (level, message) VALUES (?, ?)').run(level, msg);
        
        // Automated 7-day cleanup (approx. 1 week)
        db.prepare("DELETE FROM radar_logs WHERE created_at < datetime('now', '-7 days')").run();
        db.close();
    } catch (e) {
        // Fallback to console if DB fails
        if (db) try { db.close(); } catch(_) {}
    }
}

// ─── Lecture des settings depuis la DB ───────────────────────────────────────────
function getSettings() {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'), { readonly: true });
        const rows = db.prepare('SELECT key, value FROM radar_settings').all();
        db.close();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        return settings;
    } catch (e) {
        log(`⚠️  Impossible de lire radar_settings: ${e.message}. Valeurs par défaut utilisées.`);
        return {};
    }
}

// ─── Sauvegarde de clés dans la DB settings ─────────────────────────────
function saveSetting(key, value) {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'));
        db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run(key, value);
        db.close();
    } catch (e) {
        log(`⚠️  Impossible de sauvegarder ${key}: ${e.message}`);
    }
}

const CACHE_SYNC_WEBHOOK_URL = process.env.RADAR_CACHE_SYNC_WEBHOOK_URL || '';
const CACHE_SYNC_WEBHOOK_SECRET = process.env.RADAR_CACHE_SYNC_SECRET || '';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCacheSyncPayload(event, extra = {}) {
    return {
        event,
        source: 'radar-daemon',
        sent_at: new Date().toISOString(),
        ...extra
    };
}

async function notifyCacheSync(event, extra = {}) {
    if (!CACHE_SYNC_WEBHOOK_URL || !CACHE_SYNC_WEBHOOK_SECRET) {
        return false;
    }

    const timestamp = Date.now().toString();
    const nonce = randomUUID();
    const requestId = randomUUID();
    const payload = getCacheSyncPayload(event, { ...extra, request_id: requestId });
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', CACHE_SYNC_WEBHOOK_SECRET)
        .update(`${timestamp}.${nonce}.${body}`)
        .digest('hex');

    const headers = {
        'Content-Type': 'application/json',
        'X-Radar-Timestamp': timestamp,
        'X-Radar-Nonce': nonce,
        'X-Radar-Signature': signature,
        'X-Radar-Event': event,
        'X-Radar-Source': 'radar-daemon',
        'X-Radar-Idempotency-Key': requestId
    };

    const attemptDelays = [0, 250, 750];

    for (let attempt = 0; attempt < attemptDelays.length; attempt += 1) {
        if (attemptDelays[attempt] > 0) {
            await sleep(attemptDelays[attempt]);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const res = await fetch(CACHE_SYNC_WEBHOOK_URL, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal
            });

            if (res.ok) {
                log(`🔁 Cache sync webhook envoyé pour ${event} (request_id=${requestId}).`);
                return true;
            }

            const responseText = await res.text().catch(() => '');
            const snippet = responseText ? ` → ${responseText.slice(0, 200)}` : '';

            if (res.status >= 500 && attempt < attemptDelays.length - 1) {
                log(`⚠️  Webhook cache-sync temporairement rejeté (${res.status})${snippet} [attempt ${attempt + 1}/${attemptDelays.length}]`, 'WARN');
                continue;
            }

            log(`⚠️  Webhook cache-sync rejeté (${res.status})${snippet} [request_id=${requestId}]`, 'WARN');
            return false;
        } catch (error) {
            if (attempt < attemptDelays.length - 1) {
                log(`⚠️  Webhook cache-sync en échec (attempt ${attempt + 1}/${attemptDelays.length}): ${error.message}`, 'WARN');
                continue;
            }

            log(`⚠️  Webhook cache-sync en échec: ${error.message}`, 'WARN');
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }
}

// ─── Exécution d'un script Node enfant  ───────────────────────
function runScript(scriptName, args = [], extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        log(`  ▶ Lancement de ${scriptName} ${args.join(' ')}...`);

        const child = spawn('node', [scriptPath, ...args], {
            cwd: __dirname,
            env: { ...process.env, ...extraEnv },
            stdio: 'pipe'
        });

        child.stdout.on('data', data => log(`  [${scriptName}] ${data.toString().trim()}`));
        child.stderr.on('data', data => log(`  [${scriptName}] ERR: ${data.toString().trim()}`));

        child.on('close', code => {
            if (code === 0) {
                log(`  ✅ ${scriptName} terminé avec succès.`);
                resolve();
            } else {
                log(`  ⚠️  ${scriptName} terminé avec code ${code}.`);
                resolve(); // On resolve quand même pour ne pas bloquer le daemon
            }
        });

        child.on('error', err => {
            log(`  ❌ Erreur de spawn pour ${scriptName}: ${err.message}`);
            resolve(); // Idem, on continue
        });

        // Timeout de sécurité : 20 minutes max par script
        setTimeout(() => {
            child.kill();
            log(`  ⏱️  Timeout atteint pour ${scriptName}, processus tué.`);
            resolve();
        }, 20 * 60 * 1000);
    });
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toLocalDateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalHourMinute(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDailySchedule(raw) {
    if (!raw) return [];
    const parts = String(raw)
        .split(/[\n,;|\s]+/)
        .map(x => x.trim())
        .filter(Boolean);

    const unique = new Set();
    for (const token of parts) {
        const m = token.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) continue;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59) continue;
        unique.add(`${pad2(h)}:${pad2(min)}`);
    }
    return Array.from(unique).sort();
}

function getNextScheduledDate(scheduleTimes, now = new Date()) {
    if (!scheduleTimes.length) return null;

    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
        const base = new Date(now);
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + dayOffset);

        for (const hhmm of scheduleTimes) {
            const [h, m] = hhmm.split(':').map(Number);
            const candidate = new Date(base);
            candidate.setHours(h, m, 0, 0);
            if (candidate > now) return candidate;
        }
    }
    return null;
}

function parseTuningRules(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function isInTimeWindow(now, start, end) {
    if (!start || !end) return false;
    const s = start.match(/^(\d{1,2}):(\d{2})$/);
    const e = end.match(/^(\d{1,2}):(\d{2})$/);
    if (!s || !e) return false;

    const startMin = Number(s[1]) * 60 + Number(s[2]);
    const endMin = Number(e[1]) * 60 + Number(e[2]);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (startMin === endMin) return true;
    if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
}

function findDaemonTuning(settings, daemonType) {
    if (settings.daemon_dynamic_tuning_enabled !== 'true') return null;

    const rules = parseTuningRules(settings.daemon_dynamic_tuning_rules || '');
    if (!rules.length) return null;

    const now = new Date();
    const day = now.getDay();

    for (const rule of rules) {
        const daemons = Array.isArray(rule.daemons) ? rule.daemons.map(x => String(x).toLowerCase()) : [];
        const days = Array.isArray(rule.days) ? rule.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : [];

        if (daemons.length && !daemons.includes(String(daemonType).toLowerCase())) continue;
        if (days.length && !days.includes(day)) continue;
        if (!isInTimeWindow(now, rule.start, rule.end)) continue;

        if (rule.overrides && typeof rule.overrides === 'object') {
            return { name: rule.name || 'rule', overrides: rule.overrides };
        }
    }

    return null;
}

function toNum(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function isEnabledFlag(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return String(value) === 'true';
}

function parseJsonObject(raw, fallback = {}) {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

function getElectionAnalysisTargetSlug(settings) {
    const slug = String(settings.election_analysis_target_slug || 'municipales-2026').trim();
    return slug || 'municipales-2026';
}

function getElectionSlugConfig(settings) {
    const targetSlug = getElectionAnalysisTargetSlug(settings);
    const map = parseJsonObject(settings.election_daemon_by_slug_json || '{}', {});
    const raw = map[targetSlug] && typeof map[targetSlug] === 'object' ? map[targetSlug] : {};
    return {
        targetSlug,
        enabled: raw.enabled !== undefined ? isEnabledFlag(raw.enabled, true) : isEnabledFlag(settings.daemon_elections_enabled, false),
        liveModeEnabled: raw.live_mode_enabled !== undefined ? isEnabledFlag(raw.live_mode_enabled, false) : false,
        pollIntervalMinutes: Math.max(2, toNum(raw.poll_interval_minutes, 2)),
        intervalEnabled: raw.interval_enabled !== undefined ? isEnabledFlag(raw.interval_enabled, true) : isEnabledFlag(settings.daemon_elections_interval_enabled, true),
        intervalHours: toNum(raw.interval_hours, toNum(settings.election_interval_hours, 0.5)),
        scheduleEnabled: raw.schedule_enabled !== undefined ? isEnabledFlag(raw.schedule_enabled, false) : isEnabledFlag(settings.daemon_elections_schedule_enabled, false),
        scheduleTimesRaw: String(raw.schedule_times !== undefined ? raw.schedule_times : (settings.daemon_elections_schedule_times || '')),
        syncLocked: raw.sync_locked !== undefined ? isEnabledFlag(raw.sync_locked, false) : false
    };
}

function getDaemonProfiles(settings) {
    const base = {
        rss: {
            max_articles: toNum(settings.max_articles, 3),
            rss_lookback_hours: toNum(settings.rss_lookback_hours, 24),
            min_delay_min: toNum(settings.min_delay_min, 0),
            max_delay_min: toNum(settings.max_delay_min, 15),
            scan_interval_hours: toNum(settings.scan_interval_hours, 2),
            election_interval_hours: toNum(settings.election_interval_hours, 0.5)
        },
        publisher: {
            max_articles: toNum(settings.max_articles, 3),
            rss_lookback_hours: toNum(settings.rss_lookback_hours, 24),
            min_delay_min: toNum(settings.min_delay_min, 0),
            max_delay_min: toNum(settings.max_delay_min, 15),
            scan_interval_hours: toNum(settings.scan_interval_hours, 2),
            election_interval_hours: toNum(settings.election_interval_hours, 0.5)
        },
        elections: {
            max_articles: toNum(settings.max_articles, 3),
            rss_lookback_hours: toNum(settings.rss_lookback_hours, 24),
            min_delay_min: toNum(settings.min_delay_min, 0),
            max_delay_min: toNum(settings.max_delay_min, 15),
            scan_interval_hours: toNum(settings.scan_interval_hours, 2),
            election_interval_hours: toNum(settings.election_interval_hours, 0.5)
        }
    };

    try {
        const parsed = JSON.parse(settings.daemon_profiles_json || '{}');
        if (!parsed || typeof parsed !== 'object') return base;

        for (const key of ['rss', 'publisher', 'elections']) {
            if (!parsed[key] || typeof parsed[key] !== 'object') continue;
            for (const field of ['max_articles', 'rss_lookback_hours', 'min_delay_min', 'max_delay_min', 'scan_interval_hours', 'election_interval_hours']) {
                if (parsed[key][field] === undefined) continue;
                const next = Number(parsed[key][field]);
                if (Number.isFinite(next)) {
                    base[key][field] = next;
                }
            }
        }
    } catch (_) {
        return base;
    }

    return base;
}

function getRssSchedulePlan(settings, now = new Date()) {
    const profiles = getDaemonProfiles(settings);
    const tuning = findDaemonTuning(settings, 'rss');

    const intervalHours = toNum(tuning?.overrides?.scan_interval_hours ?? profiles.rss.scan_interval_hours, 2);
    const intervalEnabled = isEnabledFlag(settings.daemon_rss_interval_enabled, true);

    const scheduleEnabled = isEnabledFlag(settings.daemon_rss_schedule_enabled, false);
    const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times || '');
    const nextScheduled = (scheduleEnabled && scheduleTimes.length > 0)
        ? getNextScheduledDate(scheduleTimes, new Date(now.getTime() + 60 * 1000))
        : null;

    const nextInterval = intervalEnabled
        ? new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
        : null;

    const candidates = [nextInterval, nextScheduled].filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
    const nextAt = candidates.length > 0 ? candidates[0] : null;

    return {
        intervalEnabled,
        intervalHours,
        scheduleEnabled,
        scheduleTimes,
        nextScheduled,
        nextAt
    };
}

function getElectionSchedulePlan(settings, now = new Date()) {
    const profiles = getDaemonProfiles(settings);
    const tuning = findDaemonTuning(settings, 'elections');
    const slugCfg = getElectionSlugConfig(settings);

    const fallbackInterval = toNum(tuning?.overrides?.election_interval_hours ?? profiles.elections.election_interval_hours, 0.5);
    const intervalHours = slugCfg.liveModeEnabled
        ? Math.max(2, toNum(slugCfg.pollIntervalMinutes, 2)) / 60
        : toNum(slugCfg.intervalHours, fallbackInterval);
    const intervalEnabled = slugCfg.intervalEnabled;

    const scheduleEnabled = slugCfg.scheduleEnabled;
    const scheduleTimes = parseDailySchedule(slugCfg.scheduleTimesRaw || '');
    const nextScheduled = (scheduleEnabled && scheduleTimes.length > 0)
        ? getNextScheduledDate(scheduleTimes, new Date(now.getTime() + 60 * 1000))
        : null;

    const nextInterval = intervalEnabled
        ? new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
        : null;

    const candidates = [nextInterval, nextScheduled].filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
    const nextAt = candidates.length > 0 ? candidates[0] : null;

    return {
        targetSlug: slugCfg.targetSlug,
        enabled: slugCfg.enabled,
        liveModeEnabled: slugCfg.liveModeEnabled,
        pollIntervalMinutes: slugCfg.pollIntervalMinutes,
        syncLocked: slugCfg.syncLocked,
        intervalEnabled,
        intervalHours,
        scheduleEnabled,
        scheduleTimes,
        nextScheduled,
        nextAt
    };
}

// ─── BOUCLE 1 : Scan RSS/IA ───────────────────────────────────
let scanRunning = false;
let lastScanDurationMs = 0;

async function runScan() {
    if (scanRunning) {
        log('⏭️  Scan déjà en cours, skip.');
        return;
    }
    scanRunning = true;
    log('════════════════════════════════════════');
    log('🔍 BOUCLE 1 — SCAN RSS/TELEGRAM + IA');
    log('════════════════════════════════════════');
    log('🔍 BOUCLE 1 — SCAN RSS/TELEGRAM + IA');
    log('════════════════════════════════════════');
    const startTime = Date.now();
    saveSetting('last_scan_at', new Date().toISOString());
    try {
        const settings = getSettings();
        const profiles = getDaemonProfiles(settings);
        const tuning = findDaemonTuning(settings, 'rss');
        const env = {};

        const effMaxArticles = tuning?.overrides?.max_articles ?? profiles.rss.max_articles;
        const effLookback = tuning?.overrides?.rss_lookback_hours ?? profiles.rss.rss_lookback_hours;
        env.RADAR_MAX_ARTICLES_OVERRIDE = String(effMaxArticles);
        env.RADAR_RSS_LOOKBACK_HOURS_OVERRIDE = String(effLookback);

        if (Object.keys(env).length > 0) {
            log(`🎛️ Tuning RSS actif (${tuning.name}) → ${JSON.stringify(tuning.overrides)}`);
        }

        await runScript('index.js', [], env);
    } catch (e) {
        log(`❌ Erreur inattendue dans runScan: ${e.message}`);
    } finally {
        scanRunning = false;
        lastScanDurationMs = Date.now() - startTime;
        const settings = getSettings();
        const plan = getRssSchedulePlan(settings);

        if (plan.nextAt) {
            saveSetting('next_scan_at', plan.nextAt.toISOString());
            if (plan.scheduleEnabled && plan.scheduleTimes.length > 0 && plan.intervalEnabled) {
                log(`⏰ Prochain scan RSS à ${plan.nextAt.toLocaleTimeString('fr-FR')} (mode ET/OU: intervalle ${plan.intervalHours}h + heures fixes ${plan.scheduleTimes.join(', ')}).`);
            } else if (plan.scheduleEnabled && plan.scheduleTimes.length > 0) {
                log(`⏰ Prochain scan RSS programmé à ${plan.nextAt.toLocaleTimeString('fr-FR')} (heures fixes: ${plan.scheduleTimes.join(', ')}).`);
            } else if (plan.intervalEnabled) {
                log(`⏰ Prochain scan automatique prévu à ${plan.nextAt.toLocaleTimeString('fr-FR')} (dans ${plan.intervalHours}h).`);
            }
        } else {
            log('⏸️ RSS: aucun déclencheur actif (intervalle/heures fixes désactivés).');
        }
    }
}

function startScanLoop() {
    setInterval(() => {
        if (scanRunning) return;
        const settings = getSettings();
        if (settings.daemon_rss_enabled === 'false') return;

        const now = new Date();
        const plan = getRssSchedulePlan(settings, now);
        if (plan.nextAt) {
            saveSetting('next_scan_at', plan.nextAt.toISOString());
        }

        let shouldRun = false;
        if (plan.scheduleEnabled && plan.scheduleTimes.length > 0) {
            const minuteKey = toLocalHourMinute(now);
            const hitKey = `${toLocalDateKey(now)} ${minuteKey}`;
            const lastHit = settings.daemon_rss_schedule_last_hit || '';
            if (plan.scheduleTimes.includes(minuteKey) && lastHit !== hitKey) {
                saveSetting('daemon_rss_schedule_last_hit', hitKey);
                shouldRun = true;
            }
        }

        if (!shouldRun && plan.intervalEnabled) {
            const nextScanAt = settings.next_scan_at ? new Date(settings.next_scan_at) : new Date(0);
            if (now >= nextScanAt) shouldRun = true;
        }

        if (shouldRun) {
            runScan();
        }
    }, 60 * 1000);

    // Initial check
    setTimeout(() => {
        log('🚀 Daemon RSS prêt. Premier check dans 5 secondes...');
        const settings = getSettings();
        if (settings.daemon_rss_enabled !== 'false') {
            const plan = getRssSchedulePlan(settings);
            if (plan.nextAt) {
                saveSetting('next_scan_at', plan.nextAt.toISOString());
            }
            if (plan.scheduleEnabled && plan.scheduleTimes.length > 0) {
                log(`🗓️  Heures fixes RSS actives: ${plan.scheduleTimes.join(', ')}.`);
            }
            if (plan.intervalEnabled) {
                log(`🕒 Intervalle RSS actif: toutes les ${plan.intervalHours}h.`);
            }
            const nextScanAt = settings.next_scan_at ? new Date(settings.next_scan_at) : new Date(0);
            if (new Date() >= nextScanAt) {
                runScan();
            }
        }
    }, 5000);
}

// ─── BOUCLE 2 : Publisheur anti-bot ───────────────────────────
let publishingIds = new Set(); // Pour éviter les doubles publications

async function runPublisher() {
    const settings = getSettings();
    const profiles = getDaemonProfiles(settings);
    const autoPilotEnabled = settings.auto_pilot_enabled === 'true';
    const tuning = findDaemonTuning(settings, 'publisher');
    const minDelayRaw = tuning?.overrides?.min_delay_min ?? profiles.publisher.min_delay_min;
    const maxDelayRaw = tuning?.overrides?.max_delay_min ?? profiles.publisher.max_delay_min;
    const minDelay = parseInt(String(minDelayRaw || '0'), 10);
    const maxDelay = parseInt(String(maxDelayRaw || '15'), 10);
    const safeMinDelay = Number.isFinite(minDelay) ? minDelay : 0;
    const safeMaxDelay = Number.isFinite(maxDelay) ? Math.max(safeMinDelay, maxDelay) : Math.max(safeMinDelay, 15);

    if (tuning?.overrides) {
        log(`🎛️ Tuning Publisher actif (${tuning.name}) → min=${safeMinDelay}m max=${safeMaxDelay}m`);
    }

    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));

        if (!autoPilotEnabled) {
            // Pilote Auto OFF
            const pending = db.prepare(`SELECT count(*) as c FROM radar_posts WHERE status = 'APPROVED'`).get();
            if (pending.c > 0) {
                // On ne loggue plus toutes les minutes si c'est désactivé pour ne pas polluer
            }
            db.close();
            return;
        }

        log(`🟢 Pilote Auto actif. Vérification des publications programmées...`);

        // Assigner un scheduled_at aux posts APPROVED qui n'en ont pas encore
        const unscheduled = db.prepare(`
            SELECT id FROM radar_posts 
            WHERE status = 'APPROVED' AND scheduled_at IS NULL
        `).all();

        for (const post of unscheduled) {
            if (publishingIds.has(post.id)) continue;
            const delayMin = safeMinDelay + Math.random() * (safeMaxDelay - safeMinDelay);
            const scheduledAt = new Date(Date.now() + delayMin * 60 * 1000);
            db.prepare(`UPDATE radar_posts SET scheduled_at = ? WHERE id = ?`)
                .run(scheduledAt.toISOString(), post.id);
            log(`📅 Post ID ${post.id} planifié dans ${delayMin.toFixed(1)} minutes (à ${scheduledAt.toLocaleTimeString('fr-FR')}).`);
        }

        // Publier les posts dont le scheduled_at est passé
        const dueNow = db.prepare(`
            SELECT id FROM radar_posts 
            WHERE status = 'APPROVED' 
            AND scheduled_at IS NOT NULL 
            AND datetime(scheduled_at) <= datetime('now')
        `).all();

        db.close();
        db = null;

        const publishedPostIds = [];

        for (const post of dueNow) {
            if (publishingIds.has(post.id)) continue;
            publishingIds.add(post.id);
            log(`📤 Publication automatique du post ID ${post.id}...`);
            await runScript('publishPost.js', [String(post.id)]);
            publishedPostIds.push(post.id);
            publishingIds.delete(post.id);
        }

        if (publishedPostIds.length > 0) {
            await notifyCacheSync('post.published', {
                post_ids: publishedPostIds,
                cache_scope: ['radar-config', 'wp-posts', 'wp-categories']
            });
        }

    } catch (e) {
        log(`❌ Erreur dans runPublisher: ${e.message}`, 'ERROR');
    } finally {
        if (db) { try { db.close(); } catch (_) { } }
    }
}

function startPublisherLoop() {
    // Vérifie toutes les minutes s'il y a des posts à publier
    setInterval(() => {
        runPublisher();
    }, 60 * 1000);

    log('📡 Boucle de publication anti-bot démarrée (check toutes les minutes).');
}

// ─── BOUCLE 3 : Sync Élections ───────────
let electionRunning = false;

async function runElectionSync() {
    if (electionRunning) return;
    electionRunning = true;
    log('════════════════════════════════════════');
    log('🗳️  BOUCLE 3 — SYNC ÉLECTIONS');
    log('════════════════════════════════════════');
    try {
        const settings = getSettings();
        const plan = getElectionSchedulePlan(settings);
        if (plan.syncLocked) {
            log(`⏸️ Sync elections verrouillee pour ${plan.targetSlug} (sync_locked=true).`);
            return;
        }
        // Keep analysis target slug decoupled from front display slug.
        await runScript('sync_elections.js', [], { ELECTION_SLUG_OVERRIDE: plan.targetSlug });
    } catch (e) {
        log(`❌ Erreur dans runElectionSync: ${e.message}`, 'ERROR');
    } finally {
        electionRunning = false;
        const settings = getSettings();
        const plan = getElectionSchedulePlan(settings);
        if (plan.nextAt) {
            saveSetting('next_election_scan_at', plan.nextAt.toISOString());
            if (plan.scheduleEnabled && plan.scheduleTimes.length > 0 && plan.intervalEnabled) {
                const intervalLabel = plan.liveModeEnabled ? `${plan.pollIntervalMinutes}min` : `${plan.intervalHours}h`;
                log(`⏰ Prochaine sync Elections (${plan.targetSlug}) à ${plan.nextAt.toLocaleTimeString('fr-FR')} (mode ET/OU: intervalle ${intervalLabel} + heures fixes ${plan.scheduleTimes.join(', ')}).`);
            } else if (plan.scheduleEnabled && plan.scheduleTimes.length > 0) {
                log(`⏰ Prochaine sync Elections (${plan.targetSlug}) programmée à ${plan.nextAt.toLocaleTimeString('fr-FR')} (heures fixes: ${plan.scheduleTimes.join(', ')}).`);
            } else if (plan.intervalEnabled) {
                const intervalLabel = plan.liveModeEnabled ? `${plan.pollIntervalMinutes}min` : `${plan.intervalHours}h`;
                log(`⏰ Prochaine sync d'élections (${plan.targetSlug}) prévue à ${plan.nextAt.toLocaleTimeString('fr-FR')} (dans ${intervalLabel}).`);
            }
        } else {
            log('⏸️ Elections: aucun déclencheur actif (intervalle/heures fixes désactivés).');
        }
    }
}

function startElectionSyncLoop() {
    setInterval(() => {
        if (electionRunning) return;
        const settings = getSettings();
        const plan = getElectionSchedulePlan(settings);
        if (!plan.enabled) return;
        if (plan.syncLocked) return;

        const now = new Date();
        const runPlan = getElectionSchedulePlan(settings, now);
        if (runPlan.nextAt) {
            saveSetting('next_election_scan_at', runPlan.nextAt.toISOString());
        }

        let shouldRun = false;
        if (runPlan.scheduleEnabled && runPlan.scheduleTimes.length > 0) {
            const minuteKey = toLocalHourMinute(now);
            const hitKey = `${toLocalDateKey(now)} ${minuteKey}`;
            const lastHit = settings.daemon_elections_schedule_last_hit || '';
            if (runPlan.scheduleTimes.includes(minuteKey) && lastHit !== hitKey) {
                saveSetting('daemon_elections_schedule_last_hit', hitKey);
                shouldRun = true;
            }
        }

        if (!shouldRun && runPlan.intervalEnabled) {
            const nextScanAt = settings.next_election_scan_at ? new Date(settings.next_election_scan_at) : new Date(0);
            if (now >= nextScanAt) shouldRun = true;
        }

        if (shouldRun) {
            runElectionSync();
        }
    }, 60 * 1000);

    setTimeout(() => {
        log('🗳️  Daemon Élections prêt.');
        const settings = getSettings();
        const enabled = getElectionSchedulePlan(settings).enabled;
        if (enabled) {
            const plan = getElectionSchedulePlan(settings);
            if (plan.nextAt) {
                saveSetting('next_election_scan_at', plan.nextAt.toISOString());
            }
            if (plan.scheduleEnabled && plan.scheduleTimes.length > 0) {
                log(`🗓️  Heures fixes Elections (${plan.targetSlug}) actives: ${plan.scheduleTimes.join(', ')}.`);
            }
            if (plan.intervalEnabled) {
                const intervalLabel = plan.liveModeEnabled ? `${plan.pollIntervalMinutes}min` : `${plan.intervalHours}h`;
                log(`🕒 Intervalle Elections (${plan.targetSlug}) actif: toutes les ${intervalLabel}.`);
            }
            const nextScanAt = settings.next_election_scan_at ? new Date(settings.next_election_scan_at) : new Date(0);
            if (new Date() >= nextScanAt) runElectionSync();
        }
    }, 15000);
}

// ─── BOUCLE 4 : Heartbeat ─────────────────────────────────────
/**
 * Updates the system_health table every 60s.
 * Traces to REQ-HB-MONITOR.
 */
function startHeartbeatLoop() {
    setInterval(() => {
        let db;
        try {
            db = new Database(path.join(__dirname, 'radar.db'));
            
            // Collect advanced stats
            const pending = db.prepare("SELECT count(*) as count FROM radar_posts WHERE status = 'PENDING'").get().count;
            const approved = db.prepare("SELECT count(*) as count FROM radar_posts WHERE status = 'APPROVED'").get().count;
            const errors24h = db.prepare("SELECT count(*) as count FROM radar_logs WHERE level = 'ERROR' AND created_at > datetime('now', '-24 hours')").get().count;
            const lastJob = db.prepare("SELECT type, status, updated_at FROM radar_jobs ORDER BY id DESC LIMIT 1").get();
            
            const details = JSON.stringify({
                pending_posts: pending,
                approved_posts: approved,
                errors_24h: errors24h,
                last_scan_duration_sec: Math.round(lastScanDurationMs / 1000),
                last_job: lastJob || null,
                memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
                uptime_sec: Math.round(process.uptime())
            });

            db.prepare(`
                INSERT INTO system_health (id, last_heartbeat, status, details) 
                VALUES (1, CURRENT_TIMESTAMP, 'ALIVE', ?) 
                ON CONFLICT(id) DO UPDATE SET 
                    last_heartbeat=CURRENT_TIMESTAMP, 
                    status='ALIVE',
                    details=EXCLUDED.details
            `).run(details);
            
            db.close();
        } catch (e) {
            if (db) try { db.close(); } catch(_) {}
        }
    }, 60 * 1000);
    log('💓 Boucle de Heartbeat démarrée (check toutes les minutes).');
}

// ─── BOUCLE 5 : Job Processor ─────────────────────────────────
/**
 * Polls radar_jobs every 10s for manual triggers from UI.
 * Traces to REQ-JOB-SYNC.
 */
let jobRunning = false;
async function processJobs() {
    if (jobRunning) return;
    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));
        const job = db.prepare("SELECT * FROM radar_jobs WHERE status = 'PENDING' LIMIT 1").get();
        
        if (job) {
            jobRunning = true;
            log(`🛠️ Traitement du job ID ${job.id} (Type: ${job.type})...`);
            db.prepare("UPDATE radar_jobs SET status = 'RUNNING' WHERE id = ?").run(job.id);
            db.close();
            db = null;

            try {
                if (job.type === 'MANUAL_SCAN') {
                    await runScan();
                } else if (job.type === 'ELECTION_SYNC') {
                    await runElectionSync();
                }
                
                db = new Database(path.join(__dirname, 'radar.db'));
                db.prepare("UPDATE radar_jobs SET status = 'COMPLETED', result = ? WHERE id = ?").run('Success', job.id);
            } catch (err) {
                log(`❌ Échec du job ID ${job.id}: ${err.message}`, 'ERROR');
                if (!db) db = new Database(path.join(__dirname, 'radar.db'));
                db.prepare("UPDATE radar_jobs SET status = 'FAILED', result = ? WHERE id = ?").run(err.message, job.id);
            }
        }
    } catch (e) {
        log(`⚠️ Erreur Job Processor: ${e.message}`, 'ERROR');
    } finally {
        jobRunning = false;
        if (db) try { db.close(); } catch(_) {}
    }
}

function startJobLoop() {
    setInterval(() => processJobs(), 10 * 1000);
    log('⚙️ Boucle de gestion des Jobs démarrée (check toutes les 10s).');
}

// ─── INIT DB : S'assure que les tables/settings existent ──────
function ensureDb() {
    const db = new Database(path.join(__dirname, 'radar.db'));

    // Synchronisation via le schéma SSOT
    syncDatabase(db);

    // Valeurs par défaut si elles n'existent pas encore
    const defaults = {
        max_articles: '3',
        min_delay_min: '0',
        max_delay_min: '15',
        rss_lookback_hours: '24',
        scan_interval_hours: '2',
        discord_test_mode: 'false',
        daemon_rss_enabled: 'true',
        daemon_rss_interval_enabled: 'true',
        daemon_rss_schedule_enabled: 'false',
        daemon_rss_schedule_times: '',
        daemon_elections_interval_enabled: 'true',
        daemon_elections_schedule_enabled: 'false',
        daemon_elections_schedule_times: '',
        election_analysis_target_slug: 'municipales-2026',
        election_front_display_slugs_json: '["municipales-2026"]',
        election_sources_json: '{"municipales-2026":{"source_type":"dataset-api","parser_strategy":"municipales-communes-v1","dataset_first_tour":"elections-municipales-2026-resultats-du-premier-tour","dataset_second_tour":"elections-municipales-2026-resultats-du-second-tour","candidate_first_tour":"elections-municipales-2026-listes-candidates-au-premier-tour","candidate_second_tour":"elections-municipales-2026-listes-candidates-au-second-tour","enabled":true}}',
        election_daemon_by_slug_json: '{"municipales-2026":{"enabled":false,"live_mode_enabled":false,"poll_interval_minutes":2,"interval_enabled":true,"interval_hours":0.5,"schedule_enabled":false,"schedule_times":"","sync_locked":false}}',
        election_last_used_source_json: '{}',
        daemon_dynamic_tuning_enabled: 'false',
        daemon_dynamic_tuning_rules: '',
        daemon_profiles_json: '',
        auto_pilot_enabled: 'true',
        ai_model_main: 'gemini-2.5-pro-preview-05-06',
        ai_model_breaking: 'gemini-3.1-pro-preview',
        ai_model_standard: 'gemini-2.5-flash',
        ai_model_decrypt: 'gemini-2.5-pro',
        google_search_breaking_enabled: 'true',
        google_search_standard_enabled: 'true',
        google_search_decrypt_enabled: 'true',
        source_trust_map: '{"mediapart":"🟢","france24":"🟡","lefigaro":"🔴"}',
        dedup_similarity_threshold: '0.65',
        dedup_recent_hours: '24',
        video_ingest_enabled: 'true',
        video_prefilter_model: 'gemini-2.0-flash',
        video_prefilter_prompt: 'Ce message Telegram parle-t-il de politique, de mouvements sociaux, de justice ou d un evenement d interet public ? Reponds uniquement par OUI ou NON.',
        video_prefilter_min_chars: '20',
        video_transcribe_model: 'gemini-2.0-flash',
        video_max_audio_mb: '20',
        pipeline_graph_json: '{}'
    };

    const insertDefault = db.prepare(`INSERT OR IGNORE INTO radar_settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of Object.entries(defaults)) {
        insertDefault.run(key, value);
    }

    db.close();
    log('✅ Base de données vérifiée et prête via syncDatabase.');
}

// ─── ENTRÉE PRINCIPALE ─────────────────────────────────────────
log('');
log('██████████████████████████████████████████████');
log('█  RADAR L\'ASSEZ — DAEMON v2.0               █');
log('█  Démarrage du service autonome harmonisé... █');
log('██████████████████████████████████████████████');
log('');

try {
    ensureDb();
} catch (e) {
    log(`❌ FATAL — Erreur d'initialisation de la DB: ${e.message}`, 'ERROR');
    process.exit(1);
}

// BOUCLE 1 DEPLACEE DANS daemon_rss.js
startPublisherLoop();
startElectionSyncLoop();
startHeartbeatLoop();
startJobLoop();

// ─── SERVEUR DUMMY POUR HOSTINGER ─────────────────────────────
const dummyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DAEMON IS ALIVE\n');
});
const port = process.env.PORT || 3005; // Utilisation du port 3005 pour éviter conflit avec Payload (3001)
dummyServer.listen(port, () => {
    log(`🌐 Serveur "Dummy" Hostinger démarré sur le port ${port} pour maintenir le Daemon en vie.`);
});

// ─── Gestion propre de l'arrêt ────────────────────────────────
process.on('SIGTERM', () => {
    log('🛑 SIGTERM reçu. Arrêt propre du daemon.');
    dummyServer.close();
    process.exit(0);
});
process.on('SIGINT', () => {
    log('🛑 SIGINT reçu. Arrêt propre du daemon.');
    dummyServer.close();
    process.exit(0);
});
process.on('uncaughtException', (err) => {
    log(`❌ Exception non gérée: ${err.message}\n${err.stack}`);
});
process.on('unhandledRejection', (reason) => {
    log(`⚠️  Promise rejetée non gérée: ${reason}`);
});
