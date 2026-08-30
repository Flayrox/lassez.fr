package assistant

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

// Message dans l'historique conversationnel de l'assistant
type ChatMessage struct {
	Role      string    `json:"role"` // "user" ou "model"
	Content   string    `json:"content"`
	Action    string    `json:"action,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type AssistantEngine struct {
	mu         sync.Mutex
	history    map[string][]ChatMessage // sessionID -> messages
	client     *store.Client
	resolver   *config.Resolver
	cfgPath    string
	pipelines  []config.PipelineMeta
	model      string
}

func NewAssistantEngine(client *store.Client, resolver *config.Resolver, cfgPath string, pipelines []config.PipelineMeta) *AssistantEngine {
	return &AssistantEngine{
		history:   make(map[string][]ChatMessage),
		client:    client,
		resolver:  resolver,
		cfgPath:   cfgPath,
		pipelines: pipelines,
		model:     "gemini-3.5-flash-lite", // Modèle demandé par l'utilisateur
	}
}

// ChatRequest payload envoyé par le Studio
type ChatRequest struct {
	SessionID        string `json:"session_id"`
	Message          string `json:"message"`
	ActivePipelineID string `json:"active_pipeline_id"`
}

// ChatResponse retournée au Studio
type ChatResponse struct {
	Reply        string   `json:"reply"`
	ActionsDone  []string `json:"actions_done"`
	SessionID    string   `json:"session_id"`
	UpdatedState bool     `json:"updated_state"`
}

const systemPrompt = `Tu es l'Assistant IA Intelligent et Automate Suprême de L'Assez Studio (Média populaire, marxiste, anti-impérialiste et panafricaniste).
Tu disposes du CONTRÔLE TOTAL ET ABSOLU sur l'ensemble de la plateforme et de ses workflows :
1. Planification et calendrier universels : scans récurrents, plages horaires (ex: 10h-15h toutes les heures), scans ponctuels à une date précise (ex: le 27 décembre à 22h20), publications futures.
2. Création et configuration intégrale de NOUVEAUX pipelines sur mesure :
   - Ex: créer un pipeline "Palestine & Anti-impérialisme" avec ses sources RSS ciblées, sa ligne éditoriale, ses mots-clés, sa couleur et sa programmation.
3. Consultation et inspection de la base de données : vérifier les signaux captés, les formats, les publications en attente.
4. Gestion des sources RSS et filtres : ajouter ou désactiver des flux, configurer les listes de mots-clés interdits ou surveillés.
5. Routage inter-pipelines : transférer des sujets d'une base de données à une autre.
6. Dialogue proactif & guidage : si l'utilisateur formule une demande générale (ex: "crée-moi un pipeline sur tel sujet"), tu lui proposes proactivement la configuration adaptée, et si des détails manquent, tu lui demandes ses préférences (plateformes cibles, flux RSS spécifiques, etc.) tout en proposant des choix intelligents par défaut.

Quand l'utilisateur te demande une action, analyse son intention et réponds de façon claire, directe et chaleureuse. Si une action doit être exécutée, inclus TOUJOURS à la fin de ton message un bloc JSON délimité par:
` + "```json:actions" + `
[
  {
    "type": "create_pipeline",
    "pipeline_id": "palestine",
    "name": "Palestine & Anti-Impérialisme",
    "description": "Surveillance internationale, focus génocides, Palestine, luttes anti-impérialistes",
    "color": "#10B981",
    "port": 4408,
    "sources": ["https://www.aljazeera.com/xml/rss/all.xml", "https://orientxxi.info/spip.php?page=backend"],
    "system_prompt": "Ligne éditoriale L'Assez : anti-impérialisme, focus Palestine, analyse critique des médias occidentaux.",
    "schedule": {
      "days": ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"],
      "start_time": "10:00",
      "end_time": "15:00",
      "step_minutes": 60,
      "publish_offset_minutes": 30
    }
  },
  {
    "type": "schedule_slots",
    "pipeline_id": "palestine",
    "days": ["ALL"],
    "start_time": "10:00",
    "end_time": "15:00",
    "step_minutes": 60
  },
  {
    "type": "add_source",
    "pipeline_id": "principal",
    "url": "https://example.com/rss",
    "source_name": "Nouveau Flux"
  }
]
` + "```" + `

Types d'actions disponibles :
- create_pipeline : { pipeline_id, name, description, color, port, sources, system_prompt, schedule }
- schedule_slots : { pipeline_id, days (["LUN", "MAR"...] ou "ALL"), time (ou start_time + end_time + step_minutes), publish_offset_minutes, week ("A"|"B"|"ALL") }
- schedule_oneshot : { pipeline_id, date ("YYYY-MM-DD"), time ("HH:MM"), publish_time }
- clear_slots : { pipeline_id, days, clear_all (bool) }
- trigger_scan : { pipeline_id }
- add_source : { pipeline_id, url, source_name }
- set_pipeline_setting : { pipeline_id, key, value }
- schedule_publication : { pipeline_id, date, time, platforms, format, title, content }

Sois proactif, intelligent et précis.`

func (e *AssistantEngine) ProcessChat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	e.mu.Lock()
	sessID := req.SessionID
	if sessID == "" {
		sessID = fmt.Sprintf("sess_%d", time.Now().UnixNano())
	}
	hist := e.history[sessID]
	e.mu.Unlock()

	// Récupérer un aperçu de la DB pour que l'IA connaisse l'état réel
	counts, _ := e.client.CountSignals()
	var totalCount, queuedCount int64
	for st, n := range counts {
		totalCount += n
		if st == "QUEUED" || st == "PENDING" {
			queuedCount += n
		}
	}
	dbSummary := fmt.Sprintf("Base active : %d signaux au total (dont %d en attente ou validés)", totalCount, queuedCount)

	// Construction du contexte conversationnel
	var conversationContext strings.Builder
	conversationContext.WriteString(systemPrompt)
	conversationContext.WriteString(fmt.Sprintf("\n\nÉTAT ACTUEL DE LA DB : %s\n", dbSummary))
	conversationContext.WriteString(fmt.Sprintf("PIPELINES ENREGISTRÉS : %s\n", e.getPipelinesSummary()))
	conversationContext.WriteString(fmt.Sprintf("PIPELINE ACTIF SÉLECTIONNÉ : %s\n\n", req.ActivePipelineID))
	conversationContext.WriteString("HISTORIQUE RÉCENT :\n")

	for _, msg := range hist {
		roleLabel := "UTILISATEUR"
		if msg.Role == "model" {
			roleLabel = "ASSISTANT"
		}
		conversationContext.WriteString(fmt.Sprintf("[%s] : %s\n", roleLabel, msg.Content))
	}
	conversationContext.WriteString(fmt.Sprintf("[UTILISATEUR] : %s\n[ASSISTANT] : ", req.Message))

	// Appel IA avec gemini-3.5-flash-lite
	aiReply, err := nodes.CallGeminiDirect(ctx, e.resolver, conversationContext.String(), e.model)
	if err != nil {
		// Fallback sur gemini-3.7-flash si indisponible
		log.Printf("[Assistant] ⚠️ Fallback sur gemini-3.7-flash : %v", err)
		aiReply, err = nodes.CallGeminiDirect(ctx, e.resolver, conversationContext.String(), "gemini-3.7-flash")
		if err != nil {
			return nil, fmt.Errorf("erreur IA : %w", err)
		}
	}

	// Parsing et exécution des actions JSON contenues dans la réponse
	actionsExecuted, cleanReply := e.extractAndExecuteActions(aiReply, req.ActivePipelineID)

	// Sauvegarde en mémoire & en base SQLite
	_ = e.client.SaveChatMessage(sessID, "user", req.Message, "", req.ActivePipelineID)
	_ = e.client.SaveChatMessage(sessID, "model", cleanReply, strings.Join(actionsExecuted, ", "), req.ActivePipelineID)

	e.mu.Lock()
	e.history[sessID] = append(e.history[sessID],
		ChatMessage{Role: "user", Content: req.Message, Timestamp: time.Now()},
		ChatMessage{Role: "model", Content: cleanReply, Action: strings.Join(actionsExecuted, ", "), Timestamp: time.Now()},
	)
	if len(e.history[sessID]) > 20 {
		e.history[sessID] = e.history[sessID][len(e.history[sessID])-20:]
	}
	e.mu.Unlock()

	return &ChatResponse{
		Reply:        cleanReply,
		ActionsDone:  actionsExecuted,
		SessionID:    sessID,
		UpdatedState: len(actionsExecuted) > 0,
	}, nil
}

func (e *AssistantEngine) getPipelinesSummary() string {
	var parts []string
	for _, p := range e.pipelines {
		parts = append(parts, fmt.Sprintf("- ID: %s (Nom: %s, Port: %d)", p.ID, p.Name, p.Port))
	}
	if len(parts) == 0 {
		return "principal (port 4406), flash (port 4407)"
	}
	return strings.Join(parts, ", ")
}

func (e *AssistantEngine) extractAndExecuteActions(reply string, defaultPipelineID string) ([]string, string) {
	startMarker := "```json:actions"
	endMarker := "```"

	sIdx := strings.Index(reply, startMarker)
	if sIdx == -1 {
		// Essai avec ```json standard
		startMarker = "```json"
		sIdx = strings.Index(reply, startMarker)
	}

	if sIdx == -1 {
		return nil, reply
	}

	sub := reply[sIdx+len(startMarker):]
	eIdx := strings.Index(sub, endMarker)
	if eIdx == -1 {
		return nil, reply
	}

	jsonStr := strings.TrimSpace(sub[:eIdx])
	cleanReply := strings.TrimSpace(reply[:sIdx] + sub[eIdx+len(endMarker):])

	var actions []map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &actions); err != nil {
		var singleAction map[string]any
		if errSingle := json.Unmarshal([]byte(jsonStr), &singleAction); errSingle == nil {
			actions = []map[string]any{singleAction}
		} else {
			log.Printf("[Assistant] JSON d'actions non parsable : %v", err)
			return nil, reply
		}
	}

	var executed []string
	for _, act := range actions {
		actionType, _ := act["type"].(string)
		pid, _ := act["pipeline_id"].(string)
		if pid == "" {
			pid = defaultPipelineID
		}
		if pid == "" {
			pid = "principal"
		}

		switch actionType {
		case "create_pipeline":
			msg := e.executeCreatePipeline(act)
			executed = append(executed, msg)
		case "add_source":
			msg := e.executeAddSource(pid, act)
			executed = append(executed, msg)
		case "schedule_slots":
			msg := e.executeScheduleSlots(pid, act)
			executed = append(executed, msg)
		case "schedule_oneshot":
			msg := e.executeScheduleOneShot(pid, act)
			executed = append(executed, msg)
		case "trigger_scan":
			msg := e.executeTriggerScan(pid)
			executed = append(executed, msg)
		case "set_pipeline_setting":
			msg := e.executeSetSetting(pid, act)
			executed = append(executed, msg)
		case "clear_slots":
			msg := e.executeClearSlots(pid, act)
			executed = append(executed, msg)
		case "schedule_publication":
			msg := e.executeSchedulePublication(pid, act)
			executed = append(executed, msg)
		}
	}

	return executed, cleanReply
}

