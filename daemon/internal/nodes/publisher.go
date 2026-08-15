package nodes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

type publisherPlatform struct {
	Name string
	Mode string
}

// RunPublisher is Node 6 of the pipeline: the control tower. Phase A
// schedules publication missions for every enabled platform; Phase B
// dispatches the missions whose scheduled_at has passed.
func RunPublisher(client *payload.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 6: Publisher] 🚀 Lancement de la Tour de Contrôle (Scheduling & Diffusion)")

	enableDiscord := boolParam(resolver, "publisher", "enableDiscord", true)
	enableX := boolParam(resolver, "publisher", "enableX", false)
	enableBluesky := boolParam(resolver, "publisher", "enableBluesky", false)
	enableMastodon := boolParam(resolver, "publisher", "enableMastodon", false)
	enablePayloadCMS := boolParam(resolver, "publisher", "enablePayloadCMS", true)

	minDelay := intParam(resolver, "publisher", "minPublishDelay", 60)
	maxDelay := intParam(resolver, "publisher", "maxPublishDelay", 120)
	if maxDelay < minDelay {
		maxDelay = minDelay
	}
	enableAutoPublish := boolParam(resolver, "publisher", "enableAutoPublish", true)

	// ========================================================
	// PHASE A : CRÉATION DES MISSIONS DE PUBLICATION
	// ========================================================
	log.Printf("[Node 6: Phase A] 🔎 Recherche de nouveaux articles à planifier...")

	pending, err := client.GetPendingSignalsWithoutPublications()
	if err != nil {
		return fmt.Errorf("pending signals: %w", err)
	}

	if len(pending) > 0 {
		log.Printf("[Node 6: Phase A] 📤 %d nouveaux articles à programmer.", len(pending))

		// Bascule atomique PENDING → QUEUED.
		ids := make([]payload.ID, 0, len(pending))
		for _, t := range pending {
			ids = append(ids, t.ID)
		}
		if err := client.UpdateManySignals(ids, map[string]any{"status": "QUEUED"}); err != nil {
			log.Printf("[Node 6: Phase A] ⚠️ Bascule QUEUED partielle : %v", err)
		}

		platforms := []publisherPlatform{}
		if enableDiscord {
			platforms = append(platforms, publisherPlatform{"DISCORD", strParam(resolver, "publisher", "discordPublishMode", "DIRECT")})
		}
		if enableX {
			platforms = append(platforms, publisherPlatform{"X", strParam(resolver, "publisher", "xPublishMode", "SCHEDULED")})
		}
		if enableBluesky {
			platforms = append(platforms, publisherPlatform{"BLUESKY", strParam(resolver, "publisher", "blueskyPublishMode", "SCHEDULED")})
		}
		if enableMastodon {
			platforms = append(platforms, publisherPlatform{"MASTODON", strParam(resolver, "publisher", "mastodonPublishMode", "SCHEDULED")})
		}
		if enablePayloadCMS {
			platforms = append(platforms, publisherPlatform{"PAYLOAD", strParam(resolver, "publisher", "payloadPublishMode", "DIRECT")})
		}

		// Espacement des missions par plateforme.
		lastScheduled := map[string]time.Time{}
		now := time.Now()
		for _, p := range platforms {
			if p.Mode == "SCHEDULED" {
				lastPub, err := client.GetLastScheduledPublication(p.Name)
				if err != nil {
					log.Printf("[Node 6: Phase A] ⚠️ dernière publication %s : %v", p.Name, err)
					lastScheduled[p.Name] = now
					continue
				}
				if lastPub != nil && lastPub.ScheduledAt.After(now) {
					lastScheduled[p.Name] = lastPub.ScheduledAt
				} else {
					lastScheduled[p.Name] = now
				}
			} else {
				lastScheduled[p.Name] = now
			}
		}

		var missions []payload.PublicationInput
		for _, topic := range pending {
			for _, platform := range platforms {
				finalScheduledAt := now
				if platform.Mode == "SCHEDULED" {
					delayMinutes := minDelay + rand.Intn(maxDelay-minDelay+1) // min <= max garanti plus haut
					base := lastScheduled[platform.Name]
					finalScheduledAt = base.Add(time.Duration(delayMinutes) * time.Minute)
					lastScheduled[platform.Name] = finalScheduledAt
				}
				missions = append(missions, payload.PublicationInput{
					TopicID:     topic.ID,
					Platform:    platform.Name,
					Status:      "PENDING",
					ScheduledAt: finalScheduledAt,
				})
			}
		}

		if len(missions) > 0 {
			if err := client.CreatePublications(missions); err != nil {
				log.Printf("[Node 6: Phase A] ⚠️ Création des missions : %v", err)
			} else {
				log.Printf("[Node 6: Phase A] ✅ %d missions créées dans Payload.", len(missions))
			}
		}
	}

	// ========================================================
	// PHASE B : EXÉCUTION DES MISSIONS PRÊTES À PARTIR
	// ========================================================
	log.Printf("[Node 6: Phase B] ⏰ Vérification des publications programmées prêtes...")

	if !enableAutoPublish {
		log.Printf("[Node 6: Phase B] ⏸️ Pilote automatique désactivé (enableAutoPublish=false). Diffusion ignorée.")
		return nil
	}

	due, err := client.GetDuePublications(10)
	if err != nil {
		return fmt.Errorf("due publications: %w", err)
	}
	if len(due) == 0 {
		log.Printf("[Node 6: Phase B] 📭 Aucune publication en attente pour l'instant.")
		return nil
	}
	log.Printf("[Node 6: Phase B] ⚡ %d publications prêtes à être expédiées.", len(due))

	for _, pub := range due {
		if err := dispatchPublication(client, resolver, pub); err != nil {
			log.Printf("[Node 6: Phase B] ❌ Erreur lors de la diffusion de la publication %s : %v", pub.ID, err)
		}
		// Pause anti-rate-limit entre les envois.
		time.Sleep(2 * time.Second)
	}
	return nil
}

