package config

import (
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v3"
)

// LoadYAMLSettings lit config/config.yaml et l'aplatit en map avec les
// CLÉS HISTORIQUES que les nœuds Go lisent déjà (aiModelFlash,
// similarityThreshold, minPublishDelay…). Secrets injectés depuis l'env.
func LoadYAMLSettings(path string) (map[string]any, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return map[string]any{}, err
	}
	var doc map[string]any
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return map[string]any{}, err
	}
	out := flatten(doc)
	// Secrets locaux (daemon/config/.secrets.yaml, gitignoré) — écrits par le
	// labo via /api/secrets. Ils écrasent l'env si présents dans le fichier.
	if sec := LoadSecrets(filepath.Join(filepath.Dir(path), ".secrets.yaml")); sec != nil {
		for k, v := range sec {
			out[k] = v
		}
	}

	// Mode qoe.fi : mock tant qu'aucune clé n'est configurée (QOE_MOCK force).
	// Calculé APRÈS le merge des secrets pour voir une clé collée par le labo.
	qoeMock := os.Getenv("QOE_MOCK")
	qoeKey, _ := out["qoeApiKey"].(string)
	if qoeMock == "true" {
		out["qoeMockEnabled"] = true
	} else if qoeMock == "false" {
		out["qoeMockEnabled"] = false
	} else {
		out["qoeMockEnabled"] = qoeKey == ""
	}
	return out, nil
}

