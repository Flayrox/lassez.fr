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
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
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

// Number returns the id as a JSON-safe value: the raw number for numeric
// Payload ids (serial), the string otherwise. Required because Payload
// rejects string ids for numeric relationship columns.
func (id ID) Number() any {
	n, err := strconv.ParseInt(string(id), 10, 64)
	if err != nil {
		return string(id)
	}
	return n
}

// Signal mirrors a document of the Payload "signals" collection. RawData
// keeps the raw JSON so nodes can extract fields like clusterTitle.
type Signal struct {
	ID         ID              `json:"id"`
	RawData    json.RawMessage `json:"raw_data"`
	FinalDraft json.RawMessage `json:"final_draft"`
	Tags       json.RawMessage `json:"tags"`
	Status     string          `json:"status"`
	Taxonomy   string          `json:"taxonomy"`
	Geo        string          `json:"geo"`
	ImageURL   string          `json:"image_url"`
}

// TaxonomyTemplate mirrors a document of the "taxonomy-templates"
// collection, with the fields the pipeline needs.
type TaxonomyTemplate struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	PromptText  string `json:"format_instructions"`
	Active      bool   `json:"active"`
	SortOrder   int    `json:"sort_order"`
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

// HTTP exposes the underlying http.Client (shared timeouts) for outbound
// calls that are not Payload API calls, e.g. webhook pushes.
func (c *Client) HTTP() *http.Client { return c.http }

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

// EnsureSettings creates the radar-settings global if it does not exist yet.
func (c *Client) EnsureSettings() error {
	current, err := c.GetSettings()
	if err != nil {
		return err
	}
	if current != nil {
		return nil
	}
	_, err = c.request(http.MethodPost, "/globals/radar-settings", map[string]any{}, true)
	return err
}

// UpdateSettings upserts the radar-settings global. Payload updates globals
// with POST (upsert), not PATCH: a PATCH returns 404 "Route not found".
func (c *Client) UpdateSettings(data map[string]any) error {
	_, err := c.request(http.MethodPost, "/globals/radar-settings", data, true)
	return err
}

