package api

// Templates Slide customs — fichier dédié data/slide_templates.db (séparé du
// pipeline comme les élections : vider le pipeline ne doit jamais effacer
// les créations de l'utilisateur).
//
//	GET    /api/slide-templates       → {templates: […]}
//	POST   /api/slide-templates       → upsert {template} (id généré si absent)
//	DELETE /api/slide-templates?id=xx → supprime

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var slideTemplateIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{3,64}$`)

var slideBaseTypes = map[string]bool{
	"COVER": true, "NEWS": true, "VERSUS": true, "BIG_NUM": true,
	"IMPACT_QUOTE": true, "INFO": true, "OUTRO": true, "MANIFESTO": true,
	"MAXTEXT": true, "GRANULAR": true, "CHECKLIST": true, "ANALYSIS": true,
	"COMPARISON_CHART": true, "STACKED_DATA": true, "VOTE_TRACKER": true,
	"TERRITORY_RADAR": true, "DECODING": true, "CHRONO_LOCK": true,
	"SOCIAL_COST": true, "VIDEO_NOTE": true,
}

type slideTemplateRow struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Category      string `json:"category"`
	Description   string `json:"description,omitempty"`
	BaseType      string `json:"baseType"`
	Format        string `json:"format"`
	TemplateState string `json:"templateState"`
	Layers        string `json:"layers"`
	Thumbnail     string `json:"thumbnail,omitempty"`
	CreatedAt     int64  `json:"createdAt"`
	UpdatedAt     int64  `json:"updatedAt"`
}

// Le client peut envoyer templateState/layers en objet ou en string JSON.
type slideTemplateInput struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Category      string          `json:"category"`
	Description   string          `json:"description"`
	BaseType      string          `json:"baseType"`
	Format        string          `json:"format"`
	TemplateState json.RawMessage `json:"templateState"`
	Layers        json.RawMessage `json:"layers"`
	Thumbnail     string          `json:"thumbnail"`
}

func rawToString(raw json.RawMessage, fallback string) (string, bool) {
	if len(raw) == 0 {
		return fallback, true
	}
	if !json.Valid(raw) {
		return "", false
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if strings.TrimSpace(s) == "" {
			return fallback, true
		}
		if !json.Valid([]byte(s)) {
			return "", false
		}
		return s, true
	}
	return string(raw), true
}

func (srv *Server) slideTemplatesDbPath() string {
	return filepath.Join(filepath.Dir(srv.Client.DBPath()), "slide_templates.db")
}

func openSlideTemplatesDb(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path+"?mode=rwc")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS slide_templates (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT 'Personnalisé',
		description TEXT NOT NULL DEFAULT '',
		base_type TEXT NOT NULL,
		format TEXT NOT NULL DEFAULT '4:5',
		template_state TEXT NOT NULL DEFAULT '{}',
		layers TEXT NOT NULL DEFAULT '[]',
		thumbnail TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func scanSlideTemplateRow(rows *sql.Rows) (slideTemplateRow, error) {
	var r slideTemplateRow
	err := rows.Scan(
		&r.ID, &r.Name, &r.Category, &r.Description, &r.BaseType, &r.Format,
		&r.TemplateState, &r.Layers, &r.Thumbnail, &r.CreatedAt, &r.UpdatedAt,
	)
	return r, err
}

func (srv *Server) listSlideTemplates(w http.ResponseWriter, _ *http.Request) {
	db, err := openSlideTemplatesDb(srv.slideTemplatesDbPath())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "base templates : " + err.Error()})
		return
	}
	defer db.Close()

	rows, err := db.Query(`SELECT id, name, category, description, base_type, format,
		template_state, layers, thumbnail, created_at, updated_at
		FROM slide_templates ORDER BY updated_at DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	defer rows.Close()

	out := make([]slideTemplateRow, 0)
	for rows.Next() {
		r, err := scanSlideTemplateRow(rows)
		if err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
		out = append(out, r)
	}
	writeJSON(w, 200, map[string]any{"templates": out})
}

func (srv *Server) upsertSlideTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Template slideTemplateInput `json:"template"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "corps JSON invalide : " + err.Error()})
		return
	}
	in := req.Template
	t := slideTemplateRow{
		ID:          strings.TrimSpace(in.ID),
		Name:        strings.TrimSpace(in.Name),
		Category:    strings.TrimSpace(in.Category),
		Description: strings.TrimSpace(in.Description),
		BaseType:    strings.ToUpper(strings.TrimSpace(in.BaseType)),
		Format:      strings.TrimSpace(in.Format),
		Thumbnail:   in.Thumbnail,
	}
	if t.ID == "" {
		t.ID = fmt.Sprintf("t%d", time.Now().UnixMilli())
	}
	if !slideTemplateIDRe.MatchString(t.ID) {
		writeJSON(w, 400, map[string]any{"error": "id invalide (3-64 chars alphanum/_/-)"})
		return
	}
	t.Name = strings.TrimSpace(t.Name)
	if t.Name == "" || len(t.Name) > 60 {
		writeJSON(w, 400, map[string]any{"error": "nom requis (1-60 chars)"})
		return
	}
	if !slideBaseTypes[t.BaseType] {
		writeJSON(w, 400, map[string]any{"error": "baseType inconnu : " + in.BaseType})
		return
	}
	if t.Category == "" {
		t.Category = "Personnalisé"
	}
	if t.Format == "" {
		t.Format = "4:5"
	}
	stateStr, ok := rawToString(in.TemplateState, "{}")
	if !ok {
		writeJSON(w, 400, map[string]any{"error": "templateState JSON invalide"})
		return
	}
	layersStr, ok := rawToString(in.Layers, "[]")
	if !ok {
		writeJSON(w, 400, map[string]any{"error": "layers JSON invalide"})
		return
	}
	t.TemplateState = stateStr
	t.Layers = layersStr
	if len(t.Thumbnail) > 500_000 {
		writeJSON(w, 413, map[string]any{"error": "miniature trop lourde (500 Ko max)"})
		return
	}

	db, err := openSlideTemplatesDb(srv.slideTemplatesDbPath())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "base templates : " + err.Error()})
		return
	}
	defer db.Close()

	now := time.Now().UnixMilli()
	var created int64
	err = db.QueryRow(`SELECT created_at FROM slide_templates WHERE id = ?`, t.ID).Scan(&created)
	if err == sql.ErrNoRows {
		created = now
	} else if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if _, err := db.Exec(`INSERT INTO slide_templates
		(id, name, category, description, base_type, format, template_state, layers, thumbnail, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
		name=excluded.name, category=excluded.category, description=excluded.description,
		base_type=excluded.base_type, format=excluded.format, template_state=excluded.template_state,
		layers=excluded.layers, thumbnail=excluded.thumbnail, updated_at=excluded.updated_at`,
		t.ID, t.Name, t.Category, t.Description, t.BaseType, t.Format,
		t.TemplateState, t.Layers, t.Thumbnail, created, now,
	); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	t.CreatedAt = created
	t.UpdatedAt = now
	writeJSON(w, 200, map[string]any{"ok": true, "template": t})
}

func (srv *Server) deleteSlideTemplate(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if !slideTemplateIDRe.MatchString(id) {
		writeJSON(w, 400, map[string]any{"error": "id invalide"})
		return
	}
	db, err := openSlideTemplatesDb(srv.slideTemplatesDbPath())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "base templates : " + err.Error()})
		return
	}
	defer db.Close()

	res, err := db.Exec(`DELETE FROM slide_templates WHERE id = ?`, id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, 404, map[string]any{"error": "template introuvable"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "id": id})
}

func orEmptyJSON(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}
