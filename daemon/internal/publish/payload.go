package publish

import (
	"fmt"
	"log"
	"strings"

	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

// PayloadConfig configures the Payload CMS channel (revelations injection).
type PayloadConfig struct {
	Client *payload.Client
}

type payloadChannel struct {
	client *payload.Client
}

// NewPayload creates the Payload channel. It injects each message as a
// revelation of the public site, ensuring its tags exist first.
func NewPayload(cfg PayloadConfig) Channel {
	return &payloadChannel{client: cfg.Client}
}

func (c *payloadChannel) Name() string { return "PAYLOAD" }

func (c *payloadChannel) Publish(msg Message) error {
	if c.client == nil {
		return fmt.Errorf("[PAYLOAD] client Payload absent")
	}
	if msg.Headline == "" {
		return fmt.Errorf("[PAYLOAD] révélation sans titre, ignorée")
	}

	geo := msg.Geo
	if geo == "" {
		geo = "FRANCE"
	}
	taxonomy := msg.Taxonomy
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
	for _, tagName := range msg.Tags {
		cleanName := strings.TrimSpace(tagName)
		if cleanName == "" {
			continue
		}
		id, err := c.client.FindTag(cleanName)
		if err != nil {
			log.Printf("[PAYLOAD] ⚠️ recherche tag %q : %v", cleanName, err)
			continue
		}
		if id == "" {
			created, err := c.client.CreateTag(cleanName)
			if err != nil {
				log.Printf("[PAYLOAD] ⚠️ création tag %q : %v", cleanName, err)
				continue
			}
			id = created
		}
		// Payload serial ids must be sent as numbers in relationship fields.
		tagIDs = append(tagIDs, id.Number())
	}

	revelation := map[string]any{
		"titre":          msg.Headline,
		"_status":        "published",
		"contenu_rapide": lexicalParagraph(msg.Body),
		"niveau_alerte":  niveauAlerte,
		"zone_geo":       zoneGeo,
	}
	if len(tagIDs) > 0 {
		revelation["tags"] = tagIDs
	}
	// Lien retour vers le signal source : la révélation est une publication
	// dérivée du pipeline, on garde la trace dans Payload.
	if msg.SignalID != "" {
		revelation["source_signal"] = msg.SignalID
	}

	revelationID, err := c.client.CreateRevelation(revelation)
	if err != nil {
		return fmt.Errorf("[PAYLOAD] échec d'injection HTTP : %w", err)
	}

	// Relation inverse sur le signal (signal → revelation) pour que le cockpit
	// affiche la révélation produite depuis chaque signal publié.
	if msg.SignalID != "" && revelationID != "" {
		if err := c.client.UpdateSignal(payload.ID(msg.SignalID), map[string]any{"revelation": revelationID}); err != nil {
			log.Printf("[PAYLOAD] ⚠️ lien signal→revelation %s : %v", msg.SignalID, err)
		}
	}
	return nil
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