// dispatchPublication sends one due publication to its platform and updates
// the mission + signal statuses.
func dispatchPublication(client *payload.Client, resolver *config.Resolver, pub payload.Publication) error {
	markFailed := func() {
		_ = client.UpdatePublication(pub.ID, map[string]any{"status": "FAILED"})
	}

	topic := (*payload.Signal)(nil)
	if t, ok := pub.Topic(); ok {
		topic = t
	} else if topicID, ok := pub.TopicID(); ok {
		t, err := client.GetSignal(topicID)
		if err != nil {
			markFailed()
			return fmt.Errorf("récupération du signal %s : %w", topicID, err)
		}
		topic = t
	}
	if topic == nil {
		log.Printf("[Node 6: Phase B] ❌ Topic introuvable pour la publication %s", pub.ID)
		markFailed()
		return nil
	}

	var draft struct {
		Headline string `json:"headline"`
		Body     string `json:"body"`
	}
	if len(topic.FinalDraft) > 0 {
		if err := json.Unmarshal(topic.FinalDraft, &draft); err != nil {
			log.Printf("[Node 6: Phase B] ❌ Erreur parsing final_draft pour topic %s", topic.ID)
			markFailed()
			return nil
		}
	}

	var success bool
	switch pub.Platform {
	case "DISCORD":
		success = dispatchDiscord(client, resolver, topic, draft)
	case "PAYLOAD":
		success = dispatchPayload(client, resolver, topic, draft)
	case "X", "BLUESKY", "MASTODON":
		// Diffusion tierce non encore câblée dans la version TS d'origine.
		log.Printf("[Node 6: Phase B] ⚠️ Diffusion %s non implémentée (publication %s marquée FAILED).", pub.Platform, pub.ID)
	default:
		log.Printf("[Node 6: Phase B] ⚠️ Plateforme inconnue %q.", pub.Platform)
	}

	now := time.Now()
	if success {
		if err := client.UpdatePublication(pub.ID, map[string]any{"status": "PUBLISHED", "publishedAt": now}); err != nil {
			return err
		}
		log.Printf("[Node 6: Phase B] ✅ [%s] Message expédié pour le topic %s.", pub.Platform, topic.ID)

		if topicID, ok := pub.TopicID(); ok {
			remaining, err := client.CountPendingPublications(topicID)
			if err != nil {
				log.Printf("[Node 6: Phase B] ⚠️ CountPending %s : %v", topicID, err)
				return nil
			}
			if remaining == 0 {
				if err := client.UpdateSignal(topicID, map[string]any{"status": "PUBLISHED", "publishedAt": now}); err != nil {
					log.Printf("[Node 6: Phase B] ⚠️ Update signal %s : %v", topicID, err)
				}
			}
		}
		return nil
	}

	markFailed()
	return nil
}

// dispatchDiscord posts an embed to the configured webhook.
func dispatchDiscord(client *payload.Client, resolver *config.Resolver, topic *payload.Signal, draft struct {
	Headline string `json:"headline"`
	Body     string `json:"body"`
}) bool {
	webhookURL := os.Getenv("DISCORD_WEBHOOK_URL")
	if webhookURL == "" {
		log.Printf("[Node 6: Phase B] ❌ [DISCORD] DISCORD_WEBHOOK_URL absente du fichier .env")
		return false
	}

	colorHex := strParam(resolver, "publisher", "discordEmbedColor", "#DC2626")
	footerText := strParam(resolver, "publisher", "discordFooterText", "Radar L'Assez • Investigation")
	taxonomy := topic.Taxonomy
	if taxonomy == "" {
		taxonomy = "INFO"
	}
	geo := topic.Geo
	if geo == "" {
		geo = "Global"
	}
	headline := draft.Headline
	if headline == "" {
		headline = taxonomy
	}

	embed := map[string]any{
		"title":       headline,
		"description": draft.Body,
		"color":       hexToDecimal(colorHex),
		"fields": []map[string]any{
			{"name": "Niveau d'Alerte", "value": taxonomy, "inline": true},
			{"name": "Silo Éditorial", "value": geo, "inline": true},
		},
		"footer":    map[string]any{"text": footerText},
		"timestamp": nowISO(),
	}
	body, _ := json.Marshal(map[string]any{"embeds": []map[string]any{embed}})

	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("[Node 6: Phase B] ❌ [DISCORD] %v", err)
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.HTTP().Do(req)
	if err != nil {
		log.Printf("[Node 6: Phase B] ❌ [DISCORD] %v", err)
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[Node 6: Phase B] ✅ [DISCORD] Message expédié avec succès pour le topic %s", topic.ID)
		return true
	}
	log.Printf("[Node 6: Phase B] ❌ [DISCORD] Erreur HTTP %d", resp.StatusCode)
	return false
}

