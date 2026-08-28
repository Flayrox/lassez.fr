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
	"github.com/Flayrox/lassez.fr/daemon/internal/payload"
)

// Le DNA factory de L'Assez (porté de l'ancien labo, scripts/seed-taxonomies.ts) :
// ces fallbacks s'appliquent quand le YAML/labo ne fournit pas de valeur.
const (
	fallbackBaseIdentity    = "Tu es le Rédacteur en Chef de \"L'Assez\", un média d'investigation radical sur les réseaux sociaux. Ta mission est de rédiger un post percutant (style Twitter/Telegram) à partir des sources fournies.\nTON : Urgent, scandalisé, implacable, intelligent et direct (\"Le Mécanicien\"). Tu refuses le jargon militant poussiéreux."
	fallbackResearchMission = "=== MISSION DE RECHERCHE ET SYNTHÈSE ===\n1. Utilise le CONTENU FOURNI dans le contexte comme base de ton analyse.\n2. Utilise ton outil GOOGLE SEARCH pour :\n   - Vérifier les faits.\n   - Extraire le \"passif\" ou les casseroles des protagonistes mentionnés.\n   - Trouver des éléments de contexte plus larges pour armer ton attaque implacable."
	fallbackVocabularyRules = "=== LA RÈGLE DE VOCABULAIRE (ALERTE ROUGE - SANCTION) ===\n- MOTS INTERDITS (Trop sociologiques) : Oligarchie, Bourgeoisie, Bloc bourgeois, Prolétaire, Superstructure, Dystopie, Grand capital, Peste brune, Camisole libérale.\n- MOTS AUTORISÉS (Impact direct) : Le gouvernement, les milliardaires, le patronat, la Macronie, la droite, l'extrême droite, les travailleurs, l'État, les actionnaires.\n- Traduis la novlangue : \"Maintien de l'ordre\" = Répression policière. \"Hub de retour\" = Camps de déportation.\n- Règle sur la Palestine : Parle de \"colons israéliens\", de \"sionistes\" ou du \"gouvernement de Netanyahu\", JAMAIS de \"colons juifs\". Dénonce le génocide et l'hypocrisie occidentale tout en évitant les amalgames antisémites."
	fallbackImageRules      = `=== RÈGLE DES IMAGES (LA MÉTHODE DES TIRS) ===
Trouver des images d'actualité précises sur le web peut être difficile. C'est pourquoi tu dois TOUJOURS juger lequel des 3 "Tirs" conviendrait le plus pour illustrer ce sujet, en fonction de la probabilité de trouver une image précise sur Google. En fonction de ton choix, tu rempliras le tableau image_search_queries avec 1, 2 ou 3 requêtes. Notre robot tentera la première, puis les suivantes (s'il y en a) si elle échoue.

- Tir 1 (Le Sniper) : Ultra précis, si tu juges qu'il est très probable d'avoir une image précise par rapport au contexte. Tu ne mets qu'UNE SEULE requête dans le tableau !! (ex: ["Nicolas Sarkozy tribunal de Paris"] ou si c'est plusieurs personnes ["Emmanuel Macron Angela Merkel"]).
- Tir 2 (Le Pistolet) : Plus large, si tu juges que le Tir 1 a de grandes chances d'échouer. Contexte institutionnel ou lieu. Tu y intègres 2 requêtes (ex: ["Palais de justice de Paris façade", "Ministère de l'économie Bercy bâtiment"]).
- Tir 3 (Le Fusil à pompe) : La sécurité absolue. Symbole général et large. À utiliser quand le contexte est impossible à illustrer avec une vraie photo de presse. Tu y intègres 3 requêtes. Par exemple si la Norvège et l'Espagne décident de reconnaitre la Palestine, alors tu pourrais mettre (ex: ["Drapeau Norvège", "Drapeau Espagne", "Drapeau Palestine"]).`

	// Template de secours quand aucun format actif n'est trouvé (YAML vide) :
	// l'éditorialiste garde quand même des consignes de base.
	fallbackFormatPrompt = "=== CONSIGNES DE RÉDACTION (par défaut) ===\nRédige un post percutant au style L'Assez, factuel et dénonciateur. Headline percutante, body court et incisif, tags pertinents, 1 à 3 requêtes d'image selon la méthode des Tirs."
)

