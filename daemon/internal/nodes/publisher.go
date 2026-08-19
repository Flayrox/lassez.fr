package nodes

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
	"github.com/Flayrox/LASSEZ/daemon/internal/publish"
)

type publisherPlatform struct {
	Name string
	Mode string
}

// RunPublisher is Node 6 of the pipeline: the control tower. Phase A
// schedules publication missions for every enabled platform; Phase B
// dispatches the missions whose scheduled_at has passed through the modular
// publish registry (each platform is a Channel).
func RunPublisher(client *payload.Client, resolver *config.Resolver) error {
	log.Printf("\n[Node 6: Publisher] 🚀 Lancement de la Tour de Contrôle (Scheduling & Diffusion)")

	registry := buildRegistry(client, resolver)

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

		minDelay := intParam(resolver, "publisher", "minPublishDelay", 60)
		maxDelay := intParam(resolver, "publisher", "maxPublishDelay", 120)
		if maxDelay < minDelay {
			maxDelay = minDelay
		}

		platforms := []publisherPlatform{}
		for _, name := range registry.Names() {
			mode := "DIRECT"
			switch name {
			case "DISCORD":
				mode = strParam(resolver, "publisher", "discordPublishMode", "DIRECT")
			case "X":
				mode = strParam(resolver, "publisher", "xPublishMode", "SCHEDULED")
			case "BLUESKY":
				mode = strParam(resolver, "publisher", "blueskyPublishMode", "SCHEDULED")
			case "MASTODON":
				mode = strParam(resolver, "publisher", "mastodonPublishMode", "SCHEDULED")
			case "PAYLOAD":
				mode = strParam(resolver, "publisher", "payloadPublishMode", "DIRECT")
			}
			platforms = append(platforms, publisherPlatform{Name: name, Mode: mode})
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

	if !boolParam(resolver, "publisher", "enableAutoPublish", true) {
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
		if err := dispatchPublication(client, registry, pub); err != nil {
			log.Printf("[Node 6: Phase B] ❌ Erreur lors de la diffusion de la publication %s : %v", pub.ID, err)
		}
		// Pause anti-rate-limit entre les envois.
		time.Sleep(2 * time.Second)
	}
	return nil
}

// buildRegistry instantiates the enabled channels from radar-settings. This
// is the modular seam: every enabled platform becomes a Channel, and Phase A
// only schedules missions for registered platforms.
func buildRegistry(client *payload.Client, resolver *config.Resolver) *publish.Registry {
	registry := publish.NewRegistry()

	httpClient := &http.Client{Timeout: 30 * time.Second}

	if boolParam(resolver, "publisher", "enableDiscord", true) {
		registry.Add(publish.NewDiscord(publish.DiscordConfig{
			WebhookURL: strParam(resolver, "publisher", "discordWebhookUrl", ""),
			ColorHex:   strParam(resolver, "publisher", "discordEmbedColor", "#DC2626"),
			Footer:     strParam(resolver, "publisher", "discordFooterText", "Radar L'Assez • Investigation"),
			HTTP:       httpClient,
		}))
	}
	if boolParam(resolver, "publisher", "enableX", false) {
		registry.Add(publish.NewX(publish.XConfig{
			APIKey:           strParam(resolver, "publisher", "xApiKey", ""),
			APISecret:        strParam(resolver, "publisher", "xApiSecret", ""),
			AccessToken:      strParam(resolver, "publisher", "xAccessToken", ""),
			AccessSecret:     strParam(resolver, "publisher", "xAccessSecret", ""),
			MaxLength:        intParam(resolver, "publisher", "xMaxLength", 280),
			IncludeSourceURL: boolParam(resolver, "publisher", "includeSourceUrl", true),
			HTTP:             httpClient,
		}))
	}
	if boolParam(resolver, "publisher", "enableBluesky", false) {
		registry.Add(publish.NewBluesky(publish.BlueskyConfig{
			Identifier:       strParam(resolver, "publisher", "blueskyIdentifier", ""),
			AppPassword:      strParam(resolver, "publisher", "blueskyAppPassword", ""),
			MaxLength:        intParam(resolver, "publisher", "blueskyMaxLength", 300),
			IncludeSourceURL: boolParam(resolver, "publisher", "includeSourceUrl", true),
			HTTP:             httpClient,
		}))
	}
	if boolParam(resolver, "publisher", "enableMastodon", false) {
		registry.Add(publish.NewMastodon(publish.MastodonConfig{
			InstanceURL:      strParam(resolver, "publisher", "mastodonInstanceUrl", ""),
			AccessToken:      strParam(resolver, "publisher", "mastodonAccessToken", ""),
			MaxLength:        intParam(resolver, "publisher", "mastodonMaxLength", 500),
			IncludeSourceURL: boolParam(resolver, "publisher", "includeSourceUrl", true),
			HTTP:             httpClient,
		}))
	}
	if boolParam(resolver, "publisher", "enablePayloadCMS", true) {
		registry.Add(publish.NewPayload(publish.PayloadConfig{Client: client}))
	}

	return registry
}

// dispatchPublication sends one due publication to its platform through the
// registry and updates the mission + signal statuses.
func dispatchPublication(client *payload.Client, registry *publish.Registry, pub payload.Publication) error {
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

	channel, ok := registry.Get(pub.Platform)
	if !ok {
		log.Printf("[Node 6: Phase B] ⚠️ Plateforme %q non activée (ou inconnue).", pub.Platform)
		markFailed()
		return nil
	}

	msg := publish.Message{
		Headline: draft.Headline,
		Body:     draft.Body,
		Tags:     []string{},
		Geo:      topic.Geo,
		Taxonomy: topic.Taxonomy,
		ImageURL: topic.ImageURL,
		SignalID: string(topic.ID),
	}
	if len(topic.Tags) > 0 {
		_ = json.Unmarshal(topic.Tags, &msg.Tags)
	}
	var raw struct {
		Articles []struct {
			URL string `json:"url"`
		} `json:"articles"`
	}
	if len(topic.RawData) > 0 {
		_ = json.Unmarshal(topic.RawData, &raw)
	}
	if len(raw.Articles) > 0 {
		msg.URL = raw.Articles[0].URL
	}

	if err := channel.Publish(msg); err != nil {
		log.Printf("[Node 6: Phase B] ❌ %v", err)
		markFailed()
		return nil
	}

	now := time.Now()
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
