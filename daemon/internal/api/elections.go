package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

// Élections — registre des scrutins (data/elections/).
//
// Depuis le refactor des bases : UN fichier SQLite par élection
// (data/elections/{slug}.db) + un registre JSON (registry.json) qui liste les
// scrutins affichés et la cible. Ces endpoints permettent au studio de gérer le
// registre sans toucher au front : lister, créer un scrutin (fichier + entrée
// registre), changer la cible/affichage, supprimer.

var electionSlugRe = regexp.MustCompile(`^[a-zA-Z0-9-]{3,40}$`)

type electionInfo struct {
	Slug        string `json:"slug"`
	Displayed   bool   `json:"displayed"`
	IsTarget    bool   `json:"isTarget"`
	FileExists  bool   `json:"fileExists"`
	FileSizeKB  int64  `json:"fileSizeKb"`
	Communes    int    `json:"communes"`
	Departments int    `json:"departments"`
}

// electionsDir — dossier des bases par élection, dérivé du dossier de la base
// pipeline (data/pipeline.db → data/elections/). Défaut relatif si PIPELINE_DB_PATH absent.
func (srv *Server) electionsDir() string {
	// On dérive du chemin de la base pipeline (même dossier).
	dir := filepath.Dir(srv.Client.DBPath())
	return filepath.Join(dir, "elections")
}

func (srv *Server) registryPath() string {
	return filepath.Join(srv.electionsDir(), "registry.json")
}

type electionsRegistry struct {
	DisplaySlugs []string `json:"displaySlugs"`
	TargetSlug   string   `json:"targetSlug"`
}

func (srv *Server) readRegistry() electionsRegistry {
	reg := electionsRegistry{DisplaySlugs: []string{}, TargetSlug: ""}
	raw, err := os.ReadFile(srv.registryPath())
	if err == nil {
		_ = json.Unmarshal(raw, &reg)
	}
	if reg.DisplaySlugs == nil {
		reg.DisplaySlugs = []string{}
	}
	return reg
}

func (srv *Server) writeRegistry(reg electionsRegistry) error {
	if err := os.MkdirAll(srv.electionsDir(), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(srv.registryPath(), b, 0o644)
}

// electionDbPath — chemin du fichier d'une élection (slug validé).
func (srv *Server) electionDbPath(slug string) (string, error) {
	if !electionSlugRe.MatchString(slug) {
		return "", fmt.Errorf("slug invalide : %q (attendu lettres/chiffres/tirets, 3-40 chars)", slug)
	}
	return filepath.Join(srv.electionsDir(), slug+".db"), nil
}

// createElectionDb — crée un fichier SQLite vide avec le schéma élection.
func createElectionDb(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return err
	}
	defer db.Close()
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS elections_officiel_cache (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			election_slug TEXT NOT NULL,
			code_departement TEXT,
			code_insee TEXT,
			ville TEXT NOT NULL,
			ville_norm TEXT,
			tour INTEGER NOT NULL,
			candidat TEXT NOT NULL,
			nuance TEXT,
			pct REAL NOT NULL,
			voix INTEGER,
			statut TEXT,
			updated_at TEXT DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS elections_resultats (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			election_slug TEXT NOT NULL DEFAULT 'municipales-2026',
			ville TEXT NOT NULL,
			tour INTEGER NOT NULL DEFAULT 1,
			candidat TEXT NOT NULL,
			nuance TEXT,
			pct REAL NOT NULL DEFAULT 0,
			voix INTEGER DEFAULT 0,
			statut TEXT DEFAULT 'elimine' CHECK(statut IN ('elu', 'qualifie', 'elimine', 'retrait')),
			active INTEGER DEFAULT 1,
			updated_at TEXT DEFAULT (datetime('now')),
			UNIQUE(election_slug, ville, tour, candidat)
		)`,
		`CREATE TABLE IF NOT EXISTS elections_sync_status (
			election_slug TEXT PRIMARY KEY,
			last_sync TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS election_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// electionStats — compteurs (communes, départements) depuis une base élection.
func electionStats(path string) (communes, departments int) {
	if _, err := os.Stat(path); err != nil {
		return 0, 0
	}
	db, err := sql.Open("sqlite", path+"?mode=ro")
	if err != nil {
		return 0, 0
	}
	defer db.Close()
	_ = db.QueryRow(`SELECT COUNT(DISTINCT code_insee), COUNT(DISTINCT code_departement) FROM elections_officiel_cache`).Scan(&communes, &departments)
	return
}

// listElections — GET /api/elections → registre + infos de chaque scrutin.
func (srv *Server) listElections(w http.ResponseWriter, _ *http.Request) {
	reg := srv.readRegistry()
	dir := srv.electionsDir()
	target := reg.TargetSlug
	displayed := map[string]bool{}
	for _, s := range reg.DisplaySlugs {
		displayed[s] = true
	}

	// Union : scrutins du registre + fichiers .db présents sur disque.
	bySlug := map[string]bool{}
	for _, s := range reg.DisplaySlugs {
		bySlug[s] = true
	}
	if target != "" {
		bySlug[target] = true
	}
	if entries, err := os.ReadDir(dir); err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".db") {
				bySlug[strings.TrimSuffix(e.Name(), ".db")] = true
			}
		}
	}

	slugs := make([]string, 0, len(bySlug))
	for s := range bySlug {
		slugs = append(slugs, s)
	}
	sort.Strings(slugs)

	out := make([]electionInfo, 0, len(slugs))
	for _, s := range slugs {
		path, err := srv.electionDbPath(s)
		info := electionInfo{Slug: s, Displayed: displayed[s], IsTarget: s == target}
		if err == nil {
			if st, err := os.Stat(path); err == nil {
				info.FileExists = true
				info.FileSizeKB = st.Size() / 1024
			}
			info.Communes, info.Departments = electionStats(path)
		}
		out = append(out, info)
	}

	writeJSON(w, 200, map[string]any{
		"registry":  reg,
		"elections": out,
	})
}