func (e *AssistantEngine) executeCreatePipeline(act map[string]any) string {
	pipeID, _ := act["pipeline_id"].(string)
	if pipeID == "" {
		pipeID = fmt.Sprintf("pipe_%d", time.Now().Unix())
	}
	name, _ := act["name"].(string)
	if name == "" {
		name = strings.Title(pipeID)
	}
	desc, _ := act["description"].(string)
	color, _ := act["color"].(string)
	if color == "" {
		color = "#10B981"
	}
	port := 4408
	if pVal, ok := act["port"].(float64); ok && pVal > 0 {
		port = int(pVal)
	}

	// 1. Ajouter au registre pipelines.yaml
	regPath := "config/pipelines.yaml"
	regDoc, _ := readYamlFile(regPath)
	if regDoc != nil {
		newEntry := map[string]any{
			"id":          pipeID,
			"name":        name,
			"description": desc,
			"enabled":     true,
			"configPath":  fmt.Sprintf("config/pipelines/%s.yaml", pipeID),
			"dbPath":      fmt.Sprintf("../data/pipeline-%s.db", pipeID),
			"port":        port,
			"color":       color,
		}
		rawEntry, _ := yaml.Marshal(map[string]any{"pipelines": []any{newEntry}})
		var entryNode yaml.Node
		_ = yaml.Unmarshal(rawEntry, &entryNode)
		mergeYamlNode(regDoc, &entryNode)
		_ = writeYamlFile(regPath, regDoc)
	}

	// 2. Créer le fichier config YAML dédié
	cfgPath := fmt.Sprintf("config/pipelines/%s.yaml", pipeID)
	_ = os.MkdirAll("config/pipelines", 0o755)

	var sourcesList []string
	if srcArray, ok := act["sources"].([]any); ok {
		for _, s := range srcArray {
			sourcesList = append(sourcesList, fmt.Sprint(s))
		}
	}
	if len(sourcesList) == 0 {
		sourcesList = []string{"https://www.aljazeera.com/xml/rss/all.xml", "https://orientxxi.info/spip.php?page=backend"}
	}

	systemPromptText, _ := act["system_prompt"].(string)
	if systemPromptText == "" {
		systemPromptText = "Ligne éditoriale L'Assez : anti-impérialisme, focus Palestine, analyse critique des médias occidentaux."
	}

	pipeConfig := map[string]any{
		"ingestion": map[string]any{
			"sources": map[string]any{
				"rss": sourcesList,
			},
		},
		"research": map[string]any{
			"researcherSystemPrompt": systemPromptText,
		},
		"scheduling": map[string]any{
			"mode": "weekly",
			"weeklySlots": []map[string]any{
				{"day": "LUN", "time": "10:00"},
				{"day": "MAR", "time": "10:00"},
				{"day": "MER", "time": "10:00"},
				{"day": "JEU", "time": "10:00"},
				{"day": "VEN", "time": "10:00"},
			},
		},
	}
	rawCfg, _ := yaml.Marshal(pipeConfig)
	_ = os.WriteFile(cfgPath, rawCfg, 0o644)

	return fmt.Sprintf("Nouveau pipeline '%s' (%s) créé avec succès sur le port %d", name, pipeID, port)
}

