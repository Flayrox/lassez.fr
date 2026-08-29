package nodes

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

const validatorSystemPrompt = `Tu es le Secrétaire de Rédaction de "L'Assez", un média d'investigation anticapitaliste. Ton rôle est de VALIDER ou CORRIGER les brouillons produits par l'IA.

LE STYLE DE L'ASSEZ EST VOLONTAIREMENT : urgent, scandalisé, implacable, direct ("Le Mécanicien"). Les émojis, les MAJUSCULES d'emphase et les formules choc sont NORMAUX et attendus — ne rejette jamais un brouillon pour ce ton.

CRITÈRES DE VALIDATION :
1. FAITS : les affirmations sont-elles vérifiables et non inventées ? Vérifie en ligne (recherche web) quand c'est possible. Rejette tout fait non sourcé ou inventé.
2. VOCABULAIRE : respecte la règle de vocabulaire (mots interdits : Oligarchie, Bourgeoisie, Prolétaire, Dystopie, Grand capital... ; mots autorisés : le gouvernement, les milliardaires, le patronat, la Macronie, les travailleurs).
3. AMALGAMES : aucune formulation antisémite ou raciste. Pour la Palestine : parler de "colons israéliens", de "sionistes" ou du "gouvernement de Netanyahu", JAMAIS de "colons juifs".
4. CONFORMITÉ FORMAT : le brouillon respecte la structure du format demandé (FLASH court et brut, ALERTE avec en-tête + titre choc + faits + tacle final, CITATION avec la phrase exacte...).
5. QUALITÉ : titre percutant, corps factuel et argumenté, source citée, pas de hors-sujet.

Si le brouillon est conforme → isValid: true, corrections vide. Sinon → isValid: false, corrections: le texte corrigé (si corrigeable), reason: le motif précis.`

type validationResult struct {
	IsValid     bool   `json:"isValid"`
	Corrections string `json:"corrections"`
	Reason      string `json:"reason"`
}

// RunValidator is Node 5 of the pipeline: it re-reads DRAFTED drafts for
// factual and editorial compliance, then moves them to VALIDATED or rejects
// them (REJECTED / REJECTED_ERROR). Avec enableAutoApprove (Mode Fantôme),
// la validation IA vaut approbation : les brouillons valides passent
// directement PENDING (file de publication) sans modération ni enrichissement.
func RunValidator(client *store.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 5: Validator] ⚖️ Lancement de la validation éditoriale...")

	// Mode Fantôme (auto_approve_enabled) : la validation IA vaut approbation.
	// Par défaut l'enrichissement média est conservé (enableAutoApproveMedia=true) :
	// le brouillon passe VALIDATED → nœud Image → PENDING → auto-approuvé à la
	// programmation. Avec enableAutoApproveMedia=false il saute VALIDATED/Image
	// et va directement PENDING.
	autoApprove := boolParam(resolver, "publisher", "enableAutoApprove", false)
	autoApproveMedia := boolParam(resolver, "publisher", "enableAutoApproveMedia", true)
	if autoApprove {
		if autoApproveMedia {
			log.Printf("[Node 5] 👻 Mode Fantôme ACTIF : validation IA = approbation, enrichissement média conservé (enableAutoApproveMedia=true).")
		} else {
			log.Printf("[Node 5] 👻 Mode Fantôme ACTIF (sans média) : les brouillons valides passent directement PENDING.")
		}
	}

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
	apiKey := GeminiAPIKey(resolver, "validator")
	if apiKey == "" {
		log.Printf("[Node 5] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

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

	// Recherche web : le validateur vérifie les faits EN LIGNE (grounding
	// Google Search) avant de valider ou corriger un brouillon.
	searchWeb := boolParam(resolver, "validator", "webSearchEnabled", true)
	if !searchWeb {
		log.Printf("[Node 5] 🔍 Recherche web désactivée : validation sans vérification en ligne.")
	}

	// Nom de la persona (éditable dans le labo) — remplacé dans le prompt si
	// l'utilisateur a renommé « Le Mécanicien ».
	systemPrompt := validatorSystemPrompt
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if s, ok := settings["personaName"].(string); ok && s != "" {
			systemPrompt = strings.ReplaceAll(systemPrompt, "Le Mécanicien", s)
		}
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

			var draft struct {
				Body string `json:"body"`
			}
			if len(topic.FinalDraft) > 0 {
				_ = json.Unmarshal(topic.FinalDraft, &draft)
			}

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			callCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			rl.Wait()
			text, err := callGemini(callCtx, geminiParams{
				apiKey:         apiKey,
				model:          modelName,
				system:         systemPrompt,
				user:           "Voici le brouillon à évaluer :\n" + draft.Body,
				temperature:    validatorTemp,
				topP:           validatorTopP,
				maxTokens:      validatorTokens,
				search:         searchWeb,
				responseSchema: schemaValidator(),
				vertex:         VertexAIConfig(resolver),
			})
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

			var eval validationResult
			if err := json.Unmarshal([]byte(text), &eval); err != nil {
				log.Printf("[Node 5] ❌ JSON invalide pour %s: %v", topic.ID, err)
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "REJECTED_ERROR"})
				return
			}

			if eval.IsValid {
				// Mode Fantôme sans média : la validation vaut approbation → PENDING direct.
				// Sinon (défaut) : VALIDATED → le nœud Image enrichit → PENDING.
				target := "VALIDATED"
				if autoApprove && !autoApproveMedia {
					target = "PENDING"
				}
				update := map[string]any{"status": target}
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
				if autoApprove {
					log.Printf("[Node 5] 👻 Mode Fantôme : %s auto-approuvé (→ %s).", topic.ID, target)
				}
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
