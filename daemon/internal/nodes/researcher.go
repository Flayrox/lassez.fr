package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

const (
	fallbackResearcherSystem = "Tu es le filtre éditorial de L'Assez, un média populaire, marxiste, panafricaniste, socialiste français et anti-impérialiste. Ton but : ne garder que l'actualité qui sert la lutte des classes, l'émancipation des peuples et la critique du système — et jeter le reste sans hésiter.\n\nCE QU'ON GARDE EN PRIORITÉ :\n- La politique française vue d'en bas : le gouvernement, le patronat, les milliardaires, la Macronie, la droite et l'extrême droite, les lois contre les travailleurs, les privatisations, la répression, les scandales, les élections.\n- L'anti-impérialisme : les États-Unis et Trump (guerres commerciales, OTAN, intimidation des pays du Sud), Israël et la Palestine, la France en Afrique (néocolonialisme, bases militaires, exploitation des ressources), la dette illégitime des pays du Sud.\n- Le panafricanisme et les luttes des peuples africains : indépendance, souveraineté, résistances populaires.\n- Les luttes sociales et écologiques : grèves, salaires, logement, énergie, inégalités, climat.\n\nTES ALLIÉS : tu es du côté de la gauche sociale et populaire — la France Insoumise, le NPA, les syndicats. Ne garde pas les sujets montés contre eux par la droite ou les médias hostiles.\nLE DEUX POIDS, DEUX MESURES EST UN CRITÈRE : un sujet qui illustre la sévérité envers les plus pauvres face à la complaisance envers les puissants est un TRÈS BON sujet.\nRÈGLE DU BIAIS : Observe le source_bias. Si une source de 'Droite/Extrême-Droite' attaque un sujet ou une figure 'Décoloniale/Gauche', sois hyper critique : rejette si c'est de la désinformation pure, ou ajoute un flag 'CRITICAL_CROSSCHECK'."
	fallbackRejectCriteria = "REJETTE CATÉGORIQUEMENT :\n- Les infos internationales ANECDOTIQUES sans enjeu systémique : monarchies, culture people étrangère, faits divers locaux hors de France, sport, « histoire incroyable » dans un pays lointain qui n'illustre aucune lutte. L'international ne passe QUE s'il touche l'impérialisme, la Palestine, l'Afrique et le panafricanisme, la guerre et ses victimes, ou la politique américaine.\n- Les faits divers isolés (accidents, crimes passionnels, vols) — même en France, sauf s'ils révèlent une injustice systémique (violences policières, impunité des puissants, scandale d'État).\n- Lifestyle, divertissement, sport, culture people, tech \"gadget\".\n- Les micro-polémiques de réseaux sociaux sans enjeu de pouvoir réel.\n- La communication gouvernementale classique (annonces sans substance)."
)

type researchEvaluation struct {
	Approved          bool   `json:"approved"`
	Score             int    `json:"score"`
	Reason            string `json:"reason"`
	SuggestedTaxonomy string `json:"suggestedTaxonomy"`
	SuggestedGeo      string `json:"suggestedGeo"`
}

