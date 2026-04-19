const fs = require('fs');

let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf8');

c = c.replace(/useEffect\(\(\) => \{\s*if \(\!settings\) return;/m, 
`    const currentPayloadStr = useMemo(() => {
        return JSON.stringify({
            ...cortexVars,
            daemon_rss_enabled: daemonRssEnabled ? 'true' : 'false',
            auto_pilot_enabled: autoPilotEnabled ? 'true' : 'false',
            auto_approve_enabled: autoApproveEnabled ? 'true' : 'false',
            discord_test_mode: discordTestMode ? 'true' : 'false',
            daemon_rss_interval_enabled: rssIntervalEnabled ? 'true' : 'false',
            scan_interval_hours: daemonProfiles.rss.scan_interval_hours,
            max_articles: daemonProfiles.rss.max_articles,
            rss_lookback_hours: daemonProfiles.rss.rss_lookback_hours,
            min_delay_min: daemonProfiles.publisher.min_delay_min,
            max_delay_min: daemonProfiles.publisher.max_delay_min,
            daemon_rss_schedule_enabled: scheduleEnabled ? 'true' : 'false',
            daemon_rss_schedule_times: scheduleTimes.join(', '),
            daemon_dynamic_tuning_enabled: tuningEnabled ? 'true' : 'false',
            daemon_dynamic_tuning_rules: toRulesJson(rules),
            social_targets_by_type_json: JSON.stringify(socialTargetsByType),
            daemon_profiles_json: JSON.stringify(daemonProfiles)
        });
    }, [
        cortexVars, daemonRssEnabled, autoPilotEnabled, autoApproveEnabled, discordTestMode,
        rssIntervalEnabled, daemonProfiles, scheduleEnabled, scheduleTimes,
        tuningEnabled, rules, socialTargetsByType
    ]);

    const isDirty = initialPayloadStr !== null && currentPayloadStr !== initialPayloadStr;

    useEffect(() => {
        if (!settings) return;
        const timer = setTimeout(() => {
            setInitialPayloadStr(currentPayloadStr);
        }, 100);
        return () => clearTimeout(timer);
    }, [settings, currentPayloadStr]);

    useEffect(() => {
        if (!settings) return;`);

fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
console.log('Fixed missing isDirty tracking logic!');
