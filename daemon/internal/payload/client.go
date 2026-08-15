// Package payload provides a minimal Payload REST client used by the
// daemon. It mirrors the behaviour of radar_lassez/lib/payload-client.ts:
// JWT login against the authors collection, then CRUD on the radar
// collections (sources, seen-urls, signals) and the radar-settings global.
package payload

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// Client is a thread-safe Payload REST client.
type Client struct {
	baseURL        string
	http           *http.Client
	mu             sync.Mutex
	token          string
	tokenExpiresAt time.Time
} // ID accepts both string and numeric Payload document ids.
type ID string

// UnmarshalJSON handles Payload ids that may be numbers or strings.
func (id *ID) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*id = ID(s)
		return nil
	}
	var n json.Number
	if err := json.Unmarshal(data, &n); err == nil {
		*id = ID(n.String())
		return nil
	}
	return fmt.Errorf("unsupported id: %s", data)
}

// Signal mirrors a document of the Payload "signals" collection. RawData
// keeps the raw JSON so nodes can extract fields like clusterTitle.
type Signal struct {
	ID      ID              `json:"id"`
	RawData json.RawMessage `json:"raw_data"`
	Status  string          `json:"status"`
}

// Source mirrors a document of the Payload "sources" collection.
type Source struct {
	ID                ID     `json:"id"`
	URL               string `json:"url"`
	Type              string `json:"type"`
	SourceName        string `json:"source_name"`
	SourceBias        string `json:"source_bias"`
	TrustScore        int    `json:"trust_score"`
	AllowSourceImages bool   `json:"allow_source_images"`
	Active            bool   `json:"active"`
	HealthStatus      string `json:"health_status"`
}

// DefaultBaseURL resolves the Payload API base from the environment using
// the same cascade as the TS client: PAYLOAD_API_URL > PAYLOAD_URL >
// PAYLOAD_SERVER_URL, with a /api/payload suffix appended when missing.
func DefaultBaseURL() string {
	base := firstEnv("PAYLOAD_API_URL", "PAYLOAD_URL", "PAYLOAD_SERVER_URL")
	if base == "" {
		base = "http://localhost:5173"
	}
	base = strings.TrimRight(base, "/")
	if !strings.Contains(base, "/api/payload") {
		base += "/api/payload"
	}
	return base
}

// New creates a Client. An empty baseURL falls back to DefaultBaseURL.
func New(baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL()
	}
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) BaseURL() string { return c.baseURL }

// login authenticates against the authors collection and caches the JWT.
func (c *Client) login() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != "" && time.Now().Before(c.tokenExpiresAt) {
		return c.token, nil
	}

	email := firstEnv("PAYLOAD_ADMIN_EMAIL", "PAYLOAD_BOT_EMAIL")
	if email == "" {
		email = "bot@lassez.fr"
	}
	password := firstEnv("PAYLOAD_ADMIN_PASSWORD", "PAYLOAD_BOT_PASSWORD")

	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	resp, err := c.http.Post(c.baseURL+"/authors/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("payload login: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return "", fmt.Errorf("payload login failed (HTTP %d): %s", resp.StatusCode, data)
	}

	var out struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decode login: %w", err)
	}
	if out.Token == "" {
		return "", fmt.Errorf("payload login: no token received")
	}

	c.token = out.Token
	c.tokenExpiresAt = time.Now().Add(90 * time.Minute)
	return c.token, nil
}

// request performs an authenticated request. On a 401 it refreshes the
// token once and retries, mirroring the TS client.
func (c *Client) request(method, path string, body any, retry bool) ([]byte, error) {
	token, err := c.login()
	if err != nil {
		return nil, err
	}

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "JWT "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized && retry {
		c.mu.Lock()
		c.token = ""
		c.tokenExpiresAt = time.Time{}
		c.mu.Unlock()
		return c.request(method, path, body, false)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("payload %s %s (HTTP %d): %s", method, path, resp.StatusCode, truncate(string(data), 300))
	}
	return data, nil
}

// GetSettings reads the radar-settings global. It returns (nil, nil) when
// the global does not exist yet.
func (c *Client) GetSettings() (map[string]any, error) {
	data, err := c.request(http.MethodGet, "/globals/radar-settings", nil, true)
	if err != nil {
		if strings.Contains(err.Error(), "404") {
			return nil, nil
		}
		return nil, err
	}
	var settings map[string]any
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, fmt.Errorf("decode settings: %w", err)
	}
	return settings, nil
}

