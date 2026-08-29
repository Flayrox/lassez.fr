// Endpoint de test Gemini — le studio (Système → Clé API Gemini) vérifie que la
// clé qu'il vient de coller est valide, avec un VRAI appel API sur le même
// chemin que le pipeline (REST + grounding Google Search via nodes.PingGemini).
// La clé est résolue par le même chemin que les nœuds IA (secrets studio →
// .secrets.yaml → GeminiAPIKey), donc un succès ici = Tri / Rédaction /
// Vérification tourneront au prochain cycle.
package api

import (
	"net/http"

	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
)

// testGemini — POST /api/gemini/test → {ok:true, latencyMs, reply}
// ou {ok:false, error}. Toujours 200 : l'échec est une donnée métier que l'UI
// affiche, pas une panne HTTP.
func (srv *Server) testGemini(w http.ResponseWriter, r *http.Request) {
	key := nodes.GeminiAPIKey(srv.Resolver, "research")
	if key == "" {
		writeJSON(w, 200, map[string]any{
			"ok":    false,
			"error": "Aucune clé Gemini configurée. Colle ta clé dans Système → Clé API Gemini, puis enregistre.",
		})
		return
	}

	latency, reply, err := nodes.PingGemini(r.Context(), key)
	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{
		"ok":        true,
		"model":     "gemini-3.5-flash-lite",
		"latencyMs": latency,
		"reply":     reply,
	})
}

// testVertex — POST /api/vertex/test → {ok:true, latencyMs, reply, project,
// region, model} ou {ok:false, error}. Teste le secours Vertex AI (compte de
// service Google Cloud) sur le MÊME chemin que le pipeline, recherche web
// comprise.
func (srv *Server) testVertex(w http.ResponseWriter, r *http.Request) {
	vc := nodes.VertexAIConfig(srv.Resolver)
	if vc == nil {
		writeJSON(w, 200, map[string]any{
			"ok":    false,
			"error": "Aucun compte de service Vertex AI configuré. Colle le JSON dans Système → Vertex AI (secours), puis enregistre.",
		})
		return
	}

	latency, reply, err := nodes.PingVertex(r.Context(), vc)
	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{
		"ok":        true,
		"model":     "gemini-3.5-flash-lite",
		"latencyMs": latency,
		"reply":     reply,
		"project":   vc.ProjectID,
		"region":    vc.Region,
	})
}
