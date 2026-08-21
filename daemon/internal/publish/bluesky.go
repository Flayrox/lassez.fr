package publish

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	blueskyPublicAPI = "https://bsky.social"
	plcDirectoryURL  = "https://plc.directory"
)

// BlueskyConfig configures the Bluesky channel (ATProto).
type BlueskyConfig struct {
	Identifier       string // handle, e.g. lassez.bsky.social (BLUESKY_IDENTIFIER)
	AppPassword      string // app password, not the account password (BLUESKY_APP_PASSWORD)
	MaxLength        int    // 300 by default
	IncludeSourceURL bool
	HTTP             *http.Client
}

type blueskyChannel struct {
	cfg BlueskyConfig
}

// NewBluesky creates the Bluesky channel.
func NewBluesky(cfg BlueskyConfig) Channel {
	if cfg.MaxLength <= 0 {
		cfg.MaxLength = 300
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	return &blueskyChannel{cfg: cfg}
}

func (c *blueskyChannel) Name() string { return "BLUESKY" }

func (c *blueskyChannel) Publish(msg Message) error {
	identifier := credential(c.cfg.Identifier, "BLUESKY_IDENTIFIER")
	appPassword := credential(c.cfg.AppPassword, "BLUESKY_APP_PASSWORD")
	if identifier == "" || appPassword == "" {
		return fmt.Errorf("[BLUESKY] identifier/mot de passe app manquants (BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)")
	}

	// 1. Handle → DID (via the public API), then PDS from the DID document.
	did, err := c.resolveHandle(identifier)
	if err != nil {
		return err
	}
	pdsURL, err := c.pdsFor(did)
	if err != nil {
		return err
	}

	// 2. Create an app session to get an access JWT.
	accessJWT, err := c.createSession(pdsURL, identifier, appPassword)
	if err != nil {
		return err
	}

	// 3. Post the record.
	text := BuildText(msg, c.cfg.MaxLength, c.cfg.IncludeSourceURL)
	record := map[string]any{
		"repo":       did,
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"text":      text,
			"createdAt": time.Now().UTC().Format(time.RFC3339),
		},
	}
	body, _ := json.Marshal(record)

	req, err := http.NewRequest(http.MethodPost, pdsURL+"/xrpc/com.atproto.repo.createRecord", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("[BLUESKY] %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessJWT)

	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("[BLUESKY] %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return fmt.Errorf("[BLUESKY] erreur HTTP %d: %s", resp.StatusCode, truncateStr(string(data), 300))
	}
	return nil
}

func (c *blueskyChannel) resolveHandle(handle string) (string, error) {
	endpoint := blueskyPublicAPI + "/xrpc/com.atproto.identity.resolveHandle?handle=" + url.QueryEscape(handle)
	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return "", fmt.Errorf("[BLUESKY] resolveHandle: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("[BLUESKY] resolveHandle HTTP %d pour %s", resp.StatusCode, handle)
	}
	var out struct {
		DID string `json:"did"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("[BLUESKY] decode resolveHandle: %w", err)
	}
	if out.DID == "" {
		return "", fmt.Errorf("[BLUESKY] handle %s introuvable", handle)
	}
	return out.DID, nil
}

// pdsFor finds the atproto PDS endpoint from the DID document hosted on the
// PLC directory, falling back to the public API.
func (c *blueskyChannel) pdsFor(did string) (string, error) {
	req, _ := http.NewRequest(http.MethodGet, plcDirectoryURL+"/"+url.PathEscape(did), nil)
	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return "", fmt.Errorf("[BLUESKY] DID document: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return blueskyPublicAPI, nil
	}
	var doc struct {
		Service []struct {
			ID              string `json:"id"`
			ServiceEndpoint string `json:"serviceEndpoint"`
		} `json:"service"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return blueskyPublicAPI, nil
	}
	for _, s := range doc.Service {
		if s.ID == "#atproto_pds" && strings.HasPrefix(s.ServiceEndpoint, "https://") {
			return strings.TrimRight(s.ServiceEndpoint, "/"), nil
		}
	}
	return blueskyPublicAPI, nil
}

func (c *blueskyChannel) createSession(pdsURL, identifier, appPassword string) (string, error) {
	body, _ := json.Marshal(map[string]string{"identifier": identifier, "password": appPassword})
	req, err := http.NewRequest(http.MethodPost, pdsURL+"/xrpc/com.atproto.server.createSession", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("[BLUESKY] %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return "", fmt.Errorf("[BLUESKY] createSession: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return "", fmt.Errorf("[BLUESKY] createSession HTTP %d: %s", resp.StatusCode, truncateStr(string(data), 300))
	}
	var out struct {
		AccessJWT string `json:"accessJwt"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("[BLUESKY] decode createSession: %w", err)
	}
	if out.AccessJWT == "" {
		return "", fmt.Errorf("[BLUESKY] createSession sans JWT (identifiants invalides?)")
	}
	return out.AccessJWT, nil
}
