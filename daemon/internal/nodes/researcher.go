package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/payload"
)

const (
	fallbackResearcherSystem = "Tu es le filtre éditorial de L'Assez, un média d'investigation anticapitaliste. Ton but est de filtrer l'actualité brute et de la catégoriser.\nGarde les sujets systémiques : inégalités, luttes sociales, corruption, extrême-droite, mensonges médiatiques, impérialisme.\nJette les polémiques stériles, les faits divers, la communication gouvernementale classique.\nRÈGLE DU BIAIS : Observe le source_bias. Si une source de 'Droite/Extrême-Droite' attaque un sujet ou une figure 'Décoloniale/Gauche', sois hyper critique : rejette si c'est de la désinformation pure, ou ajoute un flag 'CRITICAL_CROSSCHECK'."
	fallbackRejectCriteria = "REJETTE CATÉGORIQUEMENT :\n- Faits divers isolés (accidents, crimes passionnels, vols).\n- Lifestyle, divertissement, sport, tech \"gadget\".\n- Micro-polémiques de réseaux sociaux sans enjeu de pouvoir réel."
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
func RunResearcher(client *payload.Client, resolver *config.Resolver) error {
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

	ctx := context.Background()
	ai, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("gemini client: %w", err)
	}
	defer ai.Close()

	modelName := "gemini-3.5-flash-lite"
	if v := resolver.GetEffectiveParam("research", "aiModelFlash", modelName); v != nil {
		if s, ok := v.(string); ok && s != "" {
			modelName = s
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

	model := ai.GenerativeModel(modelName)
	model.ResponseMIMEType = "application/json"
	model.ResponseSchema = &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"approved":          {Type: genai.TypeBoolean, Description: "True si le sujet présente une valeur journalistique"},
			"score":             {Type: genai.TypeInteger, Description: "Note de 0 à 100"},
			"reason":            {Type: genai.TypeString, Description: "Justification succincte du choix"},
			"suggestedTaxonomy": {Type: genai.TypeString, Description: "Catégorie suggérée"},
			"suggestedGeo":      {Type: genai.TypeString, Description: "Zone géographique concernée (ex: France, International)"},
		},
		Required: []string{"approved", "score", "reason"},
	}

	var (
		wg  sync.WaitGroup
		sem = make(chan struct{}, concurrency)
		rl  = newGeminiRateLimiter(12)
	)

	for _, topic := range topics {
		wg.Add(1)
		sem <- struct{}{}
		go func(topic payload.Signal) {
			defer wg.Done()
			defer func() { <-sem }()

			raw := struct {
				ClusterTitle  string `json:"clusterTitle"`
				Excerpt       string `json:"excerpt"`
				SourceContent string `json:"source_content"`
				SourceName    string `json:"source_name"`
			}{}
			_ = json.Unmarshal(topic.RawData, &raw)

			prompt := buildResearchPrompt(researcherSystem, rejectCriteria, customPrompt, taxonomyList, raw)

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer cancel()
			rl.Wait()
			resp, err := model.GenerateContent(callCtx, genai.Text(prompt))
			if err != nil {
				if isQuotaError(err) {
					log.Printf("[Node 3] ⏸️ Quota Gemini atteint (%s) : sujet laissé en attente.", topic.ID)
					return
				}
				log.Printf("[Node 3] ❌ Erreur analyse sujet %s: %v", topic.ID, err)
				return
			}
			text, err := responseText(resp)
			if err != nil {
				log.Printf("[Node 3] ❌ Réponse vide pour %s", topic.ID)
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

			// scoreThreshold — le slider "Note minimale" du labo (Écriture + Atelier).
		// Défaut 50 = le labo est à 50/100 slider minimum.
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
	ClusterTitle  string `json:"clusterTitle"`
	Excerpt       string `json:"excerpt"`
	SourceContent string `json:"source_content"`
	SourceName    string `json:"source_name"`
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
	excerpt := raw.Excerpt
	if excerpt == "" {
		excerpt = raw.SourceContent
	}
	sb.WriteString(fmt.Sprintf("Extrait : %s\n", excerpt))
	sb.WriteString(fmt.Sprintf("Source : %s", orSource(raw.SourceName)))
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

func responseText(resp *genai.GenerateContentResponse) (string, error) {
	if resp == nil || len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no content generated")
	}
	text, ok := resp.Candidates[0].Content.Parts[0].(genai.Text)
	if !ok {
		return "", fmt.Errorf("unexpected part type")
	}
	return strings.TrimSpace(string(text)), nil
}
