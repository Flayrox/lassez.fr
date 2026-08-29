// Package api — petit serveur HTTP du daemon : le studio (studio.lassez.fr) lui parle.
// Stdlib net/http uniquement. Routes :
//
//	GET  /api/healthz          → vivant
//	GET  /api/signals          → ?status=PENDING&geo=france&q=...&limit=100
//	PATCH /api/signals         → {"ids":[1,2],"status":"APPROVED"} ou {"ids":[..],"delete":true}
//	POST /api/scan             → déclenche un cycle de pipeline immédiat (scan manuel)
//	GET  /api/system-health    → télémétrie des briques + compteurs + infos daemon
package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

type Server struct {
	Client     *store.Client  // daemon_signals : signaux réels du pipeline + santé
	Mux        *http.ServeMux
	ConfigPath string           // config/config.yaml — édité par le studio
	Resolver   *config.Resolver // invalidé après chaque écriture
	Trigger    chan struct{}    // POST /api/scan → réveille la boucle principale (nil = scan désactivé)
	LogPath    string           // logs/daemon.log — lu pour le panneau de logs du studio
}

func New(client *store.Client, cfgPath string, resolver *config.Resolver) *Server {
	srv := &Server{Client: client, Mux: http.NewServeMux(), ConfigPath: cfgPath, Resolver: resolver}
	srv.Mux.HandleFunc("GET /api/healthz", srv.healthz)
	srv.Mux.HandleFunc("GET /api/signals", srv.listSignals)
	srv.Mux.HandleFunc("PATCH /api/signals", srv.patchSignals)
	srv.Mux.HandleFunc("GET /api/config", srv.getConfig)
	srv.Mux.HandleFunc("PATCH /api/config", srv.patchConfig)
	srv.Mux.HandleFunc("GET /api/secrets", srv.getSecrets)
	srv.Mux.HandleFunc("PATCH /api/secrets", srv.patchSecrets)
	srv.Mux.HandleFunc("GET /api/sources-health", srv.listSourceHealth)
	srv.Mux.HandleFunc("POST /api/sources/test", srv.testSource)
	srv.Mux.HandleFunc("GET /api/elections", srv.listElections)
	srv.Mux.HandleFunc("POST /api/elections", srv.createElection)
	srv.Mux.HandleFunc("PATCH /api/elections", srv.updateElection)
	srv.Mux.HandleFunc("DELETE /api/elections", srv.deleteElection)
	srv.Mux.HandleFunc("POST /api/gemini/test", srv.testGemini)
	srv.Mux.HandleFunc("POST /api/vertex/test", srv.testVertex)
	srv.Mux.HandleFunc("POST /api/scan", srv.triggerScan)
	srv.Mux.HandleFunc("GET /api/system-health", srv.systemHealth)
	srv.Mux.HandleFunc("GET /api/cycles", srv.listCycles)
	srv.Mux.HandleFunc("GET /api/logs", srv.listLogs)
	return srv
}

// listCycles — historique des cycles du pipeline (mode « Suivi » du studio).
func (srv *Server) listCycles(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	cycles, err := srv.Client.ListCycles(limit)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"data": cycles})
}

// LogEntry — une ligne du journal daemon (logs/daemon.log).
type LogEntry struct {
	Ts      string `json:"ts"`
	Level   string `json:"level"`
	Node    string `json:"node"`
	Message string `json:"message"`
}

// listLogs — les dernières lignes du journal du daemon, du plus vieux au plus
// récent. Format fichier : [ts] [LEVEL] [Node] message.
func (srv *Server) listLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	path := srv.LogPath
	if path == "" {
		path = filepath.Join(".", "logs", "daemon.log")
	}
	entries, err := readLogTail(path, limit)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, 200, map[string]any{"data": []LogEntry{}, "file": path})
			return
		}
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"data": entries, "file": path})
}

// readLogTail lit la fin du fichier de log (derniers ~256 Ko), coupe au début
// d'une ligne complète, puis parse chaque ligne.
func readLogTail(path string, limit int) ([]LogEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return nil, err
	}
	const chunk = 256 * 1024
	start := st.Size() - chunk
	if start < 0 {
		start = 0
	}
	buf := make([]byte, st.Size()-start)
	if _, err := f.ReadAt(buf, start); err != nil && err != io.EOF {
		return nil, err
	}
	text := string(buf)
	// On coupe au premier retour ligne complet pour ne pas lire une ligne coupée.
	if i := strings.IndexByte(text, '\n'); i >= 0 && start > 0 {
		text = text[i+1:]
	}

	var out []LogEntry
	for _, ln := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		e := LogEntry{Node: "SYSTEM", Level: "INFO"}
		rest := ln
		if strings.HasPrefix(rest, "[") {
			if i := strings.Index(rest, "]"); i > 0 {
				e.Ts = rest[1:i]
				rest = strings.TrimSpace(rest[i+1:])
			}
		}
		if strings.HasPrefix(rest, "[") {
			if i := strings.Index(rest, "]"); i > 0 {
				e.Level = strings.ToUpper(rest[1:i])
				rest = strings.TrimSpace(rest[i+1:])
			}
		}
		if strings.HasPrefix(rest, "[") {
			if i := strings.Index(rest, "]"); i > 0 {
				e.Node = rest[1:i]
				rest = strings.TrimSpace(rest[i+1:])
			}
		}
		e.Message = rest
		out = append(out, e)
	}
	if len(out) > limit {
		out = out[len(out)-limit:]
	}
	return out, nil
}