// GetActiveSources returns the active sources of the sources collection.
func (c *Client) GetActiveSources() ([]Source, error) {
	data, err := c.request(http.MethodGet, "/sources?where[active][equals]=true&limit=1000&depth=0", nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []Source `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode sources: %w", err)
	}
	return out.Docs, nil
}

// GetSeenURLs returns the list of URLs already observed by the deduplicator.
func (c *Client) GetSeenURLs() ([]string, error) {
	data, err := c.request(http.MethodGet, "/seen-urls?limit=0&depth=0&select[url]=true", nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []struct {
			URL string `json:"url"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode seen-urls: %w", err)
	}
	urls := make([]string, 0, len(out.Docs))
	for _, d := range out.Docs {
		urls = append(urls, d.URL)
	}
	return urls, nil
}

// AddSeenURLs registers new URLs, ignoring duplicate-key errors.
func (c *Client) AddSeenURLs(urls []string) error {
	for _, u := range urls {
		_, err := c.request(http.MethodPost, "/seen-urls", map[string]string{"url": u}, true)
		if err != nil {
			// Duplicates (unique url) are expected and ignored.
			continue
		}
	}
	return nil
}

// PurgeSeenURLs deletes seen-urls older than the given instant.
func (c *Client) PurgeSeenURLs(before time.Time) error {
	iso := url.QueryEscape(before.UTC().Format(time.RFC3339))
	_, err := c.request(http.MethodDelete, "/seen-urls?where[createdAt][less_than]="+iso, nil, true)
	return err
}

// GetSignalsSince returns signals created after the given instant.
func (c *Client) GetSignalsSince(after time.Time) ([]Signal, error) {
	iso := url.QueryEscape(after.UTC().Format(time.RFC3339))
	data, err := c.request(http.MethodGet, "/signals?where[createdAt][greater_than]="+iso+"&limit=1000&depth=0", nil, true)
	if err != nil {
		return nil, err
	}
	return decodeSignalDocs(data)
}

// GetSignalsByStatus returns signals with the given status, oldest first.
func (c *Client) GetSignalsByStatus(status string) ([]Signal, error) {
	data, err := c.request(http.MethodGet, "/signals?where[status][equals]="+url.QueryEscape(status)+"&limit=500&depth=0&sort=createdAt", nil, true)
	if err != nil {
		return nil, err
	}
	return decodeSignalDocs(data)
}

// UpdateSignal patches a signal, coercing JSON string fields to objects.
func (c *Client) UpdateSignal(id ID, data map[string]any) error {
	out := make(map[string]any, len(data))
	for k, v := range data {
		switch k {
		case "raw_data", "final_draft", "tags":
			out[k] = coerceJSON(v)
		default:
			out[k] = v
		}
	}
	_, err := c.request(http.MethodPatch, "/signals/"+url.PathEscape(string(id)), out, true)
	return err
}

func decodeSignalDocs(data []byte) ([]Signal, error) {
	var out struct {
		Docs []Signal `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode signals: %w", err)
	}
	return out.Docs, nil
}

// CreateSignals creates signals in Payload. JSON fields are sent as objects.
func (c *Client) CreateSignals(rows []map[string]any) error {
	for _, row := range rows {
		payload := normalizeSignalRow(row)
		_, err := c.request(http.MethodPost, "/signals", payload, true)
		if err != nil {
			return fmt.Errorf("create signal: %w", err)
		}
	}
	return nil
}

// normalizeSignalRow applies the same JSON-string coercion the TS client
// performs on raw_data / final_draft / tags, and derives source_title.
func normalizeSignalRow(row map[string]any) map[string]any {
	out := make(map[string]any, len(row)+1)
	for k, v := range row {
		switch k {
		case "raw_data", "final_draft", "tags":
			out[k] = coerceJSON(v)
		default:
			out[k] = v
		}
	}
	if title, _ := out["source_title"].(string); title == "" {
		out["source_title"] = extractTitle(out["raw_data"])
	}
	return out
}

func coerceJSON(v any) any {
	if s, ok := v.(string); ok {
		var parsed any
		if err := json.Unmarshal([]byte(s), &parsed); err == nil {
			return parsed
		}
		return s
	}
	return v
}

func extractTitle(v any) string {
	raw, ok := v.(map[string]any)
	if !ok {
		if s, ok := v.(string); ok {
			_ = json.Unmarshal([]byte(s), &raw)
		}
	}
	for _, key := range []string{"clusterTitle", "headline"} {
		if t, ok := raw[key].(string); ok && t != "" {
			return t
		}
	}
	return "Sujet sans titre"
}

func firstEnv(keys ...string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return ""
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