type draftResult struct {
	Taxonomie          string   `json:"taxonomie"`
	Geo                string   `json:"geo"`
	Tags               []string `json:"tags"`
	Headline           string   `json:"headline"`
	Body               string   `json:"body"`
	ImageSearchQueries []string `json:"image_search_queries"`
	ImageKeyword       string   `json:"imageKeyword"`
	Metadata           struct {
		AccentColor string `json:"accent_color"`
	} `json:"metadata"`
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
	apiKey := GeminiAPIKey(resolver, "editor")
	if apiKey == "" {
		log.Printf("[Node 4] ⚠️ Clé Gemini absente (geminiApiKey / GEMINI_DAEMON_API_KEY). Étape ignorée.")
		return nil
	}

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
		// Nom de la persona (éditable dans le labo, editorial.personaName) :
		// remplace l'ancien nom partout où il apparaît dans la ligne éditoriale.
		personaName := "Le Mécanicien"
		if s, ok := settings["personaName"].(string); ok && s != "" {
			personaName = s
		}
		renamePersona := func(s string) string { return strings.ReplaceAll(s, "Le Mécanicien", personaName) }
		baseIdentity = renamePersona(baseIdentity)
		researchMission = renamePersona(researchMission)
		vocabularyRules = renamePersona(vocabularyRules)
		imageRules = renamePersona(imageRules)
	}

	templates, err := client.GetTaxonomyTemplates(true)
	if err != nil {
		log.Printf("[Node 4] ⚠️ Templates taxonomie indisponibles: %v", err)
		templates = nil
	}

	// Raisonnement (thinking) de la rédaction : élevé par défaut — l'IA raisonne
	// (avec Google Search) et remplace l'ancien nœud de validation : un seul
	// passage rédige ET contrôle. Réglable via editorial.thinkingBudget.
	thinkingBudget := editorThinking
	if v := resolver.GetEffectiveParam("editor", "thinkingBudget", float64(editorThinking)); v != nil {
		if n := int32(toFloat64(v, float64(editorThinking))); n > 0 {
			thinkingBudget = n
		}
	}

	// Validateur coupé dans le graphe → la rédaction écrit VALIDATED (prêt
	// pour le média) au lieu de DRAFTED : le raisonnement fait office de
	// vérification.
	validatorActive := true
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if gs, ok := settings["pipelineGraphJson"].(string); ok && gs != "" {
			var g struct {
				Nodes []struct {
					Type    string `json:"type"`
					Enabled *bool  `json:"enabled"`
				} `json:"nodes"`
			}
			if json.Unmarshal([]byte(gs), &g) == nil {
				for _, n := range g.Nodes {
					if n.Type == "validator" {
						validatorActive = n.Enabled == nil || *n.Enabled
					}
				}
			}
		}
	}
	if !validatorActive {
		log.Printf("[Node 4] 🔩 Vérification désactivée : la rédaction raisonne en un seul passage et écrit directement VALIDATED.")
	}

	// Recherche web : grounding Google Search natif de l'API REST — le modèle
	// fait de VRAIES recherches à chaque rédaction (vérif des faits, passif des
	// protagonistes, contexte). Désactivée → on retire l'outil de la mission.
	searchWeb := boolParam(resolver, "editor", "webSearchEnabled", true)
	if !searchWeb {
		researchMission = stripGoogleSearch(researchMission)
		log.Printf("[Node 4] 🔍 Recherche web désactivée : l'IA rédige sans vérification en ligne.")
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
				ClusterTitle string            `json:"clusterTitle"`
				Articles     []IngestedArticle `json:"articles"`
			}{}
			_ = json.Unmarshal(topic.RawData, &raw)

			taxonomy := topic.Taxonomy
			if taxonomy == "" {
				taxonomy = "INFO"
			}
			var template *payload.TaxonomyTemplate
			for i := range templates {
				if strings.EqualFold(templates[i].Name, taxonomy) || strings.EqualFold(templates[i].DisplayName, taxonomy) {
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
			if template != nil {
				if template.PromptText != "" {
					sb.WriteString(fmt.Sprintf("\n\nCONSIGNES CATÉGORIE [%s] :\n%s\n", template.DisplayName, template.PromptText))
				}
				// Few-shot : des posts d'exemple du format — recopie le STYLE, pas le contenu.
				if len(template.Examples) > 0 {
					sb.WriteString(fmt.Sprintf("\nEXEMPLES DE POSTS [%s] (imite le style, jamais le contenu) :\n", template.DisplayName))
					for i, ex := range template.Examples {
						sb.WriteString(fmt.Sprintf("--- EXEMPLE %d ---\n%s\n", i+1, ex))
					}
				}
				// Schéma de sortie JSON attendu.
				if template.OutputSchema != "" {
					sb.WriteString(fmt.Sprintf("\nSCHÉMA DE SORTIE JSON ATTENDU :\n%s\n", template.OutputSchema))
				}
			} else {
				// Aucun format actif trouvé (YAML sans formats) → consignes de secours.
				sb.WriteString("\n\n" + fallbackFormatPrompt + "\n")
			}
			geo := topic.Geo
			if geo == "" {
				geo = "Global"
			}

			// MATIÈRE PREMIÈRE : extraits RSS de tous les articles + contenu
			// complet des meilleures sources (fetch direct). Avant ceci, le
			// modèle ne recevait que le titre du cluster.
			material := buildSourceMaterial(raw.Articles)

			userPrompt := fmt.Sprintf(
				"REDACTION DU DOSSIER :\nTitre source : %s\nCatégorie : %s\nZone Geo : %s%s\n\nRédige l'article en t'appuyant UNIQUEMENT sur la matière première ci-dessus (contenu complet des articles, extraits, biais des sources). Ne jamais inventer de faits absents de cette matière.",
				orTitle(raw.ClusterTitle), taxonomy, geo, material,
			)

			// Modèle par format : modelByFormat (id du format → modèle) prime sur
			// le modèle de rédaction global — chaque rubrique a son IA.
			effModel := modelName
			if m := modelForFormat(resolver, taxonomy); m != "" {
				effModel = m
			}

			// Timeout par appel : une API qui pend ne doit pas bloquer le nœud.
			// Le raisonnement + recherche peut être long → 240 s.
			callCtx, cancel := context.WithTimeout(context.Background(), 240*time.Second)
			defer cancel()
			rl.Wait()
			text, err := callGemini(callCtx, geminiParams{
				apiKey:          apiKey,
				model:           effModel,
				modelFallback:   "gemini-3.5-flash-lite", // repli si 3.7 flash hors quota (niveau gratuit)
				system:          sb.String(),
				user:            userPrompt,
				temperature:     editorTemp,
				topP:            editorTopP,
				maxTokens:       editorTokens,
				thinkingBudget:  thinkingBudget,
				search:          searchWeb,
				responseSchema:  schemaEditorialist(),
				vertex:          VertexAIConfig(resolver),
			})
			if err != nil {
				if isQuotaError(err) {
					log.Printf("[Node 4] ⏸️ Quota Gemini atteint (%s) : sujet laissé en attente.", topic.ID)
					return
				}
				log.Printf("[Node 4] ❌ Erreur rédaction %s: %v", topic.ID, err)
				return
			}

			var draft draftResult
			if err := json.Unmarshal([]byte(text), &draft); err != nil {
				log.Printf("[Node 4] ❌ JSON invalide pour %s: %v", topic.ID, err)
				return
			}

			// Le brouillon final porte tout le schéma (headline/body + requêtes d'image),
			// le publisher lit headline/body, le nœud Media lit image_search_queries.
			finalDraft, _ := json.Marshal(map[string]any{
				"taxonomie": draft.Taxonomie, "geo": draft.Geo,
				"headline": draft.Headline, "body": draft.Body,
				"tags":                 draft.Tags,
				"image_search_queries": draft.ImageSearchQueries,
				"metadata":             draft.Metadata,
			})
			tagsJSON, _ := json.Marshal(draft.Tags)
			if len(tagsJSON) == 0 {
				tagsJSON = []byte("[]")
			}
			imageKeyword := draft.ImageKeyword
			if imageKeyword == "" && len(draft.ImageSearchQueries) > 0 {
				imageKeyword = draft.ImageSearchQueries[0]
			}
			if imageKeyword == "" {
				imageKeyword = topic.ImageURL
			}
			if imageKeyword == "" {
				imageKeyword = "investigation"
			}

			targetStatus := "DRAFTED"
			if !validatorActive {
				targetStatus = "VALIDATED" // pas de vérification : le raisonnement vaut validation
			}
			if err := client.UpdateSignal(topic.ID, map[string]any{
				"status":      targetStatus,
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

// modelForFormat — modèle dédié au format (editorial.modelByFormat du YAML,
// clé = id du format), si présent. Vide sinon → le modèle global est utilisé.
func modelForFormat(resolver *config.Resolver, taxonomy string) string {
	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return ""
	}
	mbf, ok := settings["modelByFormat"].(map[string]any)
	if !ok {
		return ""
	}
	for k, v := range mbf {
		if strings.EqualFold(k, taxonomy) {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

// stripGoogleSearch — retire l'outil GOOGLE SEARCH de la mission de recherche
// quand la recherche web est désactivée : l'IA n'utilise que le contenu fourni.
func stripGoogleSearch(prompt string) string {
	lines := strings.Split(prompt, "\n")
	out := make([]string, 0, len(lines))
	skip := false
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if strings.Contains(strings.ToUpper(l), "GOOGLE SEARCH") {
			skip = true
			continue
		}
		if skip {
			// Les puces de l'outil sont indentées ; une ligne non indentée relance.
			if l == "" || strings.HasPrefix(trimmed, "-") || strings.HasPrefix(trimmed, "*") || strings.HasPrefix(l, "   ") || strings.HasPrefix(l, "\t") {
				continue
			}
			skip = false
		}
		out = append(out, l)
	}
	return strings.Join(out, "\n")
}