// RunResearcher is Node 3 of the pipeline: it scores INGESTED signals via
// Gemini Flash and either approves them (RESEARCHED + taxonomy/geo) or
// rejects them.
func RunResearcher(client *store.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 3: Researcher] 🧠 Lancement du filtrage IA...")

	topics, err := client.GetSignalsByStatus("INGESTED")
	if err != nil {
		return err
	}
	// Traite au plus maxItemsPerCycle sujets par cycle (quota Gemini).
	if limit := maxItemsPerCycle(resolver, "research", 10); len(topics) > limit {
		topics = topics[:limit]
	}
	if len(topics) == 0 {
		log.Printf("[Node 3] ℹ️ Aucun sujet (statut: INGESTED) à analyser.")
		return nil
	}
	log.Printf("[Node 3] 🔍 %d sujets à analyser (limite de cycle).", len(topics))

	// Clé depuis les secrets du studio (.secrets.yaml), fallback .env.
	apiKey := GeminiAPIKey(resolver, "research")
	if apiKey == "" {
		log.Printf("[Node 3] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

	modelName := "gemini-3.7-flash"
	if v := resolver.GetEffectiveParam("research", "aiModelFlash", modelName); v != nil {
		if s, ok := v.(string); ok && s != "" {
			modelName = s
		}
	}
	// Thinking MOYEN (repli de l'orchestrateur) : le tri raisonne un peu, la
	// rédaction rédige (très élevé). 0 = réponse directe sans raisonnement.
	thinking := int32(2048)
	if v := resolver.GetEffectiveParam("research", "thinkingBudget", float64(thinking)); v != nil {
		if n := int32(toFloat64(v, float64(thinking))); n > 0 {
			thinking = n
		}
	}
	customPrompt := ""
	if v := resolver.GetEffectiveParam("research", "customPromptModifier", ""); v != nil {
		customPrompt, _ = v.(string)
	}
	concurrency := 5
	if v := resolver.GetEffectiveParam("research", "maxConcurrentTasks", float64(5)); v != nil {
		concurrency = int(toFloat64(v, 5))
	}
	if concurrency < 1 {
		concurrency = 1
	}

	researcherSystem := fallbackResearcherSystem
	rejectCriteria := fallbackRejectCriteria
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if s, ok := settings["researcherSystemPrompt"].(string); ok && s != "" {
			researcherSystem = s
		}
		if s, ok := settings["researcherRejectCriteria"].(string); ok && s != "" {
			rejectCriteria = s
		}
	}

	// Les formats actifs (id + description) : Gemini doit choisir sa taxonomie
	// parmi les vraies catégories configurées, pas n'importe quelle chaîne.
	taxonomyList := ""
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
			taxonomyList = "\n\nCATÉGORIES DISPONIBLES (choisis EXACTEMENT un de ces ids pour suggestedTaxonomy) :\n" + strings.Join(parts, "\n") + "\n"
		}
	}

	// Recherche web : le modèle fait de VRAIES recherches Google à chaque
	// analyse (grounding natif de l'API REST) pour vérifier les faits et
	// débusquer le passif des protagonistes. Désactivable dans le studio.
	searchWeb := boolParam(resolver, "research", "webSearchEnabled", true)
	if !searchWeb {
		log.Printf("[Node 3] 🔍 Recherche web désactivée : le tri se fait sans vérification en ligne.")
	}

	var (
		wg  sync.WaitGroup
		sem = make(chan struct{}, concurrency)
		rl  = newGeminiRateLimiter(12)
	)

	for _, topic := range topics {
		wg.Add(1)
		sem <- struct{}{}
		go func(topic store.Signal) {
			defer wg.Done()
			defer func() { <-sem }()

			raw := struct {
				ClusterTitle string            `json:"clusterTitle"`
				Articles     []IngestedArticle `json:"articles"`
			}{}
			_ = json.Unmarshal(topic.RawData, &raw)

			prompt := buildResearchPrompt(researcherSystem, rejectCriteria, customPrompt, taxonomyList, raw)

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			rl.Wait()
			text, err := callGemini(callCtx, geminiParams{
				apiKey:         apiKey,
				model:          modelName,
				system:         "",
				user:           prompt,
				temperature:    researchTemp,
				topP:           researchTopP,
				maxTokens:      researchTokens,
				thinkingBudget: thinking,
				search:         searchWeb,
				responseSchema: schemaResearcher(),
				vertex:         VertexAIConfig(resolver),
			})
			if err != nil {
				if isQuotaError(err) {
					log.Printf("[Node 3] ⏸️ Quota Gemini atteint (%s) : sujet laissé en attente.", topic.ID)
					return
				}
				log.Printf("[Node 3] ❌ Erreur analyse sujet %s: %v", topic.ID, err)
				return
			}

			var eval researchEvaluation
			if err := json.Unmarshal([]byte(text), &eval); err != nil {
				log.Printf("[Node 3] ❌ JSON invalide pour %s: %v", topic.ID, err)
				return
			}

			title := raw.ClusterTitle
			if title == "" {
				title = string(topic.ID)
			}

			// scoreThreshold — le slider "Note minimale" du studio (Écriture + Atelier).
		// Défaut 50 = le studio est à 50/100 slider minimum.
		scoreThreshold := 50
		if v := resolver.GetEffectiveParam("research", "scoreThreshold", float64(50)); v != nil {
			if n := int(toFloat64(v, 50)); n >= 0 && n <= 100 {
				scoreThreshold = n
			}
		}
		if eval.Approved && eval.Score >= scoreThreshold {
				taxonomy := eval.SuggestedTaxonomy
				if taxonomy == "" {
					taxonomy = "INFO"
				}
				geo := eval.SuggestedGeo
				if geo == "" {
					geo = "FRANCE"
				}
				if err := client.UpdateSignal(topic.ID, map[string]any{
					"status":   "RESEARCHED",
					"taxonomy": taxonomy,
					"geo":      geo,
				}); err != nil {
					log.Printf("[Node 3] ❌ Update %s: %v", topic.ID, err)
					return
				}
				log.Printf("[Node 3] ✅ Approved (Score: %d/100): %s", eval.Score, title)
			} else {
				if err := client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED"}); err != nil {
					log.Printf("[Node 3] ❌ Update %s: %v", topic.ID, err)
					return
				}
				log.Printf("[Node 3] ❌ Rejeté (%s): %s", eval.Reason, title)
			}
		}(topic)
	}
	wg.Wait()

	log.Printf("[Node 3: Researcher] Analyse IA terminée.")
	return nil
}