// AppendLog writes one entry to the Payload logs collection. It never fails
// the caller: logs are best-effort (the heartbeat of the admin dashboard).
func (c *Client) AppendLog(level, nodeID, message string) {
	_, err := c.request(http.MethodPost, "/logs", map[string]any{
		"level":     level,
		"node_id":   nodeID,
		"message":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}, true)
	if err != nil {
		log.Printf("[payload] appendLog échoué: %v", err)
	}
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

// GetTaxonomyTemplates returns the taxonomy templates, optionally only the
// active ones, ordered by sort_order.
func (c *Client) GetTaxonomyTemplates(activeOnly bool) ([]TaxonomyTemplate, error) {
	where := ""
	if activeOnly {
		where = "?where[active][equals]=true"
	}
	data, err := c.request(http.MethodGet, "/taxonomy-templates"+where+"&limit=500&depth=0&sort=sort_order", nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []TaxonomyTemplate `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode taxonomy-templates: %w", err)
	}
	return out.Docs, nil
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

// ============================================================
// PUBLICATIONS (missions de diffusion)
// ============================================================

// Publication mirrors a document of the Payload "publications" collection.
// Signal holds the raw JSON of the relationship: a plain id when fetched
// with depth=0, or the full signal object with depth>=1.
type Publication struct {
	ID          ID              `json:"id"`
	Signal      json.RawMessage `json:"signal"`
	Platform    string          `json:"platform"`
	Status      string          `json:"status"`
	ScheduledAt time.Time       `json:"scheduled_at"`
	PublishedAt *time.Time      `json:"published_at"`
}

// TopicID returns the related signal id whether the relationship was
// serialized as a string or an object.
func (p *Publication) TopicID() (ID, bool) {
	if len(p.Signal) == 0 {
		return "", false
	}
	var s string
	if err := json.Unmarshal(p.Signal, &s); err == nil {
		return ID(s), true
	}
	var obj struct {
		ID ID `json:"id"`
	}
	if err := json.Unmarshal(p.Signal, &obj); err == nil && obj.ID != "" {
		return obj.ID, true
	}
	return "", false
}

// Topic returns the embedded signal when the publication was fetched with
// depth >= 1.
func (p *Publication) Topic() (*Signal, bool) {
	var sig Signal
	if err := json.Unmarshal(p.Signal, &sig); err == nil && sig.ID != "" {
		return &sig, true
	}
	return nil, false
}

// GetPendingSignalsWithoutPublications returns PENDING signals that have no
// publication yet, mirroring the TS client: fetch pending signals, then
// exclude those referenced by at least one publication.
func (c *Client) GetPendingSignalsWithoutPublications() ([]Signal, error) {
	pending, err := c.GetSignalsByStatus("PENDING")
	if err != nil {
		return nil, err
	}
	if len(pending) == 0 {
		return nil, nil
	}

	ids := make([]string, 0, len(pending))
	for _, s := range pending {
		ids = append(ids, string(s.ID))
	}
	data, err := c.request(http.MethodGet, "/publications?where[signal][in]="+url.QueryEscape(strings.Join(ids, ","))+"&limit=500&depth=0", nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []struct {
			Signal json.RawMessage `json:"signal"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode publications: %w", err)
	}

	withPubs := make(map[string]bool, len(out.Docs))
	for _, d := range out.Docs {
		if id, ok := relationshipID(d.Signal); ok {
			withPubs[id] = true
		}
	}

	result := pending[:0]
	for _, s := range pending {
		if !withPubs[string(s.ID)] {
			result = append(result, s)
		}
	}
	return result, nil
}

// GetSignal returns a single signal by id, or (nil, nil) when not found.
func (c *Client) GetSignal(id ID) (*Signal, error) {
	data, err := c.request(http.MethodGet, "/signals/"+url.PathEscape(string(id))+"?depth=0", nil, true)
	if err != nil {
		if strings.Contains(err.Error(), "404") {
			return nil, nil
		}
		return nil, err
	}
	var out struct {
		Doc Signal `json:"doc"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode signal: %w", err)
	}
	return &out.Doc, nil
}

// UpdateManySignals patches several signals with the same data.
func (c *Client) UpdateManySignals(ids []ID, data map[string]any) error {
	for _, id := range ids {
		if err := c.UpdateSignal(id, data); err != nil {
			return err
		}
	}
	return nil
}

// GetLastScheduledPublication returns the most recent publication for a
// platform, used to space out scheduled missions.
func (c *Client) GetLastScheduledPublication(platform string) (*Publication, error) {
	data, err := c.request(http.MethodGet, "/publications?where[platform][equals]="+url.QueryEscape(platform)+"&limit=1&sort=-scheduled_at&depth=0", nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []Publication `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode publications: %w", err)
	}
	if len(out.Docs) == 0 {
		return nil, nil
	}
	return &out.Docs[0], nil
}

// PublicationInput is a mission to schedule (Phase A of the publisher).
type PublicationInput struct {
	TopicID     ID
	Platform    string
	Status      string
	ScheduledAt time.Time
}

// CreatePublications creates the scheduled missions (one per signal x
// platform) in the publications collection.
func (c *Client) CreatePublications(rows []PublicationInput) error {
	for _, row := range rows {
		_, err := c.request(http.MethodPost, "/publications", map[string]any{
			// Payload serial IDs must be sent as numbers, not strings.
			"signal":       row.TopicID.Number(),
			"platform":     row.Platform,
			"status":       row.Status,
			"scheduled_at": row.ScheduledAt.UTC().Format(time.RFC3339),
		}, true)
		if err != nil {
			// Logged and skipped: one failed mission must not block the batch.
			log.Printf("[payload] create publication %s/%s: %v", row.Platform, row.TopicID, err)
		}
	}
	return nil
}

// GetDuePublications returns PENDING publications whose scheduled_at has
// passed, with the embedded signal (depth=1), oldest first.
func (c *Client) GetDuePublications(limit int) ([]Publication, error) {
	now := url.QueryEscape(time.Now().UTC().Format(time.RFC3339))
	data, err := c.request(http.MethodGet, fmt.Sprintf("/publications?where[status][equals]=PENDING&where[scheduled_at][less_than_equal]=%s&limit=%d&depth=1&sort=scheduled_at", now, limit), nil, true)
	if err != nil {
		return nil, err
	}
	var out struct {
		Docs []Publication `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("decode publications: %w", err)
	}
	return out.Docs, nil
}

// UpdatePublication patches a publication, mapping the camelCase fields the
// nodes use to the collection snake_case columns.
func (c *Client) UpdatePublication(id ID, data map[string]any) error {
	out := make(map[string]any, len(data))
	for k, v := range data {
		switch k {
		case "scheduledAt":
			if t, ok := v.(time.Time); ok {
				out["scheduled_at"] = t.UTC().Format(time.RFC3339)
			}
		case "publishedAt":
			if t, ok := v.(time.Time); ok {
				out["published_at"] = t.UTC().Format(time.RFC3339)
			}
		default:
			out[k] = v
		}
	}
	_, err := c.request(http.MethodPatch, "/publications/"+url.PathEscape(string(id)), out, true)
	return err
}

// CountPendingPublications counts the PENDING missions left for a signal.
func (c *Client) CountPendingPublications(topicID ID) (int, error) {
	data, err := c.request(http.MethodGet, "/publications?where[signal][equals]="+url.PathEscape(string(topicID))+"&where[status][equals]=PENDING&limit=1", nil, true)
	if err != nil {
		return 0, err
	}
	var out struct {
		TotalDocs int `json:"totalDocs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return 0, fmt.Errorf("decode publications count: %w", err)
	}
	return out.TotalDocs, nil
}

// ============================================================
// TAGS & RÉVÉLATIONS (injection site public)
// ============================================================

// FindTag returns the id of the tag with the given name, or "" if absent.
func (c *Client) FindTag(name string) (ID, error) {
	data, err := c.request(http.MethodGet, "/tags?where[name][equals]="+url.QueryEscape(name)+"&limit=1&depth=0", nil, true)
	if err != nil {
		return "", err
	}
	var out struct {
		Docs []struct {
			ID ID `json:"id"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return "", fmt.Errorf("decode tags: %w", err)
	}
	if len(out.Docs) == 0 {
		return "", nil
	}
	return out.Docs[0].ID, nil
}

// CreateTag creates a tag (name; the slug is generated by Payload's
// ensureTagSlug hook) and returns its id.
func (c *Client) CreateTag(name string) (ID, error) {
	data, err := c.request(http.MethodPost, "/tags", map[string]string{"name": name}, true)
	if err != nil {
		return "", err
	}
	var out struct {
		Doc struct {
			ID ID `json:"id"`
		} `json:"doc"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return "", fmt.Errorf("decode tag: %w", err)
	}
	return out.Doc.ID, nil
}

// CreateRevelation posts an investigation article to the revelations
// collection, which feeds the public site.
func (c *Client) CreateRevelation(data map[string]any) error {
	_, err := c.request(http.MethodPost, "/revelations", data, true)
	return err
}

func relationshipID(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s, true
	}
	var obj struct {
		ID ID `json:"id"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && obj.ID != "" {
		return string(obj.ID), true
	}
	return "", false
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
