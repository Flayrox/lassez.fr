const fs = require('fs');

let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf8');

// 1. Add states for payload tracking at the top of the component
const stateDeclMarker = "export default function DaemonPage() {";
const stateBlock = `export default function DaemonPage() {
    const [initialPayloadStr, setInitialPayloadStr] = useState<string | null>(null);`;
c = c.replace(stateDeclMarker, stateBlock);

// 2. Define currentPayloadStr inside the component before useEffect
const useEffectMarker = "useEffect(() => {\n        if (!settings) return;";
const payloadBlock = `
    const currentPayloadStr = useMemo(() => {
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
    }, [settings, currentPayloadStr]); // Recalculate if settings change and we re-render

    ${useEffectMarker}`;
c = c.replace(useEffectMarker, payloadBlock);

// 3. Make handleSave update the initialPayload to the newly saved payload
const handleSaveEnd = "alert('Configuration daemon sauvegardee.');";
c = c.replace(handleSaveEnd, `setInitialPayloadStr(currentPayloadStr);
            ${handleSaveEnd}`);

// 4. Inject the floating button BEFORE the closing </DashboardLayout> tag
const closeLayoutMarker = "</DashboardLayout>";
const floatingUI = `
            {/* FLOATING SAVE BUTTON */}
            <div 
                className={\`fixed bottom-8 right-8 z-[100] transition-all duration-500 ease-in-out \${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}\`}
            >
                <div className="relative group">
                    <div className="absolute -inset-1 bg-red-700 blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="relative flex items-center gap-3 bg-red-700 text-white px-6 py-4 border-4 border-stone-900 font-black uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(26,28,28,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(26,28,28,1)] transition-all animate-pulse"
                    >
                        <span className="text-xl">⚠️</span>
                        <div>
                            <div>{saving ? 'SAUVEGARDE...' : 'CHANGEMENTS NON SAUVÉGARDÉS'}</div>
                            <div className="text-[10px] text-red-200 font-bold">Cliquez pour appliquer la configuration</div>
                        </div>
                    </button>
                </div>
            </div>

        ${closeLayoutMarker}`;
c = c.replace(closeLayoutMarker, floatingUI);

fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
console.log('Floating save inserted!');