// dispatchPayload injects the article into the revelations collection of the
// public site (tags ensured first).
func dispatchPayload(client *payload.Client, resolver *config.Resolver, topic *payload.Signal, draft struct {
	Headline string `json:"headline"`
	Body     string `json:"body"`
}) bool {
	geo := topic.Geo
	if geo == "" {
		geo = "FRANCE"
	}
	taxonomy := topic.Taxonomy
	if taxonomy == "" {
		taxonomy = "INFO"
	}

	// La collection revelations ne connaît que Public / Confidentiel
	// (classification de sécurité) : une alerte URGENT/FLASH est marquée
	// Confidentiel, sinon Public.
	niveauAlerte := "Public"
	if strings.Contains(taxonomy, "URGENT") || strings.Contains(taxonomy, "FLASH") {
		niveauAlerte = "Confidentiel"
	}
	zoneGeo := "international"
	if strings.EqualFold(geo, "france") {
		zoneGeo = "france"
	}

	// Tags : recherche puis création si absents.
	var tagIDs []any
	var tagNames []string
	if len(topic.Tags) > 0 {
		_ = json.Unmarshal(topic.Tags, &tagNames)
	}
	for _, tagName := range tagNames {
		cleanName := strings.TrimSpace(tagName)
		if cleanName == "" {
			continue
		}
		id, err := client.FindTag(cleanName)
		if err != nil {
			log.Printf("[Node 6: Phase B] ⚠️ [PAYLOAD] recherche tag %q : %v", cleanName, err)
			continue
		}
		if id == "" {
			created, err := client.CreateTag(cleanName)
			if err != nil {
				log.Printf("[Node 6: Phase B] ⚠️ [PAYLOAD] création tag %q : %v", cleanName, err)
				continue
			}
			id = created
		}
		// Payload serial ids must be sent as numbers in relationship fields.
		tagIDs = append(tagIDs, id.Number())
	}

	revelation := map[string]any{
		"titre":          draft.Headline,
		"_status":        "published",
		"contenu_rapide": lexicalParagraph(draft.Body),
		"niveau_alerte":  niveauAlerte,
		"zone_geo":       zoneGeo,
	}
	if len(tagIDs) > 0 {
		revelation["tags"] = tagIDs
	}

	if err := client.CreateRevelation(revelation); err != nil {
		log.Printf("[Node 6: Phase B] ❌ [PAYLOAD] Échec d'injection HTTP : %v", err)
		return false
	}
	log.Printf("[Node 6: Phase B] ✅ [PAYLOAD] Révélation injectée dans Payload (Topic: %s)", topic.ID)
	return true
}

func boolParam(resolver *config.Resolver, nodeType, key string, def bool) bool {
	v := resolver.GetEffectiveParam(nodeType, key, def)
	if b, ok := v.(bool); ok {
		return b
	}
	if s, ok := v.(string); ok {
		if parsed, err := strconv.ParseBool(s); err == nil {
			return parsed
		}
	}
	return def
}

func intParam(resolver *config.Resolver, nodeType, key string, def int) int {
	v := resolver.GetEffectiveParam(nodeType, key, float64(def))
	if f, ok := v.(float64); ok {
		return int(f)
	}
	if s, ok := v.(string); ok {
		if parsed, err := strconv.Atoi(s); err == nil {
			return parsed
		}
	}
	return def
}

func strParam(resolver *config.Resolver, nodeType, key, def string) string {
	v := resolver.GetEffectiveParam(nodeType, key, def)
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}

// lexicalParagraph wraps plain text into the Lexical JSON shape Payload's
// richText fields expect (mirrors payload/seed-dev.ts lexP).
func lexicalParagraph(text string) map[string]any {
	return map[string]any{
		"root": map[string]any{
			"type":      "root",
			"version":   1,
			"format":    "",
			"indent":    0,
			"direction": "ltr",
			"children": []any{
				map[string]any{
					"type":      "paragraph",
					"version":   1,
					"format":    "",
					"indent":    0,
					"direction": "ltr",
					"children": []any{
						map[string]any{
							"type":    "text",
							"version": 1,
							"text":    text,
							"detail":  0,
							"format":  0,
							"mode":    "normal",
							"style":   "",
						},
					},
				},
			},
		},
	}
}

func hexToDecimal(hex string) int {
	clean := strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseUint(clean, 16, 32)
	if err != nil {
		return 0
	}
	return int(v)
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}
