package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

const validatorSystemPrompt = `Tu es le Secrétaire de Rédaction de "L'Assez". Ton rôle est de VALIDER ou CORRIGER les brouillons produits par l'IA.
CRITÈRES :
1. Le ton doit être neutre, rigoureux, clinique et incisif.
2. Éviter tout vocabulaire sensationnaliste ou déplacé.
3. Précision factuelle et clarté synthétique absolues.`

type validationResult struct {
	IsValid     bool   `json:"isValid"`
	Corrections string `json:"corrections"`
	Reason      string `json:"reason"`
}

// RunValidator is Node 5 of the pipeline: it re-reads DRAFTED drafts for
// factual and editorial compliance, then moves them to VALIDATED or rejects
// them (REJECTED / REJECTED_ERROR).
func RunValidator(client *payload.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 5: Validator] ⚖️ Lancement de la validation éditoriale...")

	topics, err := client.GetSignalsByStatus("DRAFTED")
	if err != nil {
		return err
	}
	// Traite au plus maxItemsPerCycle sujets par cycle (quota Gemini).
	// Les autres restent DRAFTED et seront repris au cycle suivant.
	if limit := maxItemsPerCycle(resolver, "validator", 10); len(topics) > limit {
		topics = topics[:limit]
	}
	if len(topics) == 0 {
		log.Printf("[Node 5] ℹ️ Aucun sujet (statut: DRAFTED) à valider.")
		return nil
	}
	log.Printf("[Node 5] ⚖️ %d sujet(s) à valider (limite de cycle).", len(topics))

	// Clé depuis radar-settings (interface admin sécurisée), fallback .env.
	apiKey := geminiAPIKey(resolver, "validator")
	if apiKey == "" {
		log.Printf("[Node 5] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

	ctx := context.Background()
	ai, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("gemini client: %w", err)
	}
	defer ai.Close()

	modelName := "gemini-3.5-flash-lite"
	if v := resolver.GetEffectiveParam("validator", "aiModelValidator", modelName); v != nil {
		if s, ok := v.(string); ok && s != "" {
			modelName = s
		}
	}
	concurrency := 5
	if v := resolver.GetEffectiveParam("validator", "maxConcurrentTasks", float64(5)); v != nil {
		concurrency = int(toFloat64(v, 5))
	}
	if concurrency < 1 {
		concurrency = 1
	}

	model := ai.GenerativeModel(modelName)
	model.ResponseMIMEType = "application/json"
	model.ResponseSchema = &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"isValid":     {Type: genai.TypeBoolean, Description: "True si validé, False sinon"},
			"corrections": {Type: genai.TypeString, Description: "Le texte corrigé si nécessaire"},
			"reason":      {Type: genai.TypeString, Description: "Justification du verdict de validation"},
		},
		Required: []string{"isValid", "reason"},
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

			var draft struct {
				Body string `json:"body"`
			}
			if len(topic.FinalDraft) > 0 {
				_ = json.Unmarshal(topic.FinalDraft, &draft)
			}

			prompt := validatorSystemPrompt + "\n\nVoici le brouillon à évaluer :\n" + draft.Body

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer cancel()
			rl.Wait()
			resp, err := model.GenerateContent(callCtx, genai.Text(prompt))
			if err != nil {
				// Quota dépassé : on ne marque PAS le sujet en erreur, il sera
				// simplement repris au prochain cycle.
				if isQuotaError(err) {
					log.Printf("[Node 5] ⏸️ Quota Gemini atteint (%s) : sujet laissé en attente.", topic.ID)
					return
				}
				log.Printf("[Node 5] ❌ Erreur validation %s: %v", topic.ID, err)
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED_ERROR"})
				return
			}
			text, err := responseText(resp)
			if err != nil {
				log.Printf("[Node 5] ❌ Réponse vide pour %s", topic.ID)
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED_ERROR"})
				return
			}

			var eval validationResult
			if err := json.Unmarshal([]byte(text), &eval); err != nil {
				log.Printf("[Node 5] ❌ JSON invalide pour %s: %v", topic.ID, err)
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED_ERROR"})
				return
			}

			if eval.IsValid {
				update := map[string]any{"status": "VALIDATED"}
				if eval.Corrections != "" {
					var merged map[string]any
					if len(topic.FinalDraft) > 0 {
						_ = json.Unmarshal(topic.FinalDraft, &merged)
					}
					if merged == nil {
						merged = map[string]any{}
					}
					merged["body"] = eval.Corrections
					if b, err := json.Marshal(merged); err == nil {
						update["final_draft"] = string(b)
					}
				}
				if err := client.UpdateSignal(topic.ID, update); err != nil {
					log.Printf("[Node 5] ❌ Update %s: %v", topic.ID, err)
					return
				}
				log.Printf("[Node 5] ✅ Validé : %s", topic.ID)
			} else {
				if err := client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED"}); err != nil {
					log.Printf("[Node 5] ❌ Update %s: %v", topic.ID, err)
					return
				}
				log.Printf("[Node 5] ❌ Rejeté (%s) : %s", eval.Reason, topic.ID)
			}
		}(topic)
	}
	wg.Wait()

	return nil
}
