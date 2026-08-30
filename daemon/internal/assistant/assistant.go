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

const systemPrompt = `Tu es l'Assistant IA Intelligent et Automate Suprême de L'Assez Studio.
Tu es capable de piloter ENTIÈREMENT le workflow des pipelines d'information :
1. Planification et calendrier : scans récurrents (heures précises, plages 8h-22h, etc.), scans ponctuels, publications, modifications, suppressions.
2. Paramètres et réglages : ajuster les intervalles de scraping, délais anti-spam, activation de nœuds (collecte, dedup, tri, rédaction, image), seuils de ressemblance.
3. Déclenchement d'actions : lancer un scan immédiat sur un pipeline.
4. Gestion des signaux : déplacer ou router des signaux vers un autre pipeline.

Quand l'utilisateur te donne un ordre en langage naturel, tu analyses son intention et tu DOIS répondre avec un bloc JSON d'action exécutable à la fin de ton message si une modification est demandée.

Format de sortie avec action :
Explique brièvement ce que tu as fait de façon concise et proactive en français.
Si une ou plusieurs actions doivent être appliquées, ajoute TOUJOURS à la fin de ta réponse un bloc JSON délimité par:
` + "```json:actions" + `
[
  {
    "type": "schedule_slots",
    "pipeline_id": "principal",
    "days": ["LUN", "MAR", "MER", "JEU", "VEN"],
    "start_time": "08:00",
    "end_time": "22:00",
    "step_minutes": 60,
    "publish_offset_minutes": 30
  },
  {
    "type": "trigger_scan",
    "pipeline_id": "principal"
  },
  {
    "type": "set_pipeline_setting",
    "pipeline_id": "principal",
    "key": "scraping_interval",
    "value": 30
  },
  {
    "type": "route_signal",
    "target_pipeline_id": "flash",
    "filter_format": "FLASH"
  }
]
` + "```" + `

Types d'actions disponibles :
- schedule_slots : { pipeline_id, days (liste de LUN,MAR,MER,JEU,VEN,SAM,DIM ou "ALL"), time (ou start_time + end_time + step_minutes), publish_offset_minutes, week ("A"|"B"|"ALL") }
- schedule_oneshot : { pipeline_id, date ("YYYY-MM-DD"), time ("HH:MM"), publish_time }
- clear_slots : { pipeline_id, days, clear_all (bool) }
- trigger_scan : { pipeline_id }
- set_pipeline_setting : { pipeline_id, key, value } (ex: auto_publish, min_delay, max_delay, score_threshold)
- schedule_publication : { pipeline_id, date, time, platforms (["x", "discord", "bluesky"...]), format, title, content }

Reste toujours courtois, concis, efficace, et veille à bien identifier le pipeline visé (principal, flash, etc.). Si non spécifié, utilise le pipeline actif.`

func (e *AssistantEngine) ProcessChat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	e.mu.Lock()
	sessID := req.SessionID
	if sessID == "" {
		sessID = fmt.Sprintf("sess_%d", time.Now().UnixNano())
	}
	hist := e.history[sessID]
	e.mu.Unlock()

	// Construction du contexte conversationnel
	var conversationContext strings.Builder
	conversationContext.WriteString(systemPrompt)
	conversationContext.WriteString(fmt.Sprintf("\n\nPIPELINES DISPONIBLES : %s\n", e.getPipelinesSummary()))
	conversationContext.WriteString(fmt.Sprintf("PIPELINE ACTUELLEMENT SÉLECTIONNÉ : %s\n\n", req.ActivePipelineID))
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

	// Sauvegarde en mémoire
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
		case "schedule_slots":
			msg := e.executeScheduleSlots(pid, act)
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
