package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

const (
	fallbackResearcherSystem = "Tu es un rédacteur en chef d'investigation. Ton rôle est de trier et évaluer la valeur journalistique des dépêches brutes."
	fallbackRejectCriteria   = "Rejeter les faits divers mineurs sans portée sociétale, la publicité déguisée et les annonces corporate triviales."
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
	if len(topics) == 0 {
		log.Printf("[Node 3] ℹ️ Aucun sujet (statut: INGESTED) à analyser.")
		return nil
	}
	log.Printf("[Node 3] 🔍 %d sujets en attente d'analyse IA.", len(topics))

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Printf("[Node 3] ⚠️ GEMINI_API_KEY absente. Étape ignorée.")
		return nil
	}

	ctx := context.Background()
	ai, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("gemini client: %w", err)
	}
	defer ai.Close()

	modelName := "gemini-3-flash-preview"
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

			prompt := buildResearchPrompt(researcherSystem, rejectCriteria, customPrompt, raw)

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer cancel()
			resp, err := model.GenerateContent(callCtx, genai.Text(prompt))
			if err != nil {
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

			if eval.Approved && eval.Score >= 50 {
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

func buildResearchPrompt(system, reject, custom string, raw struct {
	ClusterTitle  string `json:"clusterTitle"`
	Excerpt       string `json:"excerpt"`
	SourceContent string `json:"source_content"`
	SourceName    string `json:"source_name"`
}) string {
	var sb strings.Builder
	sb.WriteString(system)
	sb.WriteString("\n\nCRITÈRES DE REJET :\n")
	sb.WriteString(reject)
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