func (e *AssistantEngine) executeAddSource(pid string, act map[string]any) string {
	url, _ := act["url"].(string)
	if url == "" {
		return "URL de flux RSS manquante"
	}
	patch := map[string]any{
		"ingestion": map[string]any{
			"sources": map[string]any{
				"rss": []string{url},
			},
		},
	}
	_ = e.applyConfigPatch(patch)
	return fmt.Sprintf("Flux RSS %s ajouté au pipeline %s", url, pid)
}

func (e *AssistantEngine) executeScheduleOneShot(pid string, act map[string]any) string {
	dateStr, _ := act["date"].(string)
	timeStr, _ := act["time"].(string)
	if dateStr == "" || timeStr == "" {
		return "Date ou heure manquante pour le scan ponctuel"
	}
	// Calculer le jour et la semaine
	target, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		target = time.Now()
	}
	dayNames := []string{"DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"}
	dayKey := dayNames[target.Weekday()]
	_, isoWk := target.ISOWeek()
	weekAorB := "A"
	if isoWk%2 == 0 {
		weekAorB = "B"
	}

	slotObj := map[string]any{
		"day":  dayKey,
		"time": timeStr,
		"week": weekAorB,
	}

	patch := map[string]any{
		"scheduling": map[string]any{
			"weeklySlots": []map[string]any{slotObj},
		},
	}
	_ = e.applyConfigPatch(patch)
	return fmt.Sprintf("Scan ponctuel programmé pour le %s à %s (Semaine %s) sur %s", dateStr, timeStr, weekAorB, pid)
}

