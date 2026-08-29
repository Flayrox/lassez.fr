// Package store — stockage local du pipeline (SQLite + settings YAML).
//
// Anciennement un client REST vers le CMS ; depuis le pivot local, ce
// fichier implémente l'API du pipeline avec un stockage 100% local :
//   - signaux, seen-urls et publications → SQLite (data/pipeline.db, tables daemon_*)
//   - settings → config/config.yaml aplati en map (clés historiques préservées)
//
// Les nœuds du pipeline ne changent pas : ils continuent d'appeler
// client.GetSignalsByStatus / UpdateSignal / CreateSignals / etc.
package store

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
	dbPath   string
}

// ID — identifiant de signal/publication (entier sérialisé en chaîne).
type ID string

// Number convertit l'ID en entier si possible.
func (id ID) Number() int64 {
	n, _ := strconv.ParseInt(string(id), 10, 64)
	return n
}

// Signal — document du pipeline (miroir de l'ancienne collection CMS).
type Signal struct {
	ID         ID              `json:"id"`
	RawData    json.RawMessage `json:"raw_data"`
	FinalDraft json.RawMessage `json:"final_draft"`
	Tags       json.RawMessage `json:"tags"`
	Status     string          `json:"status"`
	Taxonomy   string          `json:"taxonomy"`
	Geo        string          `json:"geo"`
	ImageURL   string          `json:"image_url"`
	CreatedAt  string          `json:"created_at"`
}

// StudioSignal — vue de daemon_signals pour la page Signaux du studio (même
// forme que l'ancienne table radar_posts : source_title, flash_content…).
type StudioSignal struct {
	ID            int64  `json:"id"`
	SourceTitle   string `json:"source_title"`
	FlashContent  string `json:"flash_content"`
	SourceURL     string `json:"source_url"`
	Status        string `json:"status"`
	Geo           string `json:"geo"`
	TypeOuverture string `json:"type_ouverture"`
	Fiabilite     string `json:"fiabilite"`
	Tags          string `json:"tags"`
	CreatedAt     string `json:"created_at"`
}

type TaxonomyTemplate struct {
	Name         string   `json:"name"`          // clé système (FLASH, ALERTE…) — utilisée pour matcher
	DisplayName  string   `json:"display_name"`  // nom affiché (🚨 FLASH)
	PromptText   string   `json:"format_instructions"` // consigne / formatInstructions envoyée à l'IA
	Examples     []string `json:"examples"`      // few-shot learning — posts d'exemple
	OutputSchema string   `json:"output_schema"` // schéma JSON de sortie attendu
	Description  string   `json:"description"`   // quand utiliser ce format (pour le Researcher)
	Active       bool     `json:"active"`
	SortOrder    int      `json:"sort_order"`
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
// de settings (config YAML aplatie). WAL activé : lectures du studio pendant
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
			log.Printf("[store-local] pragma %q : %v", pragma, err)
		}
	}
	c := &Client{db: db, settings: settingsProvider, dbPath: dbPath}
	if err := c.migrate(); err != nil {
		return nil, fmt.Errorf("migration daemon_* : %w", err)
	}
	return c, nil
}

// DBPath — chemin du fichier SQLite (utilisé pour dériver le dossier des
// bases par élection : data/pipeline.db → data/elections/).
func (c *Client) DBPath() string { return c.dbPath }

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
		`CREATE TABLE IF NOT EXISTS daemon_cycles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			started_at TEXT NOT NULL,
			ended_at TEXT,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			source TEXT NOT NULL DEFAULT 'pipeline',
			error TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dcycles_id ON daemon_cycles(id DESC)`,
		`CREATE TABLE IF NOT EXISTS daemon_cycle_steps (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			cycle_id INTEGER NOT NULL,
			type TEXT NOT NULL,
			label TEXT NOT NULL,
			status TEXT NOT NULL,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			error TEXT,
			detail TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dcsteps_cycle ON daemon_cycle_steps(cycle_id)`,
	}
	for _, s := range stmts {
		if _, err := c.db.Exec(s); err != nil {
			return err
		}
	}
	// Fusion des statuts (9 → 5) : VALIDATED est absorbé par DRAFTED, APPROVED
	// par QUEUED, IGNORED rejoint REJECTED. Idempotent (plus de lignes
	// concernées après la première passe).
	for _, s := range []string{
		`UPDATE daemon_signals SET status='DRAFTED' WHERE status='VALIDATED'`,
		`UPDATE daemon_signals SET status='QUEUED' WHERE status='APPROVED'`,
		`UPDATE daemon_signals SET status='REJECTED' WHERE status='IGNORED'`,
	} {
		if _, err := c.db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) Close() error { return c.db.Close() }

