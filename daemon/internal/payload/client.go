// Package payload — COMPAT SHIP LOCAL.
//
// Anciennement un client REST vers Payload CMS ; depuis le pivot qoe.fi,
// ce fichier implémente exactement la même API Go mais tout est stocké
// localement :
//   - signaux, seen-urls et publications → SQLite (data/radar.db, tables daemon_*)
//   - settings → config/config.yaml aplati en map (clés historiques préservées)
//
// Les nœuds du pipeline ne changent pas : ils continuent d'appeler
// client.GetSignalsByStatus / UpdateSignal / CreateSignals / etc.
package payload

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Client struct {
	db       *sql.DB
	settings func() (map[string]any, error)
}

// ID — identifiant de signal/publication (entier sérialisé en chaîne).
type ID string

// Number convertit l'ID en entier si possible.
func (id ID) Number() int64 {
	n, _ := strconv.ParseInt(string(id), 10, 64)
	return n
}

// Signal — document du pipeline (miroir de l'ancienne collection Payload).
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

type TaxonomyTemplate struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	PromptText  string `json:"format_instructions"`
	Active      bool   `json:"active"`
	SortOrder   int    `json:"sort_order"`
}

type Source struct {
	ID                ID     `json:"id"`
	URL               string `json:"url"`
	Type              string `json:"type"`
	SourceName        string `json:"source_name"`
	SourceBias        string `json:"source_bias"`
	TrustScore        int    `json:"trust_score"`
	AllowSourceImages bool   `json:"allow_source_images"`
	Active            bool   `json:"active"`
}

type Publication struct {
	ID          ID              `json:"id"`
	Signal      json.RawMessage `json:"signal"`
	Platform    string          `json:"platform"`
	Status      string          `json:"status"`
	ScheduledAt time.Time       `json:"scheduled_at"`
	PublishedAt *time.Time      `json:"published_at"`
}

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

func (p *Publication) Topic() (*Signal, bool) {
	var sig Signal
	if err := json.Unmarshal(p.Signal, &sig); err == nil && sig.ID != "" {
		return &sig, true
	}
	return nil, false
}

type PublicationInput struct {
	TopicID     ID
	Platform    string
	Status      string
	ScheduledAt time.Time
}

// ── Construction ────────────────────────────────────────────────────────────

// NewLocal ouvre le SQLite local (tables daemon_*) et branche le provider
// de settings (config YAML aplatie). WAL activé : lectures du labo pendant
// que le daemon écrit.
func NewLocal(dbPath string, settingsProvider func() (map[string]any, error)) (*Client, error) {
	db, err := sql.Open("sqlite", dbPath+"?mode=rw")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA busy_timeout=5000",
	} {
		if _, err := db.Exec(pragma); err != nil {
			log.Printf("[payload-local] pragma %q : %v", pragma, err)
		}
	}
	c := &Client{db: db, settings: settingsProvider}
	if err := c.migrate(); err != nil {
		return nil, fmt.Errorf("migration daemon_* : %w", err)
	}
	return c, nil
}

