// Package api — petit serveur HTTP du daemon : le labo (labo.lassez.fr) lui parle.
// Stdlib net/http uniquement. Routes :
//
//	GET  /api/healthz          → vivant
//	GET  /api/signals          → ?status=PENDING&geo=france&q=...&limit=100
//	PATCH /api/signals         → {"ids":[1,2],"status":"APPROVED"} ou {"ids":[..],"delete":true}
package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
	"github.com/Flayrox/LASSEZ/daemon/internal/store"
)

type Server struct {
	Store      *store.Store
	Client     *payload.Client // santé des sources + futur accès signaux daemon_*
	Mux        *http.ServeMux
	ConfigPath string          // config/config.yaml — édité par le labo
	Resolver   *config.Resolver // invalidé après chaque écriture
}

func New(s *store.Store, client *payload.Client, cfgPath string, resolver *config.Resolver) *Server {
	srv := &Server{Store: s, Client: client, Mux: http.NewServeMux(), ConfigPath: cfgPath, Resolver: resolver}
	srv.Mux.HandleFunc("GET /api/healthz", srv.healthz)
	srv.Mux.HandleFunc("GET /api/signals", srv.listSignals)
	srv.Mux.HandleFunc("PATCH /api/signals", srv.patchSignals)
	srv.Mux.HandleFunc("GET /api/config", srv.getConfig)
	srv.Mux.HandleFunc("PATCH /api/config", srv.patchConfig)
	srv.Mux.HandleFunc("GET /api/secrets", srv.getSecrets)
	srv.Mux.HandleFunc("PATCH /api/secrets", srv.patchSecrets)
	srv.Mux.HandleFunc("GET /api/sources-health", srv.listSourceHealth)
	return srv
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

func (srv *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (srv *Server) listSignals(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	signals, err := srv.Store.ListSignals(q.Get("status"), q.Get("geo"), q.Get("q"), limit)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	counts, _ := srv.Store.Counts()
	writeJSON(w, 200, map[string]any{"data": signals, "counts": counts})
}

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
	var err error
	if body.Delete {
		err = srv.Store.Delete(body.IDs)
	} else {
		status := strings.ToUpper(body.Status)
		if status != "PENDING" && status != "APPROVED" && status != "PUBLISHED" && status != "IGNORED" {
			writeJSON(w, 400, map[string]any{"error": "status invalide"})
			return
		}
		err = srv.Store.UpdateStatus(body.IDs, status)
	}
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// CORS léger pour le dev (labo sur :2505 → daemon sur :2506). En prod, même domaine via reverse-proxy.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS")
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
