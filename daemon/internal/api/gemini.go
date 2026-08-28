// Endpoint de test Gemini — le labo (Système → Clé API Gemini) vérifie que la
// clé qu'il vient de coller est valide, avec un VRAI appel API sur un modèle
// léger. La clé est résolue par le même chemin que le pipeline (secrets
// studio → .secrets.yaml → GeminiAPIKey), donc un succès ici = les nœuds IA
// (Tri / Rédaction / Vérification) tourneront au prochain cycle.
package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
)

// testGemini — POST /api/gemini/test → {ok:true, model, latencyMs, reply}
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

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	ai, err := genai.NewClient(ctx, option.WithAPIKey(key))
	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "error": "Client Gemini : " + err.Error()})
		return
	}
	defer ai.Close()

	// Même modèle léger que le défaut du Researcher — le plus proche du chemin réel.
	model := ai.GenerativeModel("gemini-3.5-flash-lite")
	model.SetTemperature(0)
	start := time.Now()
	resp, err := model.GenerateContent(ctx, genai.Text("Réponds uniquement par le mot : OK"))
	latency := time.Since(start)
	if err != nil {
		writeJSON(w, 200, map[string]any{
			"ok":    false,
			"error": strings.TrimSpace(err.Error()),
		})
		return
	}

	reply := ""
	for _, c := range resp.Candidates {
		for _, p := range c.Content.Parts {
			if t, ok := p.(genai.Text); ok {
				reply += string(t)
			}
		}
	}
	writeJSON(w, 200, map[string]any{
		"ok":        true,
		"model":     "gemini-3.5-flash-lite",
		"latencyMs": latency.Milliseconds(),
		"reply":     strings.TrimSpace(reply),
	})
}
