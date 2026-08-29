package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

// RunOrchestrator — le chef de desk : 1 SEUL appel Gemini par cycle qui lit
// tous les sujets ingérés et décide pour chacun quoi traiter (format + zone +
// angle) ou quoi écarter, au lieu d'un appel IA par sujet comme le Tri.
//
// Quand le nœud est activé (config.yaml + studio), il remplace le Tri : les
// sujets aiguillés passent directement RESEARCHED (avec format + zone), les
// autres sont rejetés. Le Tri reste un repli automatique : si l'orchestration
// échoue (quota, clé, JSON invalide), les sujets restent INGESTED et le Tri
// les reprend tel quel au même cycle.
func RunOrchestrator(client *store.Client, resolver *config.Resolver, cycleID int64) error {
	log.Printf("\n[Node 3: Orchestrateur] 🧭 Chef de desk — planification du cycle (1 appel IA)...")

	topics, err := client.GetSignalsByStatus("INGESTED")
	if err != nil {
		return err
	}
	if limit := maxItemsPerCycle(resolver, "orchestrator", 50); len(topics) > limit {
		topics = topics[:limit]
	}
	if len(topics) == 0 {
		log.Printf("[Node 3: Orchestrateur] ℹ️ Aucun sujet (statut: INGESTED) à aiguiller.")
		return nil
	}
	log.Printf("[Node 3: Orchestrateur] 🧭 %d sujets à aiguiller.", len(topics))

	apiKey := GeminiAPIKey(resolver, "orchestrator")
	if apiKey == "" {
		log.Printf("[Node 3: Orchestrateur] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

	modelName := "gemini-3.7-flash"
	if v := resolver.GetEffectiveParam("orchestrator", "aiModel", modelName); v != nil {
		if s, ok := v.(string); ok && s != "" {
			modelName = s
		}
	}
	// Thinking MOYEN : il planifie et aiguille, la rédaction rédige (très élevé).
	thinking := int32(2048)
	if v := resolver.GetEffectiveParam("orchestrator", "thinkingBudget", float64(thinking)); v != nil {
		if n := int32(toFloat64(v, float64(thinking))); n > 0 {
			thinking = n
		}
	}

	researcherSystem := fallbackResearcherSystem
	rejectCriteria := fallbackRejectCriteria
	taxonomyList := ""
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if s, ok := settings["researcherSystemPrompt"].(string); ok && s != "" {
			researcherSystem = s
		}
		if s, ok := settings["researcherRejectCriteria"].(string); ok && s != "" {
			rejectCriteria = s
		}
	}
	// Les formats actifs (id + description) : l'IA doit choisir sa taxonomie
	// parmi les vraies catégories configurées, pas n'importe quelle chaîne.
	if templates, err := client.GetTaxonomyTemplates(true); err == nil {
		var parts []string
		for _, t := range templates {
			line := t.Name
			if t.Description != "" {
				line += " : " + t.Description
			}
			parts = append(parts, "- "+line)
		}
		if len(parts) > 0 {
			taxonomyList = "\n\nCATÉGORIES DISPONIBLES (choisis EXACTEMENT un de ces ids pour taxonomy) :\n" + strings.Join(parts, "\n") + "\n"
		}
	}

	// Mémoire éditoriale (Palier 1) : ce qu'on a publié les N derniers jours —
	// l'IA repère les contradictions, les redites et les suites à donner.
	var memory []store.MemoryEntry
	if memEnabled(resolver) {
		memory, err = client.GetMemory(memWindowDays(resolver))
		if err != nil {
			log.Printf("[Node 3: Orchestrateur] ⚠️ Mémoire illisible : %v", err)
		}
	}

	prompt := buildOrchestratorPrompt(researcherSystem, rejectCriteria, taxonomyList, topics, memory)
	// Observabilité : le prompt complet est journalisé pour vérifier ce que
	// l'IA reçoit réellement (aucune boîte noire).
	log.Printf("[Node 3: Orchestrateur] 📋 Prompt du cycle :\n%s", prompt)

	callCtx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
	defer cancel()
	newGeminiRateLimiter(12).Wait()
	text, err := callGemini(callCtx, geminiParams{
		apiKey:         apiKey,
		model:          modelName,
		system:         "",
		user:           prompt,
		temperature:    orchestratorTemp,
		topP:           orchestratorTopP,
		maxTokens:      orchestratorTokens,
		thinkingBudget: thinking,
		search:         false, // pas de recherche web par sujet : 1 appel, 0 recherche
		responseSchema: schemaOrchestrator(),
		vertex:         VertexAIConfig(resolver),
	})
	if err != nil {
		if isQuotaError(err) {
			log.Printf("[Node 3: Orchestrateur] ⏸️ Quota Gemini atteint : sujets laissés en attente (repris au prochain cycle).")
		} else {
			log.Printf("[Node 3: Orchestrateur] ❌ Erreur d'orchestration : %v", err)
		}
		// Les sujets restent INGESTED — le Tri les reprend si le nœud est actif.
		return nil
	}

	var out struct {
		Decisions []struct {
			ID       string `json:"id"`
			Decision string `json:"decision"`
			Taxonomy string `json:"taxonomy"`
			Geo      string `json:"geo"`
			Angle    string `json:"angle"`
			Reason   string `json:"reason"`
		} `json:"decisions"`
	}
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		log.Printf("[Node 3: Orchestrateur] ❌ JSON invalide : %v", err)
		return nil
	}

	byID := map[string]store.Signal{}
	for _, t := range topics {
		byID[string(t.ID)] = t
	}

	kept, dropped := 0, 0
	for _, d := range out.Decisions {
		topic, ok := byID[d.ID]
		if !ok {
			continue // décision sur un id inconnu : on ignore
		}
		record := store.OrchestrationDecision{
			CycleID:  cycleID,
			SignalID: topic.ID.Number(),
			Decision: "drop",
			Taxonomy: d.Taxonomy,
			Geo:      d.Geo,
			Angle:    d.Angle,
			Reason:   d.Reason,
		}
		if strings.EqualFold(d.Decision, "keep") {
			taxonomy := strings.TrimSpace(d.Taxonomy)
			if taxonomy == "" {
				taxonomy = "INFO"
			}
			geo := strings.ToLower(strings.TrimSpace(d.Geo))
			if geo != "france" && geo != "international" {
				geo = "france"
			}
			if err := client.UpdateSignal(topic.ID, map[string]any{
				"status":   "RESEARCHED",
				"taxonomy": taxonomy,
				"geo":      geo,
			}); err != nil {
				log.Printf("[Node 3: Orchestrateur] ❌ Update %s: %v", topic.ID, err)
				continue
			}
			record.Decision = "keep"
			record.Taxonomy = taxonomy
			record.Geo = geo
			kept++
			log.Printf("[Node 3: Orchestrateur] ✅ Aiguillé %s → %s (%s) : %s", topic.ID, taxonomy, geo, d.Angle)
		} else {
			if err := client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED"}); err != nil {
				log.Printf("[Node 3: Orchestrateur] ❌ Update %s: %v", topic.ID, err)
				continue
			}
			dropped++
			log.Printf("[Node 3: Orchestrateur] ❌ Écarté (%s) : %s", d.Reason, topic.ID)
		}
		// Agenda du jour : chaque décision est enregistrée et visible dans le studio.
		if err := client.RecordOrchestration(record); err != nil {
			log.Printf("[Node 3: Orchestrateur] ⚠️ Agenda %s : %v", topic.ID, err)
		}
	}
	log.Printf("[Node 3: Orchestrateur] 🧭 Cycle planifié : %d à traiter, %d écartés.", kept, dropped)
	return nil
}

