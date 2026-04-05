import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export async function GET() {
    try {
        const db = getDb();
        const settingsRows = db.prepare('SELECT key, value FROM radar_settings').all();

        const settings: Record<string, string> = {};
        for (const row of settingsRows) {
            settings[row.key] = row.value;
        }

        db.close();
        return NextResponse.json({ success: true, settings });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { 
            max_articles, min_delay_min, max_delay_min, rss_lookback_hours, scan_interval_hours, 
            auto_pilot_enabled, auto_approve_enabled,
            election_interval_hours,
            daemon_rss_enabled, daemon_elections_enabled,
            social_mastodon_enabled, social_bluesky_enabled, social_twitter_enabled, social_discord_enabled,
            discord_test_mode,
            rss_feeds, telegram_channels, ai_prompt,
            // --- Communication ---
            maintenance_mode, maintenance_message,
            popup_enabled, popup_title, popup_text, popup_link_url, popup_link_label
        } = body;

        const db = getDb();
        const updateStmt = db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)');

        if (max_articles !== undefined) updateStmt.run('max_articles', String(max_articles));
        if (min_delay_min !== undefined) updateStmt.run('min_delay_min', String(min_delay_min));
        if (max_delay_min !== undefined) updateStmt.run('max_delay_min', String(max_delay_min));
        if (rss_lookback_hours !== undefined) updateStmt.run('rss_lookback_hours', String(rss_lookback_hours));
        if (scan_interval_hours !== undefined) updateStmt.run('scan_interval_hours', String(scan_interval_hours));
        if (auto_pilot_enabled !== undefined) updateStmt.run('auto_pilot_enabled', String(auto_pilot_enabled));
        if (auto_approve_enabled !== undefined) updateStmt.run('auto_approve_enabled', String(auto_approve_enabled));
        
        if (election_interval_hours !== undefined) updateStmt.run('election_interval_hours', String(election_interval_hours));
        if (daemon_rss_enabled !== undefined) updateStmt.run('daemon_rss_enabled', String(daemon_rss_enabled));
        if (daemon_elections_enabled !== undefined) updateStmt.run('daemon_elections_enabled', String(daemon_elections_enabled));
        if (social_mastodon_enabled !== undefined) updateStmt.run('social_mastodon_enabled', String(social_mastodon_enabled));
        if (social_bluesky_enabled !== undefined) updateStmt.run('social_bluesky_enabled', String(social_bluesky_enabled));
        if (social_twitter_enabled !== undefined) updateStmt.run('social_twitter_enabled', String(social_twitter_enabled));
        if (social_discord_enabled !== undefined) updateStmt.run('social_discord_enabled', String(social_discord_enabled));
        if (discord_test_mode !== undefined) updateStmt.run('discord_test_mode', String(discord_test_mode));
        
        if (rss_feeds !== undefined) updateStmt.run('rss_feeds', typeof rss_feeds === 'string' ? rss_feeds : JSON.stringify(rss_feeds));
        if (telegram_channels !== undefined) updateStmt.run('telegram_channels', typeof telegram_channels === 'string' ? telegram_channels : JSON.stringify(telegram_channels));
        if (ai_prompt !== undefined) updateStmt.run('ai_prompt', String(ai_prompt));

        // --- Communication ---
        if (maintenance_mode !== undefined) updateStmt.run('maintenance_mode', String(maintenance_mode));
        if (maintenance_message !== undefined) updateStmt.run('maintenance_message', String(maintenance_message));
        if (popup_enabled !== undefined) updateStmt.run('popup_enabled', String(popup_enabled));
        if (popup_title !== undefined) updateStmt.run('popup_title', String(popup_title));
        if (popup_text !== undefined) updateStmt.run('popup_text', String(popup_text));
        if (popup_link_url !== undefined) updateStmt.run('popup_link_url', String(popup_link_url));
        if (popup_link_label !== undefined) updateStmt.run('popup_link_label', String(popup_link_label));

        db.close();
        return NextResponse.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