// flatten — aplatit le YAML en clés historiques + clés préfixées.
func flatten(d map[string]any) map[string]any {
	out := map[string]any{}

	get := func(path ...string) any {
		cur := any(d)
		for _, p := range path {
			m, ok := cur.(map[string]any)
			if !ok {
				return nil
			}
			cur = m[p]
		}
		return cur
	}
	set := func(k string, v any) {
		if v != nil {
			out[k] = v
		}
	}
	f := func(path ...string) float64 {
		switch v := get(path...).(type) {
		case int:
			return float64(v)
		case float64:
			return v
		}
		return 0
	}
	s := func(path ...string) string {
		v, _ := get(path...).(string)
		return v
	}

	// Ingestion
	set("rss_lookback_hours", f("ingestion", "timeWindowHours"))
	set("rssLookbackHours", f("ingestion", "rssLookbackHours"))
	set("maxArticles", f("ingestion", "maxArticlesPerScan"))
	set("ingestion.concurrency", f("ingestion", "concurrency"))
	// URL de base du RSS-Bridge (comptes X → flux Atom TwitterBridge)
	set("rssBridgeUrl", s("ingestion", "rssBridgeUrl"))
	// Bloc brut préservé : GetActiveSources() lit les listes d'URLs dedans
	if ing := get("ingestion"); ing != nil {
		out["ingestion"] = ing
	}

	// Dedup
	set("similarityThreshold", f("dedup", "similarityThreshold"))
	set("dedupLookbackHours", f("dedup", "lookbackHours"))
	set("dedup.recentHours", f("dedup", "lookbackHours"))

	// Research
	set("research.aiModelFlash", s("research", "aiModelFlash"))
	set("research.maxConcurrentTasks", f("research", "maxConcurrentTasks"))
	set("research.customModifier", s("research", "customPromptModifier"))
	set("aiModelFlash", orString(s("research", "aiModelFlash"), "gemini-3-flash-preview"))
	set("aiModelDecrypt", s("research", "aiModelDecrypt"))
	set("researcherSystemPrompt", s("research", "systemPrompt"))
	set("researcherRejectCriteria", s("research", "rejectCriteria"))
	set("webSearchEnabled", get("research", "webSearchEnabled"))
	// Recherche web PAR TYPE (google_search_breaking/standard/decrypt_enabled)
	set("googleSearchBreakingEnabled", get("research", "googleSearchBreaking"))
	set("googleSearchStandardEnabled", get("research", "googleSearchStandard"))
	set("googleSearchDecryptEnabled", get("research", "googleSearchDecrypt"))
	set("scoreThreshold", f("research", "scoreThreshold"))

	// Editorial (+ validator)
	set("editor.aiModelPro", s("editorial", "aiModelPro"))
	set("editor.maxConcurrentTasks", f("editorial", "maxConcurrentTasks"))
	set("validator.aiModelValidator", s("editorial", "aiModelVerification"))
	set("validator.maxConcurrentTasks", float64(5))
	set("aiModelPro", orString(s("editorial", "aiModelPro"), "gemini-2.5-pro"))
	set("baseIdentityPrompt", s("editorial", "baseIdentity"))
	set("researchMissionPrompt", s("editorial", "researchMission"))
	set("vocabularyRulesPrompt", s("editorial", "vocabularyRules"))
	set("imageRulesPrompt", s("editorial", "imageRules"))
	set("customPromptModifier", s("editorial", "customModifier"))
	set("aiPrompt", s("editorial", "aiPrompt"))
	// Modèles par format (modelByFormat : id du format → modèle) — l'éditorialiste
	// choisit le modèle selon la taxonomie du sujet. Legacy modelByType conservé
	// (ai_model_main/breaking/standard/decrypt) pour les vieilles configs.
	if mbf, ok := get("editorial", "modelByFormat").(map[string]any); ok {
		set("modelByFormat", mbf)
	}
	if mbt, ok := get("editorial", "modelByType").(map[string]any); ok {
		set("aiModelBreaking", sMap(mbt, "alerte"))
		set("aiModelStandard", sMap(mbt, "standard"))
		set("aiModelDecrypt", sMap(mbt, "decrypt"))
	}
	if reg, ok := get("modelRegistry").([]any); ok {
		set("modelRegistry", reg)
	}
	if meta, ok := get("sourcesMeta").([]any); ok {
		set("sourcesMeta", meta)
	}

	// Publisher
	set("enableDiscord", get("publisher", "enableDiscord"))
	set("enableQoe", get("publisher", "enableQoe"))
	set("enableX", get("publisher", "enableX"))
	set("enableBluesky", get("publisher", "enableBluesky"))
	set("enableMastodon", get("publisher", "enableMastodon"))
	set("discordTestMode", get("publisher", "discordTestMode"))
	set("discordPublishMode", s("publisher", "discordPublishMode"))
	set("qoePublishMode", s("publisher", "qoePublishMode"))
	set("xPublishMode", s("publisher", "xPublishMode"))
	set("blueskyPublishMode", s("publisher", "blueskyPublishMode"))
	set("mastodonPublishMode", s("publisher", "mastodonPublishMode"))
	set("minPublishDelay", f("publisher", "minDelayMinutes"))
	set("maxPublishDelay", f("publisher", "maxDelayMinutes"))
	set("enableAutoPublish", get("publisher", "enableAutoPublish"))
	set("enableAutoApprove", get("publisher", "enableAutoApprove"))           // Mode Fantôme
	set("enableAutoApproveMedia", get("publisher", "enableAutoApproveMedia")) // média conservé en mode fantôme
	set("targetsByType", get("publisher", "targetsByType"))
	// qoe.fi (clé + publication dans .secrets.yaml, base URL dans le YAML)
	set("qoeApiKey", s("publisher", "qoeApiKey"))
	set("qoePublicationId", s("publisher", "qoePublicationId"))
	set("qoeBaseUrl", s("publisher", "qoeBaseUrl"))

	// Scheduling (format daemon : "LUN 20:08\nMAR 20:08")
	mode := s("scheduling", "mode")
	set("schedulingMode", mode)
	set("scrapingInterval", f("scheduling", "scrapingIntervalMinutes"))
	if slotsRaw, ok := get("scheduling", "weeklySlots").([]any); ok && len(slotsRaw) > 0 {
		lines := ""
		for _, sl := range slotsRaw {
			if m, ok := sl.(map[string]any); ok {
				day, _ := m["day"].(string)
				tm, _ := m["time"].(string)
				lines += day + " " + tm + "\n"
			}
		}
		set("daemonSchedule", lines)
	} else {
		set("daemonSchedule", "")
	}

	// Pipeline graph (nœuds actifs — le graphe visuel du labo)
	set("pipelineGraphJson", s("pipeline", "graphJson"))

	// Filtres (keywords / banned — le labo les persiste dans le YAML)
	if filters, ok := get("filters").(map[string]any); ok {
		if kws, ok := filters["keywords"].([]any); ok {
			set("keywords", kws)
		}
		if bws, ok := filters["bannedKeywords"].([]any); ok {
			set("bannedKeywords", bws)
		}
		set("allowSourceImages", filters["allowSourceImages"])
	}

	// Media
	set("imageOverlayEnabled", get("media", "overlayEnabled"))
	set("imageOverlayOpacity", f("media", "overlayOpacity"))
	set("imageBoxScale169", f("media", "boxScale169"))
	set("imageBoxScale11", f("media", "boxScale11"))

	// Video
	set("videoIngestEnabled", get("video", "ingestEnabled"))
	set("videoPrefilterModel", s("video", "prefilterModel"))
	set("videoTranscribeModel", s("video", "transcribeModel"))
	set("videoPrefilterPrompt", s("video", "prefilterPrompt"))
	set("videoPrefilterMinChars", f("video", "prefilterMinChars"))
	set("videoMaxAudioMb", f("video", "maxAudioMb"))

	// Formats (taxonomy templates pour l'éditorialiste)
	if formats, ok := get("formats").([]any); ok {
		set("formats", formats)
	}

	// Système
	set("logLevel", s("system", "logLevel"))
	set("logRetentionDays", f("system", "logRetentionDays"))
	set("logMirrorEnabled", get("system", "logMirrorEnabled"))
	set("maintenanceMode", get("system", "maintenanceMode"))
	set("maintenanceMessage", s("system", "maintenanceMessage"))

	// QoE — le mode mock est recalculé dans LoadYAMLSettings APRÈS le merge
	// des secrets (une clé collée par le labo désactive le mock).

	// Secrets depuis l'env — jamais dans le YAML versionné.
	EnvOverride(out, map[string]string{
		"GEMINI_API_KEY":      "geminiApiKey",
		"DISCORD_WEBHOOK_URL": "discordWebhookUrl",
	})

	return out
}

// sMap lit une valeur string dans une map.
func sMap(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// LoadSecrets lit le fichier de secrets local (structure {publisher: {...}})
// et l'aplatit en clés historiques (discordWebhookUrl, xApiKey…).
func LoadSecrets(path string) map[string]any {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil // pas de fichier secrets → rien
	}
	var doc struct {
		Publisher map[string]any `yaml:"publisher"`
	}
	if err := yaml.Unmarshal(raw, &doc); err != nil || doc.Publisher == nil {
		return nil
	}
	out := map[string]any{}
	for k, v := range doc.Publisher {
		if s, ok := v.(string); ok && s != "" {
			out[k] = s
		}
	}
	return out
}

func orString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

var _ = strconv.Itoa // keep import if future use