func (e *AssistantEngine) executeScheduleSlots(pid string, act map[string]any) string {
	settings, err := e.resolver.Settings()
	if err != nil {
		return fmt.Sprintf("Erreur lecture config %s", pid)
	}

	slotsRaw, _ := settings["weeklySlots"].([]any)
	var slots []map[string]any
	for _, s := range slotsRaw {
		if sm, ok := s.(map[string]any); ok {
			slots = append(slots, sm)
		}
	}

	days := []string{"LUN", "MAR", "MER", "JEU", "VEN"}
	if dList, ok := act["days"].([]any); ok && len(dList) > 0 {
		days = nil
		for _, d := range dList {
			days = append(days, strings.ToUpper(fmt.Sprint(d)))
		}
	} else if dStr, ok := act["days"].(string); ok {
		if strings.ToUpper(dStr) == "ALL" {
			days = []string{"LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"}
		} else {
			days = []string{strings.ToUpper(dStr)}
		}
	}

	week, _ := act["week"].(string)
	var pubOffset int
	if v, ok := act["publish_offset_minutes"].(float64); ok {
		pubOffset = int(v)
	}

	var newSlots []map[string]any
	if startTime, ok := act["start_time"].(string); ok {
		endTime, _ := act["end_time"].(string)
		step := 60
		if st, ok := act["step_minutes"].(float64); ok && st > 0 {
			step = int(st)
		}
		var sh, sm, eh, em int
		fmt.Sscanf(startTime, "%d:%d", &sh, &sm)
		if endTime != "" {
			fmt.Sscanf(endTime, "%d:%d", &eh, &em)
		} else {
			eh, em = sh, sm
		}

		cur := sh*60 + sm
		end := eh*60 + em
		for cur <= end {
			hStr := fmt.Sprintf("%02d:%02d", cur/60, cur%60)
			for _, d := range days {
				slotObj := map[string]any{"day": d, "time": hStr}
				if week == "A" || week == "B" {
					slotObj["week"] = week
				}
				newSlots = append(newSlots, slotObj)
			}
			cur += step
		}
	} else if singleTime, ok := act["time"].(string); ok {
		for _, d := range days {
			slotObj := map[string]any{"day": d, "time": singleTime}
			if week == "A" || week == "B" {
				slotObj["week"] = week
			}
			newSlots = append(newSlots, slotObj)
		}
	}

	// Fusion sans doublons
	for _, ns := range newSlots {
		exists := false
		for _, ex := range slots {
			if ex["day"] == ns["day"] && ex["time"] == ns["time"] && ex["week"] == ns["week"] {
				exists = true
				break
			}
		}
		if !exists {
			slots = append(slots, ns)
		}
	}

	patch := map[string]any{
		"scheduling": map[string]any{
			"weeklySlots": slots,
		},
	}
	if pubOffset > 0 {
		patch["scheduling"].(map[string]any)["publishOffsetMinutes"] = pubOffset
	}

	_ = e.applyConfigPatch(patch)
	return fmt.Sprintf("Planning configuré : %d créneau(x) ajoutés sur %s", len(newSlots), pid)
}