// ── Cycles (historique « Suivi » du studio) ──────────────────────────────────

// CycleStep — une étape d'un cycle (Aspiré, Trié, Rédigé, Validé, Publié…).
type CycleStep struct {
	Type       string `json:"type"`
	Label      string `json:"label"`
	Status     string `json:"status"` // ok | error | skipped
	DurationMS int64  `json:"durationMs"`
	Error      string `json:"error,omitempty"`
	Detail     string `json:"detail,omitempty"`
}

// Cycle — un passage complet du pipeline (ou une diffusion publisher).
type Cycle struct {
	ID         int64       `json:"id"`
	StartedAt  string      `json:"started_at"`
	EndedAt    string      `json:"ended_at"`
	DurationMS int64       `json:"durationMs"`
	Source     string      `json:"source"` // pipeline | publisher
	Error      string      `json:"error,omitempty"`
	Steps      []CycleStep `json:"steps"`
}

// StartCycle — ouvre un nouveau cycle (source : pipeline | publisher).
func (c *Client) StartCycle(source string) (int64, error) {
	res, err := c.db.Exec(`INSERT INTO daemon_cycles(started_at, source) VALUES(?,?)`,
		time.Now().UTC().Format(time.RFC3339), source)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// RecordCycleStep — enregistre une étape du cycle en cours.
func (c *Client) RecordCycleStep(cycleID int64, stepType, label, status string, dur time.Duration, errMsg, detail string) error {
	if cycleID <= 0 {
		return nil
	}
	_, err := c.db.Exec(`INSERT INTO daemon_cycle_steps(cycle_id, type, label, status, duration_ms, error, detail) VALUES(?,?,?,?,?,?,?)`,
		cycleID, stepType, label, status, dur.Milliseconds(), errMsg, detail)
	return err
}

// EndCycle — clôt le cycle (durée totale + erreur globale éventuelle).
func (c *Client) EndCycle(cycleID int64, err error, dur time.Duration) error {
	if cycleID <= 0 {
		return nil
	}
	errStr := ""
	if err != nil {
		errStr = err.Error()
	}
	_, e := c.db.Exec(`UPDATE daemon_cycles SET ended_at=?, duration_ms=?, error=? WHERE id=?`,
		time.Now().UTC().Format(time.RFC3339), dur.Milliseconds(), errStr, cycleID)
	return e
}

// ListCycles — les derniers cycles, du plus récent au plus ancien, chacun
// avec ses étapes dans l'ordre d'exécution.
func (c *Client) ListCycles(limit int) ([]Cycle, error) {
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	rows, err := c.db.Query(`SELECT id, COALESCE(started_at,''), COALESCE(ended_at,''), duration_ms, source, COALESCE(error,'') FROM daemon_cycles ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	var cycles []Cycle
	for rows.Next() {
		var cy Cycle
		if err := rows.Scan(&cy.ID, &cy.StartedAt, &cy.EndedAt, &cy.DurationMS, &cy.Source, &cy.Error); err != nil {
			rows.Close()
			return nil, err
		}
		cycles = append(cycles, cy)
	}
	// On ferme les lignes AVANT de relire la connexion unique (SetMaxOpenConns(1)) :
	// une requête imbriquée sur le même *sql.DB se bloquerait sinon.
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Puis on charge les étapes de chaque cycle, connexion libérée.
	for i := range cycles {
		steps, err := c.listCycleSteps(cycles[i].ID)
		if err != nil {
			return nil, err
	}
		cycles[i].Steps = steps
	}
	// Ordre chronologique pour la timeline (plus vieux en premier).
	for i, j := 0, len(cycles)-1; i < j; i, j = i+1, j-1 {
		cycles[i], cycles[j] = cycles[j], cycles[i]
	}
	return cycles, nil
}

func (c *Client) listCycleSteps(cycleID int64) ([]CycleStep, error) {
	rows, err := c.db.Query(`SELECT type, label, status, duration_ms, COALESCE(error,''), COALESCE(detail,'') FROM daemon_cycle_steps WHERE cycle_id = ? ORDER BY id ASC`, cycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CycleStep
	for rows.Next() {
		var st CycleStep
		if err := rows.Scan(&st.Type, &st.Label, &st.Status, &st.DurationMS, &st.Error, &st.Detail); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

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

// AppendLog — no-op conservé pour compat ; le fichier daemon.log suffit.
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

// GetSourceHealth — toute la table, pour GET /api/sources-health du studio.
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

const signalCols = `id, raw_data, final_draft, tags, status, taxonomy, geo, image_url, created_at`

func scanSignal(row interface{ Scan(...any) error }) (Signal, error) {
	var sig Signal
	var id int64
	var rawData, finalDraft, tags, createdAt sql.NullString
	var taxonomy, geo, imageURL sql.NullString
	err := row.Scan(&id, &rawData, &finalDraft, &tags, &sig.Status, &taxonomy, &geo, &imageURL, &createdAt)
	sig.ID = ID(strconv.FormatInt(id, 10))
	sig.RawData = json.RawMessage(fromNull(rawData))
	sig.FinalDraft = json.RawMessage(fromNull(finalDraft))
	sig.Tags = json.RawMessage(fromNull(tags))
	sig.Taxonomy = fromNull(taxonomy)
	sig.Geo = fromNull(geo)
	sig.ImageURL = fromNull(imageURL)
	sig.CreatedAt = fromNull(createdAt)
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
		id := strVal(m["id"], m["name"], m["nom"])
		name := strVal(m["nom"])
		out = append(out, TaxonomyTemplate{
			Name:         id,
			DisplayName:  name,
			PromptText:   strVal(m["consigne"], m["formatInstructions"]),
			Examples:     stringSlice(m["exemples"], m["examples"]),
			OutputSchema: strVal(m["schema"], m["outputSchemaJson"]),
			Description:  strVal(m["description"]),
			Active:       active,
			SortOrder:    i,
		})
	}
	return out, nil
}

// stringSlice convertit une liste YAML/JSON ([]any) en []string.
func stringSlice(vs ...any) []string {
	for _, v := range vs {
		switch arr := v.(type) {
		case []any:
			out := []string{}
			for _, item := range arr {
				if s, ok := item.(string); ok {
					out = append(out, s)
				}
			}
			return out
		case []string:
			return arr
		}
	}
	return nil
}

// ── Signaux pour le studio (page Signaux, forme radar_posts) ────────────────

// ListSignals — daemon_signals filtré (status/geo/q) + compteurs par statut.
func (c *Client) ListSignals(status, geo, q string, limit int) ([]StudioSignal, error) {
	where := []string{"1=1"}
	args := []any{}
	if status != "" && status != "ALL" {
		// status accepte une liste séparée par des virgules (ex: "PENDING,QUEUED")
		// pour les onglets regroupés du studio.
		statuses := []string{}
		for _, s := range strings.Split(status, ",") {
			if s = strings.TrimSpace(s); s != "" {
				statuses = append(statuses, s)
			}
		}
		if len(statuses) == 1 {
			where = append(where, "status = ?")
			args = append(args, statuses[0])
		} else if len(statuses) > 1 {
			ph := strings.TrimRight(strings.Repeat("?,", len(statuses)), ",")
			where = append(where, "status IN ("+ph+")")
			for _, s := range statuses {
				args = append(args, s)
			}
		}
	}
	if geo != "" && geo != "all" {
		where = append(where, "geo = ?")
		args = append(args, geo)
	}
	if strings.TrimSpace(q) != "" {
		where = append(where, "(raw_data LIKE ? OR final_draft LIKE ? OR tags LIKE ?)")
		pat := "%" + q + "%"
		args = append(args, pat, pat, pat)
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	args = append(args, limit)
	rows, err := c.db.Query(
		`SELECT id, raw_data, final_draft, tags, status, COALESCE(geo,'france'), COALESCE(taxonomy,''), created_at
		 FROM daemon_signals WHERE `+strings.Join(where, " AND ")+
		 ` ORDER BY id DESC LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StudioSignal
	for rows.Next() {
		var ls StudioSignal
		var rawData, finalDraft, tags, createdAt sql.NullString
		if err := rows.Scan(&ls.ID, &rawData, &finalDraft, &tags, &ls.Status, &ls.Geo, &ls.TypeOuverture, &createdAt); err != nil {
			return nil, err
		}
		ls = deriveStudioSignal(ls, rawData, finalDraft, tags)
		ls.CreatedAt = fromNull(createdAt)
		out = append(out, ls)
	}
	return out, rows.Err()
}

// deriveStudioSignal reconstruit source_title/url/contenu/fiabilité depuis
// raw_data (mergedTopic JSON), le brouillon final (final_draft.body) et tags.
func deriveStudioSignal(ls StudioSignal, rawData, finalDraft, tags sql.NullString) StudioSignal {
	var raw struct {
		ClusterTitle string            `json:"clusterTitle"`
		Articles     []json.RawMessage `json:"articles"`
	}
	_ = json.Unmarshal([]byte(fromNull(rawData)), &raw)
	ls.SourceTitle = raw.ClusterTitle
	if len(raw.Articles) > 0 {
		var art struct {
			URL        string `json:"url"`
			Content    string `json:"content"`
			SourceName string `json:"source_name"`
			TrustScore int    `json:"trust_score"`
		}
		_ = json.Unmarshal(raw.Articles[0], &art)
		if ls.SourceTitle == "" {
			ls.SourceTitle = art.SourceName
		}
		ls.SourceURL = art.URL
		ls.FlashContent = art.Content
		switch {
		case art.TrustScore >= 8:
			ls.Fiabilite = "haute"
		case art.TrustScore >= 6:
			ls.Fiabilite = "moyenne"
		default:
			ls.Fiabilite = "faible"
		}
	}
	// Le brouillon final prime : c'est lui qui sera publié.
	var draft struct {
		Body string `json:"body"`
	}
	_ = json.Unmarshal([]byte(fromNull(finalDraft)), &draft)
	if draft.Body != "" {
		ls.FlashContent = draft.Body
	}
	if ls.TypeOuverture == "" {
		ls.TypeOuverture = "📌 LE FAIT DU JOUR"
	}
	if ls.Fiabilite == "" {
		ls.Fiabilite = "moyenne"
	}
	var tagList []string
	_ = json.Unmarshal([]byte(fromNull(tags)), &tagList)
	ls.Tags = strings.Join(tagList, ",")
	return ls
}

// CountSignals — compteurs par statut pour les tabs du studio.
func (c *Client) CountSignals() (map[string]int64, error) {
	rows, err := c.db.Query(`SELECT status, COUNT(*) FROM daemon_signals GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var st string
		var n int64
		if err := rows.Scan(&st, &n); err != nil {
			return nil, err
		}
		out[st] = n
	}
	return out, rows.Err()
}

// DeleteSignals — suppression définitive depuis le studio.
func (c *Client) DeleteSignals(ids []ID) error {
	if len(ids) == 0 {
		return nil
	}
	ph := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id.Number())
	}
	_, err := c.db.Exec(`DELETE FROM daemon_signals WHERE id IN (`+ph+`)`, args...)
	return err
}

// ── Publications (file de diffusion locale) ─────────────────────────────────

// GetApprovableSignals — file de publication : les sujets prêts à être
// programmés. C'est la porte de modération du pipeline.
//   - autoApprove=false (défaut) : seul QUEUED (approuvé dans le studio)
//   - autoApprove=true  (Mode Fantôme) : PENDING est considéré approuvé d'office
func (c *Client) GetApprovableSignals(autoApprove bool) ([]Signal, error) {
	statuses := "('QUEUED')"
	if autoApprove {
		statuses = "('PENDING','QUEUED')"
	}
	rows, err := c.db.Query(signalSelect + ` WHERE status IN ` + statuses + `
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