// createElection — POST /api/elections {slug, display?} → crée le fichier
// {slug}.db + l'ajoute au registre (affiché si display != false).
func (srv *Server) createElection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Slug    string `json:"slug"`
		Display *bool  `json:"display"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "corps JSON invalide : " + err.Error()})
		return
	}
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if !electionSlugRe.MatchString(req.Slug) {
		writeJSON(w, 400, map[string]any{"error": "slug invalide (lettres/chiffres/tirets, 3-40 chars)"})
		return
	}
	path, err := srv.electionDbPath(req.Slug)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error()})
		return
	}

	display := true
	if req.Display != nil {
		display = *req.Display
	}

	reg := srv.readRegistry()
	// Le premier scrutin créé devient la cible s'il n'y en a pas encore.
	if reg.TargetSlug == "" {
		reg.TargetSlug = req.Slug
	}

	// Création du fichier (ne réécrase pas un fichier existant avec des données).
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := createElectionDb(path); err != nil {
			writeJSON(w, 500, map[string]any{"error": "création de la base : " + err.Error()})
			return
		}
	}

	if display && !contains(reg.DisplaySlugs, req.Slug) {
		reg.DisplaySlugs = append(reg.DisplaySlugs, req.Slug)
	}
	if err := srv.writeRegistry(reg); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "slug": req.Slug, "registry": reg})
}

// updateElection — PATCH /api/elections {slug, display?, target?} → afficher/
// masquer un scrutin, ou le définir comme cible.
func (srv *Server) updateElection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Slug    string `json:"slug"`
		Display *bool  `json:"display"`
		Target  *bool  `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "corps JSON invalide : " + err.Error()})
		return
	}
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	if !electionSlugRe.MatchString(req.Slug) {
		writeJSON(w, 400, map[string]any{"error": "slug invalide"})
		return
	}

	reg := srv.readRegistry()

	if req.Display != nil {
		if *req.Display {
			if !contains(reg.DisplaySlugs, req.Slug) {
				reg.DisplaySlugs = append(reg.DisplaySlugs, req.Slug)
			}
		} else {
			reg.DisplaySlugs = remove(reg.DisplaySlugs, req.Slug)
		}
	}
	if req.Target != nil && *req.Target {
		reg.TargetSlug = req.Slug
	}
	if err := srv.writeRegistry(reg); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "registry": reg})
}

// deleteElection — DELETE /api/elections?slug=xxx → retire du registre +
// supprime le fichier {slug}.db (les données officielles sont re-synchronisables).
func (srv *Server) deleteElection(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("slug")))
	if !electionSlugRe.MatchString(slug) {
		writeJSON(w, 400, map[string]any{"error": "slug invalide"})
		return
	}
	reg := srv.readRegistry()
	reg.DisplaySlugs = remove(reg.DisplaySlugs, slug)
	if reg.TargetSlug == slug {
		// La cible supprimée → le premier scrutin restant devient la cible.
		reg.TargetSlug = ""
		if len(reg.DisplaySlugs) > 0 {
			reg.TargetSlug = reg.DisplaySlugs[0]
		}
	}
	if err := srv.writeRegistry(reg); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	path, _ := srv.electionDbPath(slug)
	if _, err := os.Stat(path); err == nil {
		if err := os.Remove(path); err != nil {
			writeJSON(w, 500, map[string]any{"error": "suppression du fichier : " + err.Error()})
			return
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "registry": reg})
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func remove(list []string, v string) []string {
	out := list[:0]
	for _, x := range list {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}