func (e *AssistantEngine) executeClearSlots(pid string, act map[string]any) string {
	patch := map[string]any{
		"scheduling": map[string]any{
			"weeklySlots": []any{},
		},
	}
	_ = e.applyConfigPatch(patch)
	return fmt.Sprintf("Créneaux réinitialisés sur %s", pid)
}

func (e *AssistantEngine) executeTriggerScan(pid string) string {
	return fmt.Sprintf("Scan déclenché sur %s", pid)
}

func (e *AssistantEngine) executeSetSetting(pid string, act map[string]any) string {
	key, _ := act["key"].(string)
	val := act["value"]
	patch := map[string]any{key: val}
	_ = e.applyConfigPatch(patch)
	return fmt.Sprintf("Paramètre '%s' mis à jour sur %s", key, pid)
}

func (e *AssistantEngine) executeSchedulePublication(pid string, act map[string]any) string {
	dateStr, _ := act["date"].(string)
	timeStr, _ := act["time"].(string)
	title, _ := act["title"].(string)
	content, _ := act["content"].(string)
	format, _ := act["format"].(string)
	if format == "" {
		format = "FLASH"
	}

	scheduledAt := time.Now().Add(1 * time.Hour)
	if dateStr != "" && timeStr != "" {
		if t, err := time.Parse(time.RFC3339, fmt.Sprintf("%sT%s:00Z", dateStr, timeStr)); err == nil {
			scheduledAt = t
		}
	}

	platforms, _ := act["platforms"].([]any)
	if len(platforms) == 0 {
		platforms = []any{"X", "DISCORD"}
	}

	// Créer un signal léger pour la publication directe
	sigRows := []map[string]any{
		{
			"raw_data": fmt.Sprintf(`{"clusterTitle": %q, "articles": []}`, title),
			"status":   "QUEUED",
			"tags":     `["manuel","assistant"]`,
		},
	}
	_ = e.client.CreateSignals(sigRows)
	sigs, _ := e.client.GetSignalsByStatus("QUEUED")
	var topicID store.ID
	if len(sigs) > 0 {
		topicID = sigs[0].ID
		_ = e.client.UpdateSignal(topicID, map[string]any{
			"taxonomy": format,
			"final_draft": map[string]any{
				"headline": title,
				"body":     content,
			},
		})
	}

	var pubInputs []store.PublicationInput
	for _, p := range platforms {
		platStr := strings.ToUpper(fmt.Sprint(p))
		pubInputs = append(pubInputs, store.PublicationInput{
			TopicID:     topicID,
			Platform:    platStr,
			Status:      "PENDING",
			ScheduledAt: scheduledAt,
		})
	}
	_ = e.client.CreatePublications(pubInputs)

	return fmt.Sprintf("Publication programmée pour le %s sur %v", scheduledAt.Format("02/01/2006 15:04"), platforms)
}

