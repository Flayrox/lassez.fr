package publish

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// MastodonConfig configures the Mastodon channel (api/v1/statuses).
type MastodonConfig struct {
	InstanceURL      string // e.g. https://mastodon.social (MASTODON_INSTANCE_URL)
	AccessToken      string // MASTODON_ACCESS_TOKEN
	MaxLength        int    // 500 by default (instance-dependent)
	IncludeSourceURL bool
	HTTP             *http.Client
}

type mastodonChannel struct {
	cfg MastodonConfig
}

// NewMastodon creates the Mastodon channel.
func NewMastodon(cfg MastodonConfig) Channel {
	if cfg.MaxLength <= 0 {
		cfg.MaxLength = 500
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	return &mastodonChannel{cfg: cfg}
}

func (c *mastodonChannel) Name() string { return "MASTODON" }

func (c *mastodonChannel) Publish(msg Message) error {
	instanceURL := credential(c.cfg.InstanceURL, "MASTODON_INSTANCE_URL")
	accessToken := credential(c.cfg.AccessToken, "MASTODON_ACCESS_TOKEN")
	if instanceURL == "" || accessToken == "" {
		return fmt.Errorf("[MASTODON] instance/token manquants (MASTODON_INSTANCE_URL, MASTODON_ACCESS_TOKEN)")
	}
	instanceURL = strings.TrimRight(instanceURL, "/")

	text := BuildText(msg, c.cfg.MaxLength, c.cfg.IncludeSourceURL)
	form := url.Values{"status": {text}}
	req, err := http.NewRequest(http.MethodPost, instanceURL+"/api/v1/statuses", strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("[MASTODON] %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("[MASTODON] %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return fmt.Errorf("[MASTODON] erreur HTTP %d: %s", resp.StatusCode, truncateStr(string(data), 300))
	}
	return nil
}
