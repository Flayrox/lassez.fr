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

const (	fallbackResearcherSystem = "Tu es le filtre éditorial de L'Assez, un média populaire, marxiste, panafricaniste, socialiste français et anti-impérialiste. Ta mission : couvrir les grandes infos du jour que le public doit connaître — pas dénicher des sujets de niche. Tu traites l'actualité avec l'angle des classes populaires, comme un média d'info à fort impact. LA FRANCE D'ABORD : on privilégie ce qui touche directement les gens d'ici — politique, impôts, travail, pouvoir d'achat, inégalités, scandales français. L'international est STRICTEMENT LIMITÉ aux événements mondiaux majeurs : génocides, politique américaine, impérialisme. Les bulletins de guerre ordinaires et tout international anecdotique sont rejetés sans hésiter.\n\nCE QU'ON GARDE EN PRIORITÉ — les sujets MAJEURS, pas les marges :\n- LA FRANCE D'ABORD : les grandes décisions et réformes qui touchent tout le monde : impôts, prix, salaires, logement, santé, éducation, énergie, retraites, et leurs conséquences concrètes pour le public.\n- La politique française de premier plan : le gouvernement, les élections, les scandales d'État, la corruption, la répression, les lois contre les travailleurs, les privatisations, la Macronie, la droite et l'extrême droite, les milliardaires et le patronat.\n- Les scandales de pouvoir en France : impunité des puissants, violences policières, scandale d'État, racisme d'État — les affaires qui révèlent le deux poids, deux mesures.\n- Les médias et le pouvoir : les scandales de l'information — une rédaction qui recrute un cadre d'un média d'extrême droite (ex. France Info et Valeurs Actuelles), l'empire Bolloré (CNews, JDD, Europe 1), la réhabilitation médiatique des condamnés, le racisme et la manipulation à l'antenne.\n- Les luttes sociales et écologiques quand elles font l'actualité : grèves, mobilisations, inégalités criantes.\n- L'international — SEULEMENT à très fort enjeu : les GÉNOCIDES et crimes de masse documentés (Palestine/Gaza), les événements MONDIAUX MAJEURS dont parle le monde entier, la politique américaine qui impacte la France et le monde (Trump, midterms, guerres commerciales), l'impérialisme et le néocolonialisme (France en Afrique, dette des pays du Sud, OTAN), le panafricanisme et les luttes des peuples africains. PAS les bulletins de guerre quotidiens : une frappe, un bombardement, des combats localisés, même avec des dizaines de morts — on ne les traite pas, sauf tournant mondial (escalade majeure, événement historique).\n\nLE TEST D'IMPACT (comme un média d'info à fort impact) :\n- « Des milliers de gens sont-ils concernés ou en parlent-ils aujourd'hui ? » Oui → garde. Non (sujet confidentiel, technique, de microcosme) → rejette.\n- « Est-ce que ça touche la France ou les classes populaires ? » Si ni l'un ni l'autre, rejette — surtout pour l'international.\n- Le CHIFFRE QUI TUE : un montant, un nombre de victimes, un coût pour le public rend le sujet TRÈS BON.\n- Le DEUX POIDS, DEUX MESURES : la sévérité envers les pauvres face à la complaisance envers les puissants = TRÈS BON sujet.\n- La CONTRADICTION : un sujet qui dément une promesse ou une déclaration récente d'un responsable = TRÈS BON sujet.\n\nEXEMPLES DE BONS SUJETS (le genre d'infos qu'on garde) :\n- Un PDG (ex. TotalEnergies) qui dénonce le coût d'une augmentation de 100 € de salaire pendant qu'il distribue des dividendes → deux poids, deux mesures.\n- Un député RN qui traite Mélenchon de « candidat du fascisme », alors que le FN a été fondé avec d'anciens néofascistes et un ex-Waffen-SS → retournement contre l'extrême droite.\n- Une ministre qui boycotte une marche contre le racisme après qu'un maire a été comparé aux « grands singes » sur CNews → racisme médiatique et impunité du pouvoir.\n- L'empire Bolloré mobilisé pour réhabiliter un condamné → manipulation de l'information au service des puissants.\n- La France qui frôle la récession, l'inflation qui s'accélère, le pouvoir d'achat qui dégringole (Insee) → sujet économique majeur qui touche tout le monde.\n- Une déclaration passée vérifiée par les chiffres d'aujourd'hui (la dette passée de 2 210 à ~3 600 milliards) → contradiction + chiffre qui tue.\n- Trump qui attaque Paris et Londres sur la charia et le maire qui le recadre publiquement → politique américaine à fort impact (l'un des rares cas d'international accepté).\n\nTES ALLIÉS : tu es du côté de la gauche sociale et populaire — la France Insoumise, le NPA, les syndicats. Ne garde pas les sujets montés contre eux par la droite ou les médias hostiles.\nRÈGLE DU BIAIS : Observe le source_bias. Si une source de 'Droite/Extrême-Droite' attaque un sujet ou une figure 'Décoloniale/Gauche', sois hyper critique : rejette si c'est de la désinformation pure, ou ajoute un flag 'CRITICAL_CROSSCHECK'."
	fallbackRejectCriteria = "REJETTE CATÉGORIQUEMENT :\n- L'INTERNATIONAL ANECDOTIQUE — et surtout LES GUERRES ORDINAIRES : presque tout l'international est rejeté, y compris les bulletins de guerre quotidiens (frappes, bombardements, combats localisés, avancées de front, bilans d'attaques — même avec des dizaines de morts). Un conflit ne passe QUE s'il devient un événement MONDIAL MAJEUR : génocide documenté (Palestine/Gaza), escalade qui change la donne, tournant historique dont parle le monde entier. Ne passent aussi QUE la politique américaine (Trump, midterms, guerres commerciales), l'impérialisme/néocolonialisme (France en Afrique, dette des pays du Sud), et les décisions économiques mondiales qui touchent directement la France. REJETTE systématiquement : catastrophes naturelles à l'étranger (crues, séismes, cyclones, incendies hors de France), crimes et affaires judiciaires étrangères, politique intérieure d'un autre pays sans enjeu pour nous, monarchies, culture people étrangère, sport international, faits divers locaux hors de France.\n- Les affaires criminelles et religieuses SANS ANGLE DE POUVOIR : un prêtre pédocriminel, une affaire de mœurs, un crime atroce — même en France, même avec des centaines de victimes — ne passe PAS, sauf s'il révèle l'impunité d'une institution de pouvoir ou un scandale d'État (alors on traite l'angle pouvoir, pas le fait divers). EXEMPLE À REJETER : l'affaire Jacques Delfosse, ex-prêtre de la banlieue de Lille visé pour des centaines de viols présumés sur mineurs — scandaleux mais hors ligne éditoriale : on ne le traite pas.\n- Les sujets VAGUES : infos molles sans fait précis ni conséquence pour le public, « annonces » sans substance, généralités que personne n'attend, sujets de fond de tiroir.\n- Les sujets de NICHE : micro-politique intra-muros (manœuvres de second plan, querelles de parti sans enjeu national), sujets de spécialistes (technique, scientifique, académique), affaires locales sans portée nationale, culture confidentielle, « explications » de détail.\n- Les faits divers isolés (accidents, crimes passionnels, vols) — même en France, sauf s'ils révèlent une injustice systémique : violences policières, impunité des puissants, scandale d'État, féminicide médiatisé.\n- Lifestyle, divertissement, sport, culture people, cinéma, tech « gadget ».\n- Les micro-polémiques de réseaux sociaux sans enjeu de pouvoir réel.\n- La communication gouvernementale classique (annonces sans substance) — sauf si elle implique un changement réel pour le public."
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
	// Le tableau sert aussi à assainir la taxonomy renvoyée (sanitizeTaxonomy).
	var templates []store.TaxonomyTemplate
	taxonomyList := ""
	if templates, err = client.GetTaxonomyTemplates(true); err == nil {
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
				taxonomy := sanitizeTaxonomy(eval.SuggestedTaxonomy, templates)
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

// sanitizeTaxonomy — le modèle renvoie parfois UNE LISTE de formats
// ("FLASH|INFO|ALERTE|DECRYPTAGE|CITATION") au lieu d'un seul id, malgré la
// consigne. On normalise : premier id connu de la liste des formats actifs,
// sinon INFO. Zéro donnée aberrante en base.
func sanitizeTaxonomy(raw string, templates []store.TaxonomyTemplate) string {
	valid := map[string]bool{}
	for _, t := range templates {
		valid[strings.ToUpper(strings.TrimSpace(t.Name))] = true
	}
	// Sépare sur les séparateurs courants (| , / newline) et " ou "
	// ("ALERTE ou INFO") — puis prend le PREMIER id connu.
	for _, part := range strings.FieldsFunc(strings.ReplaceAll(raw, " ou ", "|"), func(r rune) bool {
		return r == '|' || r == ',' || r == '/' || r == '\n'
	}) {
		cand := strings.ToUpper(strings.TrimSpace(part))
		if valid[cand] {
			return cand
		}
	}
	return "INFO"
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