func (c *Client) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS daemon_signals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			raw_data TEXT,
			final_draft TEXT,
			tags TEXT DEFAULT '[]',
			status TEXT NOT NULL DEFAULT 'INGESTED',
			taxonomy TEXT,
			geo TEXT,
			image_url TEXT,
			published_at TEXT,
			created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dsignals_status ON daemon_signals(status)`,
		`CREATE TABLE IF NOT EXISTS daemon_seen_urls (
			url TEXT PRIMARY KEY,
			created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
		)`,
		`CREATE TABLE IF NOT EXISTS daemon_publications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			topic_id INTEGER NOT NULL,
			platform TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING',
			scheduled_at TEXT NOT NULL,
			published_at TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dpubs_due ON daemon_publications(status, scheduled_at)`,
		`CREATE TABLE IF NOT EXISTS daemon_source_health (
			url TEXT PRIMARY KEY,
			type TEXT NOT NULL DEFAULT 'RSS',
			source_name TEXT,
			consecutive_failures INTEGER NOT NULL DEFAULT 0,
			last_status TEXT,
			last_error TEXT,
			status TEXT NOT NULL DEFAULT 'HEALTHY',
			last_ok_at TEXT,
			last_check_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
			updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
		)`,
	}
	for _, s := range stmts {
		if _, err := c.db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) Close() error { return c.db.Close() }

// BaseURL — identité locale (les nœuds l'affichent au démarrage).
func (c *Client) BaseURL() string { return "local://sqlite" }

// ── Settings (YAML) ─────────────────────────────────────────────────────────

func (c *Client) GetSettings() (map[string]any, error) {
	if c.settings == nil {
		return map[string]any{}, nil
	}
	return c.settings()
}

func (c *Client) EnsureSettings() error { return nil } // plus de global à créer

func (c *Client) UpdateSettings(map[string]any) error { return nil } // heartbeat = no-op

// AppendLog — le miroir Payload est débranché ; le fichier daemon.log suffit.
func (c *Client) AppendLog(string, string, string) {}

func (c *Client) PruneLogs(time.Time) error { return nil }

// ── Sources (depuis le YAML) ────────────────────────────────────────────────

func (c *Client) GetActiveSources() ([]Source, error) {
	settings, err := c.GetSettings()
	if err != nil {
		return nil, err
	}
	out := []Source{}
	appendURLs := func(raw any, typ string) {
		switch v := raw.(type) {
		case []string:
			for _, url := range v {
				out = append(out, makeSource(len(out)+1, url, typ))
			}
		case []any:
			for _, item := range v {
				if u, ok := item.(string); ok {
					out = append(out, makeSource(len(out)+1, u, typ))
				}
			}
		}
	}
	if ing, ok := settings["ingestion"].(map[string]any); ok {
		if src, ok := ing["sources"].(map[string]any); ok {
			appendURLs(src["rss"], "RSS")
			appendURLs(src["googleNews"], "GOOGLE_NEWS")
			appendURLs(src["telegram"], "TELEGRAM")
		}
	}
	return out, nil
}

func makeSource(n int, url, typ string) Source {
	host := url
	if u, err := parseHost(url); err == nil {
		host = u
	}
	return Source{
		ID:                ID(fmt.Sprintf("%d", n)),
		URL:               url,
		Type:              typ,
		SourceName:        host,
		SourceBias:        "Indépendant",
		TrustScore:        trustFromURL(url),
		AllowSourceImages: trustFromURL(url) >= 7,
		Active:            true,
	}
}

func parseHost(raw string) (string, error) {
	u := strings.TrimPrefix(strings.TrimPrefix(raw, "https://"), "http://")
	i := strings.IndexAny(u, "/?")
	if i >= 0 {
		u = u[:i]
	}
	if u == "" {
		return "", fmt.Errorf("host vide")
	}
	return strings.TrimPrefix(u, "www."), nil
}

// trustFromURL reproduit la source_trust_map du VPS (🟢9 · 🟡7 · 🔴3).
func trustFromURL(url string) int {
	h := strings.ToLower(url)
	high := []string{"mediapart", "humanite", "blast", "reporterre", "basta", "politis", "arretsurimages", "972mag", "amnesty", "hrw", "btselem", "fidh", "phr", "palestinechronicle", "wafa", "palinfo", "maannews"}
	medium := []string{"france24", "rfi", "francetvinfo", "lemonde", "leparisien", "lacroix", "la-croix", "rtl", "nouvelobs", "globalvoices", "thenewhumanitarian", "theconversation", "chathamhouse", "haaretz", "un.org"}
	low := []string{"lefigaro", "figaro", "cnews", "bfmtv", "freedomhouse"}
	for _, k := range high {
		if strings.Contains(h, k) {
			return 9
		}
	}
	for _, k := range medium {
		if strings.Contains(h, k) {
			return 7
		}
	}
	for _, k := range low {
		if strings.Contains(h, k) {
			return 3
		}
	}
	return 5
}

// ── Santé des sources (radar_source_health de l'ancien radar) ────────────────

type SourceHealth struct {
	URL                string `json:"url"`
	Type               string `json:"type"`
	SourceName         string `json:"source_name"`
	ConsecutiveFailures int    `json:"consecutive_failures"`
	LastStatus         string `json:"last_status"`
	LastError          string `json:"last_error"`
	Status             string `json:"status"` // HEALTHY / DEGRADED / DISABLED
	LastOKAt           string `json:"last_ok_at"`
	LastCheckAt        string `json:"last_check_at"`
}

// RecordSourceHealth — mis à jour par le nœud ingestion à chaque aspiration.
// Un succès remet les échecs à zéro ; un échec les incrémente. Au-delà du
// seuil (5 échecs consécutifs) la source passe DISABLED (quarantaine), sinon
// DEGRADED.
func (c *Client) RecordSourceHealth(url, typ, name string, ok bool, statusText, errMsg string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if ok {
		_, err := c.db.Exec(`
			INSERT INTO daemon_source_health(url, type, source_name, consecutive_failures, last_status, last_error, status, last_ok_at, last_check_at, updated_at)
			VALUES(?,?,?,0,?,NULL,'HEALTHY',?,?,?)
			ON CONFLICT(url) DO UPDATE SET
				type=excluded.type, source_name=excluded.source_name,
				consecutive_failures=0, last_status=excluded.last_status, last_error=NULL,
				status='HEALTHY', last_ok_at=excluded.last_ok_at, last_check_at=excluded.last_check_at,
				updated_at=excluded.updated_at`,
			url, typ, name, statusText, now, now, now)
		return err
	}
	_, err := c.db.Exec(`
		INSERT INTO daemon_source_health(url, type, source_name, consecutive_failures, last_status, last_error, status, last_check_at, updated_at)
		VALUES(?,?,?,1,?,?,'DEGRADED',?,?)
		ON CONFLICT(url) DO UPDATE SET
			type=excluded.type, source_name=excluded.source_name,
			consecutive_failures=daemon_source_health.consecutive_failures+1,
			last_status=excluded.last_status, last_error=excluded.last_error,
			status=CASE WHEN daemon_source_health.consecutive_failures+1 >= 5 THEN 'DISABLED' ELSE 'DEGRADED' END,
			last_check_at=excluded.last_check_at, updated_at=excluded.updated_at`,
		url, typ, name, statusText, errMsg, now, now)
	return err
}

// GetSourceHealth — toute la table, pour GET /api/sources-health du labo.
func (c *Client) GetSourceHealth() ([]SourceHealth, error) {
	rows, err := c.db.Query(`
		SELECT url, type, COALESCE(source_name,''), consecutive_failures,
		       COALESCE(last_status,''), COALESCE(last_error,''), status,
		       COALESCE(last_ok_at,''), COALESCE(last_check_at,'')
		FROM daemon_source_health ORDER BY status DESC, consecutive_failures DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SourceHealth{}
	for rows.Next() {
		var h SourceHealth
		if err := rows.Scan(&h.URL, &h.Type, &h.SourceName, &h.ConsecutiveFailures,
			&h.LastStatus, &h.LastError, &h.Status, &h.LastOKAt, &h.LastCheckAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// ── Seen URLs ───────────────────────────────────────────────────────────────

func (c *Client) GetSeenURLs() ([]string, error) {
	rows, err := c.db.Query(`SELECT url FROM daemon_seen_urls`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (c *Client) AddSeenURLs(urls []string) error {
	tx, err := c.db.Begin()
	if err != nil {
		return err
	}
	for _, u := range urls {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO daemon_seen_urls(url) VALUES(?)`, u); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (c *Client) PurgeSeenURLs(before time.Time) error {
	_, err := c.db.Exec(`DELETE FROM daemon_seen_urls WHERE created_at < ?`, before.UTC().Format(time.RFC3339))
	return err
}

// ── Signaux ─────────────────────────────────────────────────────────────────

const signalCols = `id, raw_data, final_draft, tags, status, taxonomy, geo, image_url`

func scanSignal(row interface{ Scan(...any) error }) (Signal, error) {
	var sig Signal
	var id int64
	var rawData, finalDraft, tags sql.NullString
	var taxonomy, geo, imageURL sql.NullString
	err := row.Scan(&id, &rawData, &finalDraft, &tags, &sig.Status, &taxonomy, &geo, &imageURL)
	sig.ID = ID(strconv.FormatInt(id, 10))
	sig.RawData = json.RawMessage(fromNull(rawData))
	sig.FinalDraft = json.RawMessage(fromNull(finalDraft))
	sig.Tags = json.RawMessage(fromNull(tags))
	sig.Taxonomy = fromNull(taxonomy)
	sig.Geo = fromNull(geo)
	sig.ImageURL = fromNull(imageURL)
	return sig, err
}

func fromNull(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}

const signalSelect = `SELECT ` + signalCols + ` FROM daemon_signals`

func (c *Client) GetSignalsByStatus(status string) ([]Signal, error) {
	rows, err := c.db.Query(signalSelect+` WHERE status = ? ORDER BY id DESC`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Signal
	for rows.Next() {
		sig, err := scanSignal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sig)
	}
	return out, rows.Err()
}

func (c *Client) GetSignalsSince(after time.Time) ([]Signal, error) {
	rows, err := c.db.Query(signalSelect+` WHERE created_at >= ? ORDER BY id DESC`, after.UTC().Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Signal
	for rows.Next() {
		sig, err := scanSignal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sig)
	}
	return out, rows.Err()
}

func (c *Client) GetSignal(id ID) (*Signal, error) {
	row := c.db.QueryRow(signalSelect+` WHERE id = ?`, id.Number())
	sig, err := scanSignal(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("signal %s introuvable", id)
	}
	if err != nil {
		return nil, err
	}
	return &sig, nil
}

func (c *Client) CreateSignals(rows []map[string]any) error {
	tx, err := c.db.Begin()
	if err != nil {
		return err
	}
	for _, r := range rows {
		if _, err := tx.Exec(
			`INSERT INTO daemon_signals(raw_data, status, tags) VALUES(?,?,COALESCE(?,'[]'))`,
			strVal(r["raw_data"]), strVal(r["status"]), strVal(r["tags"]),
		); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

var signalFieldCols = map[string]string{
	"status":      "status",
	"taxonomy":    "taxonomy",
	"geo":         "geo",
	"image_url":   "image_url",
	"final_draft": "final_draft",
	"tags":        "tags",
	"publishedAt": "published_at",
}

func (c *Client) UpdateSignal(id ID, data map[string]any) error {
	sets := []string{}
	args := []any{}
	for k, v := range data {
		col, ok := signalFieldCols[k]
		if !ok {
			continue
		}
		val := v
		if t, isTime := v.(time.Time); isTime {
			val = t.UTC().Format(time.RFC3339)
		}
		if s, isStr := val.(string); !isStr {
			b, _ := json.Marshal(val)
			val = string(b)
		} else if k == "publishedAt" {
			val = s
		}
		sets = append(sets, col+" = ?")
		args = append(args, val)
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, id.Number())
	_, err := c.db.Exec(`UPDATE daemon_signals SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
	return err
}

func (c *Client) UpdateManySignals(ids []ID, data map[string]any) error {
	for _, id := range ids {
		if err := c.UpdateSignal(id, data); err != nil {
			return err
		}
	}
	return nil
}

// ── Taxonomy templates (depuis les formats YAML) ────────────────────────────

func (c *Client) GetTaxonomyTemplates(activeOnly bool) ([]TaxonomyTemplate, error) {
	settings, err := c.GetSettings()
	if err != nil {
		return nil, err
	}
	out := []TaxonomyTemplate{}
	formats, _ := settings["formats"].([]any)
	for i, f := range formats {
		m, ok := f.(map[string]any)
		if !ok {
			continue
		}
		active := boolVal(m["actif"], m["active"])
		if activeOnly && !active {
			continue
		}
		name := strVal(m["nom"])
		out = append(out, TaxonomyTemplate{
			Name:        name,
			DisplayName: name,
			PromptText:  strVal(m["consigne"], m["formatInstructions"]),
			Active:      active,
			SortOrder:   i,
		})
	}
	return out, nil
}

// ── Publications (file de diffusion locale) ─────────────────────────────────

func (c *Client) GetPendingSignalsWithoutPublications() ([]Signal, error) {
	rows, err := c.db.Query(signalSelect + ` WHERE status = 'PENDING'
		AND id NOT IN (SELECT topic_id FROM daemon_publications)
		ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Signal
	for rows.Next() {
		sig, err := scanSignal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sig)
	}
	return out, rows.Err()
}

func (c *Client) CreatePublications(rows []PublicationInput) error {
	tx, err := c.db.Begin()
	if err != nil {
		return err
	}
	for _, row := range rows {
		if _, err := tx.Exec(
			`INSERT INTO daemon_publications(topic_id, platform, status, scheduled_at) VALUES(?,?,?,?)`,
			row.TopicID.Number(), row.Platform, row.Status, row.ScheduledAt.UTC().Format(time.RFC3339),
		); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// GetDuePublications — missions PENDING arrivées à échéance, signal embarqué
// (JSON complet dans Publication.Signal pour Topic()/TopicID()).
func (c *Client) GetDuePublications(limit int) ([]Publication, error) {
	rows, err := c.db.Query(`
		SELECT p.id, p.platform, p.status, p.scheduled_at, p.published_at, p.topic_id
		FROM daemon_publications p
		WHERE p.status = 'PENDING' AND p.scheduled_at <= ?
		ORDER BY p.scheduled_at ASC LIMIT ?`,
		time.Now().UTC().Format(time.RFC3339), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Publication
	for rows.Next() {
		var pub Publication
		var id, topicID int64
		var publishedAt sql.NullString
		if err := rows.Scan(&id, &pub.Platform, &pub.Status, &pub.ScheduledAt, &publishedAt, &topicID); err != nil {
			return nil, err
		}
		pub.ID = ID(strconv.FormatInt(id, 10))
		if publishedAt.Valid && publishedAt.String != "" {
			if t, err := time.Parse(time.RFC3339, publishedAt.String); err == nil {
				pub.PublishedAt = &t
			}
		}
		if sig, err := c.GetSignal(ID(strconv.FormatInt(topicID, 10))); err == nil {
			if b, err := json.Marshal(sig); err == nil {
				pub.Signal = b
			}
		}
		out = append(out, pub)
	}
	return out, rows.Err()
}

func (c *Client) GetLastScheduledPublication(platform string) (*Publication, error) {
	row := c.db.QueryRow(`
		SELECT id, platform, status, scheduled_at, published_at
		FROM daemon_publications WHERE platform = ? AND scheduled_at > ?
		ORDER BY scheduled_at DESC LIMIT 1`, platform, time.Now().UTC().Format(time.RFC3339))
	var pub Publication
	var id int64
	var publishedAt sql.NullString
	err := row.Scan(&id, &pub.Platform, &pub.Status, &pub.ScheduledAt, &publishedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	pub.ID = ID(strconv.FormatInt(id, 10))
	return &pub, nil
}

func (c *Client) UpdatePublication(id ID, data map[string]any) error {
	sets, args := []string{}, []any{}
	if st, ok := data["status"].(string); ok {
		sets, args = append(sets, "status = ?"), append(args, st)
	}
	if pt, ok := data["publishedAt"].(time.Time); ok {
		sets, args = append(sets, "published_at = ?"), append(args, pt.UTC().Format(time.RFC3339))
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, id.Number())
	_, err := c.db.Exec(`UPDATE daemon_publications SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
	return err
}

func (c *Client) CountPendingPublications(topicID ID) (int, error) {
	var n int
	err := c.db.QueryRow(
		`SELECT COUNT(*) FROM daemon_publications WHERE topic_id = ? AND status = 'PENDING'`,
		topicID.Number()).Scan(&n)
	return n, err
}

// ── helpers ─────────────────────────────────────────────────────────────────

func strVal(v ...any) string {
	for _, x := range v {
		if s, ok := x.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func boolVal(vs ...any) bool {
	for _, v := range vs {
		switch b := v.(type) {
		case bool:
			return b
		case string:
			return strings.EqualFold(b, "true")
		}
	}
	return false
}