// triggerScan — scan manuel : réveille la boucle principale du daemon.
func (srv *Server) triggerScan(w http.ResponseWriter, _ *http.Request) {
	if srv.Trigger != nil {
		select {
		case srv.Trigger <- struct{}{}:
		default:
			// Un scan est déjà en attente — le studio n'a pas besoin de le savoir.
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "message": "scan déclenché"})
}

// systemHealth — télémétrie temps réel des briques + compteurs + infos daemon.
func (srv *Server) systemHealth(w http.ResponseWriter, _ *http.Request) {
	bricks, info := nodes.TelemetrySnapshot()
	// La brique API est saine par définition (la requête a abouti).
	bricks = append(bricks, nodes.Brick{Type: "api", Label: "API studio", Status: "ok", LastRun: time.Now()})

	if srv.Resolver != nil {
		if settings, err := srv.Resolver.Settings(); err == nil && settings != nil {
			if mock, ok := settings["qoeMockEnabled"].(bool); ok {
				info.QoeMock = mock
			} else {
				info.QoeMock = true // défaut : mode test
			}
			info.QoePublicationID, _ = settings["qoePublicationId"].(string)
		}
	}

	counts, _ := srv.Client.CountSignals()
	writeJSON(w, 200, map[string]any{
		"data": map[string]any{
			"bricks": bricks,
			"daemon": info,
			"counts": counts,
		},
	})
}

// listSourceHealth — santé réelle des sources enregistrée par l'ingestion.
func (srv *Server) listSourceHealth(w http.ResponseWriter, _ *http.Request) {
	if srv.Client == nil {
		writeJSON(w, 200, map[string]any{"data": []any{}})
		return
	}
	health, err := srv.Client.GetSourceHealth()
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"data": health})
}

// testSource — « tester ce flux » : parse isolément une URL RSS et renvoie
// les derniers articles. Aucun effet de bord (pas de santé, pas de seen
// URLs, pas de pipeline). Retourne 200 même en cas d'échec d'aspiration,
// avec ok:false + error.
func (srv *Server) testSource(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "corps JSON invalide : " + err.Error()})
		return
	}
	req.URL = strings.TrimSpace(req.URL)
	if req.URL == "" {
		writeJSON(w, 400, map[string]any{"error": "url manquante"})
		return
	}
	result, err := nodes.TestSource(req.URL)
	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "url": req.URL, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "result": result})
}

func (srv *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true})
}

// listSignals — signaux réels du pipeline (daemon_signals), même forme que
// l'ancienne table radar_posts (héritage du premier radar).
func (srv *Server) listSignals(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	signals, err := srv.Client.ListSignals(q.Get("status"), q.Get("geo"), q.Get("q"), limit)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	counts, _ := srv.Client.CountSignals()
	writeJSON(w, 200, map[string]any{"data": signals, "counts": counts})
}

// patchSignals — actions de modération du studio sur daemon_signals :
// {ids, status} (PENDING→APPROVED, →REJECTED…) ou {ids, delete:true}.
func (srv *Server) patchSignals(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
		Delete bool    `json:"delete"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		writeJSON(w, 400, map[string]any{"error": "body invalide : {ids:[], status?|delete?}"})
		return
	}
	ids := make([]store.ID, 0, len(body.IDs))
	for _, n := range body.IDs {
		ids = append(ids, store.ID(strconv.FormatInt(n, 10)))
	}
	var err error
	if body.Delete {
		err = srv.Client.DeleteSignals(ids)
	} else {
		status := strings.ToUpper(body.Status)
		switch status {
		case "PENDING", "APPROVED", "REJECTED", "IGNORED", "QUEUED", "PUBLISHED":
		default:
			writeJSON(w, 400, map[string]any{"error": "status invalide"})
			return
		}
		err = srv.Client.UpdateManySignals(ids, map[string]any{"status": status})
	}
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// CORS léger pour le dev (studio sur :2505 → daemon sur :2506). En prod, même domaine via reverse-proxy.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PATCH, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