func buildResearchPrompt(system, reject, custom, taxonomyList string, raw struct {
	ClusterTitle string            `json:"clusterTitle"`
	Articles     []IngestedArticle `json:"articles"`
}) string {
	var sb strings.Builder
	sb.WriteString(system)
	sb.WriteString("\n\nCRITÈRES DE REJET :\n")
	sb.WriteString(reject)
	sb.WriteString(taxonomyList)
	if custom != "" {
		sb.WriteString("\n\nCONSIGNES ÉDITORIALES SPÉCIFIQUES :\n")
		sb.WriteString(custom)
		sb.WriteString("\n")
	}
	sb.WriteString("\n\nSUJET À ÉVALUER :\n")
	sb.WriteString(fmt.Sprintf("Titre : %s\n", orTitle(raw.ClusterTitle)))
	// Les vrais articles du sujet — avec le biais et la fiabilité de CHAQUE
	// source, pour que la règle CRITICAL_CROSSCHECK puisse réellement
	// s'appliquer (elle référençait source_bias sans jamais le recevoir).
	for i, a := range raw.Articles {
		if i >= 8 {
			sb.WriteString("… (autres articles du sujet non listés)\n")
			break
		}
		sb.WriteString(fmt.Sprintf("Article %d : %s (%s)\n", i+1, orTitle(a.Title), orSource(a.SourceName)))
		sb.WriteString(fmt.Sprintf("Biais de la source : %s | Confiance : %d/10\n", orBias(a.SourceBias), a.TrustScore))
		snip := strings.TrimSpace(a.Content)
		if len(snip) > 500 {
			snip = snip[:500] + "…"
		}
		if snip != "" {
			sb.WriteString("Extrait RSS : " + snip + "\n")
		}
	}
	if len(raw.Articles) == 0 {
		sb.WriteString("Aucun article brut associé (titre seul).\n")
	}
	sb.WriteString("\nRÈGLE DU BIAIS (obligatoire) : si une source de Droite/Extrême-Droite attaque un sujet ou une figure de Gauche/Décoloniale, sois HYPER critique : rejette si c'est de la désinformation pure, sinon ajoute le flag 'CRITICAL_CROSSCHECK' dans reason.")
	return sb.String()
}

func orTitle(s string) string {
	if s == "" {
		return "Sujet sans titre"
	}
	return s
}

func orSource(s string) string {
	if s == "" {
		return "Inconnue"
	}
	return s
}

func orBias(s string) string {
	if s == "" {
		return "Inconnu"
	}
	return s
}