// buildOrchestratorPrompt — un seul prompt listant tous les sujets du cycle +
// la mémoire éditoriale : l'IA rend UNE décision par sujet (keep/drop +
// format + zone + angle) en tenant compte de ce qu'on a déjà publié.
func buildOrchestratorPrompt(system, reject, taxonomyList string, topics []store.Signal, memory []store.MemoryEntry) string {
	var sb strings.Builder
	sb.WriteString(system)
	sb.WriteString("\n\nCRITÈRES DE REJET :\n")
	sb.WriteString(reject)
	sb.WriteString(taxonomyList)
	sb.WriteString("\n\nTU ES LE CHEF DE DESK : lis la liste COMPLÈTE des sujets du jour ci-dessous et décide pour CHACUN : à traiter (keep) ou à écarter (drop). Pour chaque sujet gardé, choisis le format le plus percutant (taxonomy), la zone (geo) et donne l'angle à prendre (angle, une phrase). Choisis avec soin : on ne rédige QUE ce qui mérite vraiment d'être publié.")
	// Mémoire éditoriale : les titres publiés récents pour repérer les
	// contradictions, les redites et les suites (le cas Retailleau).
	if len(memory) > 0 {
		sb.WriteString("\n\nMÉMOIRE ÉDITORIALE (ce que tu as déjà publié les derniers jours — si un sujet du jour contredit ou prolonge une de ces publications, sors-le en priorité avec l'angle de la contradiction/suite) :\n")
		for _, m := range memory {
			sb.WriteString(fmt.Sprintf("- %s [%s] (publié %s)\n", orTitle(m.Headline), orTitle(m.Taxonomy), dateOnly(m.PublishedAt)))
		}
	}
	sb.WriteString("\n\n")
	for i, t := range topics {
		var raw struct {
			ClusterTitle string            `json:"clusterTitle"`
			Articles     []IngestedArticle `json:"articles"`
		}
		_ = json.Unmarshal(t.RawData, &raw)
		sb.WriteString(fmt.Sprintf("[Sujet %d] id=%s\n", i+1, t.ID))
		sb.WriteString(fmt.Sprintf("Titre : %s\n", orTitle(raw.ClusterTitle)))
		if len(raw.Articles) > 0 {
			a := raw.Articles[0]
			sb.WriteString(fmt.Sprintf("Source : %s (biais %s, confiance %d/10)\n", orSource(a.SourceName), orBias(a.SourceBias), a.TrustScore))
			snip := strings.TrimSpace(a.Content)
			if len(snip) > 250 {
				snip = snip[:250] + "…"
			}
			if snip != "" {
				sb.WriteString("Extrait : " + snip + "\n")
			}
		}
		sb.WriteString("\n")
	}
	sb.WriteString("RENDS TA RÉPONSE en JSON : { \"decisions\": [ { \"id\": \"<id du sujet>\", \"decision\": \"keep|drop\", \"taxonomy\": \"<id de catégorie>\", \"geo\": \"france|international\", \"angle\": \"<phrase>\", \"reason\": \"<justification>\" } ] } — UNE entrée par sujet de la liste, sans en omettre ni en inventer.\n")
	return sb.String()
}

// memEnabled — interrupteur global de la mémoire éditoriale (config memory.enabled).
func memEnabled(resolver *config.Resolver) bool {
	if resolver == nil {
		return true
	}
	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return true
	}
	if b, ok := settings["memory.enabled"].(bool); ok {
		return b
	}
	return true
}

// memWindowDays — fenêtre de la mémoire (config memory.windowDays, défaut 30).
func memWindowDays(resolver *config.Resolver) int {
	days := 30
	if resolver != nil {
		if settings, err := resolver.Settings(); err == nil && settings != nil {
			if n := int(toFloat64(settings["memory.windowDays"], float64(days))); n > 0 && n <= 365 {
				days = n
			}
		}
	}
	return days
}

// dateOnly — "2026-08-29T12:00:00Z" → "2026-08-29".
func dateOnly(iso string) string {
	if len(iso) >= 10 {
		return iso[:10]
	}
	return iso
}
