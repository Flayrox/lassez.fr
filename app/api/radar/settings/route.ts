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
            daemon_rss_schedule_enabled, daemon_rss_schedule_times,
            social_mastodon_enabled, social_bluesky_enabled, social_twitter_enabled, social_discord_enabled,
            discord_test_mode,
            rss_feeds, telegram_channels, rss_bridge_base_url, x_accounts, ai_prompt,
            ai_prompt_relevance, ai_prompt_breaking, ai_prompt_decrypt, ai_prompt_standard,
            ai_prompt_breaking_enabled, ai_prompt_decrypt_enabled, ai_prompt_standard_enabled,
            ai_model_main, source_trust_map,
            dedup_similarity_threshold, dedup_recent_hours,
            video_ingest_enabled, video_prefilter_model, video_prefilter_prompt, video_prefilter_min_chars, video_transcribe_model, video_max_audio_mb,
            image_overlay_enabled, image_overlay_opacity, image_box_scale_169, image_box_scale_1x1,
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
        if (daemon_rss_schedule_enabled !== undefined) updateStmt.run('daemon_rss_schedule_enabled', String(daemon_rss_schedule_enabled));
        if (daemon_rss_schedule_times !== undefined) updateStmt.run('daemon_rss_schedule_times', String(daemon_rss_schedule_times));
        if (social_mastodon_enabled !== undefined) updateStmt.run('social_mastodon_enabled', String(social_mastodon_enabled));
        if (social_bluesky_enabled !== undefined) updateStmt.run('social_bluesky_enabled', String(social_bluesky_enabled));
        if (social_twitter_enabled !== undefined) updateStmt.run('social_twitter_enabled', String(social_twitter_enabled));
        if (social_discord_enabled !== undefined) updateStmt.run('social_discord_enabled', String(social_discord_enabled));
        if (discord_test_mode !== undefined) updateStmt.run('discord_test_mode', String(discord_test_mode));
        
        if (rss_feeds !== undefined) updateStmt.run('rss_feeds', typeof rss_feeds === 'string' ? rss_feeds : JSON.stringify(rss_feeds));
        if (telegram_channels !== undefined) updateStmt.run('telegram_channels', typeof telegram_channels === 'string' ? telegram_channels : JSON.stringify(telegram_channels));
        if (rss_bridge_base_url !== undefined) updateStmt.run('rss_bridge_base_url', String(rss_bridge_base_url));
        if (x_accounts !== undefined) updateStmt.run('x_accounts', typeof x_accounts === 'string' ? x_accounts : JSON.stringify(x_accounts));
        if (ai_prompt !== undefined) updateStmt.run('ai_prompt', String(ai_prompt));
        if (ai_prompt_relevance !== undefined) updateStmt.run('ai_prompt_relevance', String(ai_prompt_relevance));
        if (ai_prompt_breaking !== undefined) updateStmt.run('ai_prompt_breaking', String(ai_prompt_breaking));
        if (ai_prompt_decrypt !== undefined) updateStmt.run('ai_prompt_decrypt', String(ai_prompt_decrypt));
        if (ai_prompt_standard !== undefined) updateStmt.run('ai_prompt_standard', String(ai_prompt_standard));
        if (ai_prompt_breaking_enabled !== undefined) updateStmt.run('ai_prompt_breaking_enabled', String(ai_prompt_breaking_enabled));
        if (ai_prompt_decrypt_enabled !== undefined) updateStmt.run('ai_prompt_decrypt_enabled', String(ai_prompt_decrypt_enabled));
        if (ai_prompt_standard_enabled !== undefined) updateStmt.run('ai_prompt_standard_enabled', String(ai_prompt_standard_enabled));
        if (ai_model_main !== undefined) updateStmt.run('ai_model_main', String(ai_model_main));
        if (source_trust_map !== undefined) updateStmt.run('source_trust_map', String(source_trust_map));
        if (dedup_similarity_threshold !== undefined) updateStmt.run('dedup_similarity_threshold', String(dedup_similarity_threshold));
        if (dedup_recent_hours !== undefined) updateStmt.run('dedup_recent_hours', String(dedup_recent_hours));
        if (video_ingest_enabled !== undefined) updateStmt.run('video_ingest_enabled', String(video_ingest_enabled));
        if (video_prefilter_model !== undefined) updateStmt.run('video_prefilter_model', String(video_prefilter_model));
        if (video_prefilter_prompt !== undefined) updateStmt.run('video_prefilter_prompt', String(video_prefilter_prompt));
        if (video_prefilter_min_chars !== undefined) updateStmt.run('video_prefilter_min_chars', String(video_prefilter_min_chars));
        if (video_transcribe_model !== undefined) updateStmt.run('video_transcribe_model', String(video_transcribe_model));
        if (video_max_audio_mb !== undefined) updateStmt.run('video_max_audio_mb', String(video_max_audio_mb));
        if (image_overlay_enabled !== undefined) updateStmt.run('image_overlay_enabled', String(image_overlay_enabled));
        if (image_overlay_opacity !== undefined) updateStmt.run('image_overlay_opacity', String(image_overlay_opacity));
        if (image_box_scale_169 !== undefined) updateStmt.run('image_box_scale_169', String(image_box_scale_169));
        if (image_box_scale_1x1 !== undefined) updateStmt.run('image_box_scale_1x1', String(image_box_scale_1x1));

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
