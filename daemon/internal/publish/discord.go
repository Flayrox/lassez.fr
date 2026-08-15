package publish

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// DiscordConfig configures the Discord webhook channel.
type DiscordConfig struct {
	WebhookURL string // webhook URL; may also come from DISCORD_WEBHOOK_URL
	ColorHex   string // embed color as #RRGGBB (default #DC2626)
	Footer     string // embed footer text
	HTTP       *http.Client
}

type discordChannel struct {
	cfg DiscordConfig
}

// NewDiscord creates the Discord channel. An empty WebhookURL falls back to
// the DISCORD_WEBHOOK_URL environment variable.
func NewDiscord(cfg DiscordConfig) Channel {
	if cfg.ColorHex == "" {
		cfg.ColorHex = "#DC2626"
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 20 * time.Second}
	}
	return &discordChannel{cfg: cfg}
}

func (c *discordChannel) Name() string { return "DISCORD" }

func (c *discordChannel) Publish(msg Message) error {
	webhookURL := c.cfg.WebhookURL
	if webhookURL == "" {
		webhookURL = envOr("DISCORD_WEBHOOK_URL", "")
	}
	if webhookURL == "" {
		return fmt.Errorf("[DISCORD] DISCORD_WEBHOOK_URL absente du fichier .env")
	}

	taxonomy := msg.Taxonomy
	if taxonomy == "" {
		taxonomy = "INFO"
	}
	geo := msg.Geo
	if geo == "" {
		geo = "Global"
	}
	headline := msg.Headline
	if headline == "" {
		headline = taxonomy
	}
	// Discord embeds cap the description at 4096 chars.
	body := Truncate(msg.Body, 4000)

	embed := map[string]any{
		"title":       headline,
		"description": body,
		"color":       hexToDecimal(c.cfg.ColorHex),
		"fields": []map[string]any{
			{"name": "Niveau d'Alerte", "value": taxonomy, "inline": true},
			{"name": "Silo Éditorial", "value": geo, "inline": true},
		},
		"footer":    map[string]any{"text": c.cfg.Footer},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	payload, _ := json.Marshal(map[string]any{"embeds": []map[string]any{embed}})

	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("[DISCORD] %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("[DISCORD] %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("[DISCORD] erreur HTTP %d", resp.StatusCode)
	}
	return nil
}

// hexToDecimal converts a #RRGGBB color to the decimal Discord expects.
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