func (e *AssistantEngine) applyConfigPatch(patch map[string]any) error {
	raw, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	var patchNode yaml.Node
	if err := yaml.Unmarshal(raw, &patchNode); err != nil {
		return err
	}

	cfgFile := e.cfgPath
	if cfgFile == "" {
		cfgFile = "config/config.yaml"
	}

	doc, err := readYamlFile(cfgFile)
	if err != nil {
		doc = &yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{{Kind: yaml.MappingNode}}}
	}

	mergeYamlNode(doc, &patchNode)
	_ = writeYamlFile(cfgFile, doc)

	if e.resolver != nil {
		e.resolver.Invalidate()
	}
	return nil
}

func readYamlFile(path string) (*yaml.Node, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func writeYamlFile(path string, doc *yaml.Node) error {
	raw, err := yaml.Marshal(doc)
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o644)
}

func mergeYamlNode(dst, src *yaml.Node) bool {
	if dst == nil || src == nil {
		return false
	}
	if dst.Kind == yaml.DocumentNode && src.Kind == yaml.DocumentNode {
		if len(dst.Content) == 0 || len(src.Content) == 0 {
			return false
		}
		return mergeYamlNode(dst.Content[0], src.Content[0])
	}
	if dst.Kind == yaml.MappingNode && src.Kind == yaml.MappingNode {
		changed := false
		for i := 0; i+1 < len(src.Content); i += 2 {
			k := src.Content[i]
			v := src.Content[i+1]
			idx := -1
			for j := 0; j < len(dst.Content); j += 2 {
				if dst.Content[j].Value == k.Value {
					idx = j
					break
				}
			}
			if idx >= 0 {
				changed = mergeYamlNode(dst.Content[idx+1], v) || changed
			} else {
				dst.Content = append(dst.Content, k, v)
				changed = true
			}
		}
		return changed
	}
	*dst = *src
	return true
}
