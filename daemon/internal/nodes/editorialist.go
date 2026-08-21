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

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

const (
	fallbackBaseIdentity    = "Tu es le rédacteur en chef du média d'investigation L'Assez. Ton style est percutant, analytique et sans langue de bois."
	fallbackResearchMission = "Transformer les informations brutes en un compte-rendu d'investigation captivant et étayé."
	fallbackVocabularyRules = "Utiliser un vocabulaire précis, incisif et factuel. Bannir le jargon vague et le sensationnalisme gratuit."
	fallbackImageRules      = "Suggérer des mots-clés d'illustrations sobres et évocateurs."
)

type draftResult struct {
	Headline     string   `json:"headline"`
	Body         string   `json:"body"`
	Tags         []string `json:"tags"`
	ImageKeyword string   `json:"imageKeyword"`
}

// RunEditorialist is Node 4 of the pipeline: it writes the investigation
// draft (Gemini Pro) for RESEARCHED signals and moves them to DRAFTED.
func RunEditorialist(client *payload.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 4: Editorialist] ✍️ Lancement de la rédaction IA (Modèle Pro)...")

	topics, err := client.GetSignalsByStatus("RESEARCHED")
	if err != nil {
		return err
	}
	// Traite au plus maxItemsPerCycle sujets par cycle (quota Gemini).
	if limit := maxItemsPerCycle(resolver, "editor", 10); len(topics) > limit {
		topics = topics[:limit]
	}
	if len(topics) == 0 {
		log.Printf("[Node 4] ℹ️ Aucun sujet (statut: RESEARCHED) à rédiger.")
		return nil
	}
	log.Printf("[Node 4] 📝 %d sujets à rédiger (limite de cycle).", len(topics))

	// Clé depuis radar-settings (interface admin sécurisée), fallback .env.
	apiKey := geminiAPIKey(resolver, "editor")
	if apiKey == "" {
		log.Printf("[Node 4] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

	ctx := context.Background()
	ai, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("gemini client: %w", err)
	}
	defer ai.Close()

	modelName := "gemini-3.5-flash-lite"
	if v := resolver.GetEffectiveParam("editor", "aiModelPro", modelName); v != nil {
		if s, ok := v.(string); ok && s != "" {
			modelName = s
		}
	}
	concurrency := 3
	if v := resolver.GetEffectiveParam("editor", "maxConcurrentTasks", float64(3)); v != nil {
		concurrency = int(toFloat64(v, 3))
	}
	if concurrency < 1 {
		concurrency = 1
	}

	baseIdentity, researchMission, vocabularyRules, imageRules := fallbackBaseIdentity, fallbackResearchMission, fallbackVocabularyRules, fallbackImageRules
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if s, ok := settings["baseIdentityPrompt"].(string); ok && s != "" {
			baseIdentity = s
		}
		if s, ok := settings["researchMissionPrompt"].(string); ok && s != "" {
			researchMission = s
		}
		if s, ok := settings["vocabularyRulesPrompt"].(string); ok && s != "" {
			vocabularyRules = s
		}
		if s, ok := settings["imageRulesPrompt"].(string); ok && s != "" {
			imageRules = s
		}
	}

	templates, err := client.GetTaxonomyTemplates(true)
	if err != nil {
		log.Printf("[Node 4] ⚠️ Templates taxonomie indisponibles: %v", err)
		templates = nil
	}

	model := ai.GenerativeModel(modelName)
	model.ResponseMIMEType = "application/json"
	model.ResponseSchema = &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"headline":     {Type: genai.TypeString, Description: "Titre percutant au style L'Assez"},
			"body":         {Type: genai.TypeString, Description: "Corps complet du texte d'investigation"},
			"tags":         {Type: genai.TypeArray, Items: &genai.Schema{Type: genai.TypeString}, Description: "Mots-clés et thématiques"},
			"imageKeyword": {Type: genai.TypeString, Description: "Mot-clé en anglais pour l'illustration d'arrière-plan"},
		},
		Required: []string{"headline", "body", "tags"},
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
			}{}
			_ = json.Unmarshal(topic.RawData, &raw)

			taxonomy := topic.Taxonomy
			if taxonomy == "" {
				taxonomy = "INFO"
			}
			var template *payload.TaxonomyTemplate
			for i := range templates {
				if strings.EqualFold(templates[i].Name, taxonomy) {
					template = &templates[i]
					break
				}
			}

			var sb strings.Builder
			sb.WriteString(baseIdentity)
			sb.WriteString("\n")
			sb.WriteString(researchMission)
			sb.WriteString("\n")
			sb.WriteString(vocabularyRules)
			sb.WriteString("\n")
			sb.WriteString(imageRules)
			if template != nil && template.PromptText != "" {
				sb.WriteString(fmt.Sprintf("\n\nCONSIGNES CATÉGORIE [%s] :\n%s\n", template.Name, template.PromptText))
			}

			excerpt := raw.Excerpt
			if excerpt == "" {
				excerpt = raw.SourceContent
			}
			geo := topic.Geo
			if geo == "" {
				geo = "Global"
			}
			userPrompt := fmt.Sprintf(
				"REDACTION DU DOSSIER :\nTitre source : %s\nContenu source : %s\nCatégorie : %s\nZone Geo : %s",
				orTitle(raw.ClusterTitle), excerpt, taxonomy, geo,
			)

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			rl.Wait()
			resp, err := model.GenerateContent(callCtx, genai.Text(sb.String()+"\n\n"+userPrompt))
			if err != nil {
				if isQuotaError(err) {
					log.Printf("[Node 4] ⏸️ Quota Gemini atteint (%s) : sujet laissé en attente.", topic.ID)
					return
				}
				log.Printf("[Node 4] ❌ Erreur rédaction %s: %v", topic.ID, err)
				return
			}
			text, err := responseText(resp)
			if err != nil {
				log.Printf("[Node 4] ❌ Réponse vide pour %s", topic.ID)
				return
			}

			var draft draftResult
			if err := json.Unmarshal([]byte(text), &draft); err != nil {
				log.Printf("[Node 4] ❌ JSON invalide pour %s: %v", topic.ID, err)
				return
			}

			finalDraft, _ := json.Marshal(map[string]string{"headline": draft.Headline, "body": draft.Body})
			tagsJSON, _ := json.Marshal(draft.Tags)
			if len(tagsJSON) == 0 {
				tagsJSON = []byte("[]")
			}
			imageKeyword := draft.ImageKeyword
			if imageKeyword == "" {
				imageKeyword = topic.ImageURL
			}
			if imageKeyword == "" {
				imageKeyword = "investigation"
			}

			if err := client.UpdateSignal(topic.ID, map[string]any{
				"status":      "DRAFTED",
				"final_draft": string(finalDraft),
				"tags":        string(tagsJSON),
				"image_url":   imageKeyword,
			}); err != nil {
				log.Printf("[Node 4] ❌ Update %s: %v", topic.ID, err)
				return
			}
			log.Printf("[Node 4] ✅ Article rédigé : %s", draft.Headline)
		}(topic)
	}
	wg.Wait()

	log.Printf("[Node 4: Editorialist] Rédaction terminée.")
	return nil
}
