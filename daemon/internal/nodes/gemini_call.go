// Appels Gemini via l'API REST — pourquoi : le SDK Go google/generative-ai-go
// (v0.20.1, DERNIÈRE version) n'expose PAS l'outil google_search (grounding
// web) : son type Tool ne connaît que FunctionDeclarations et CodeExecution.
// L'API REST, elle, supporte nativement tools:[{google_search:{}}] — c'est le
// seul moyen propre de faire réellement chercher le modèle sur internet à
// chaque rédaction. Un seul chemin pour les 3 nœuds IA : température, topP,
// maxTokens, recherche web, sortie JSON structurée (mêmes capacités que le
// SDK, plus le grounding).
package nodes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const geminiRESTBase = "https://generativelanguage.googleapis.com/v1beta"

// Presets de génération par nœud — semi-dur : la base de référence si rien
// n'est configuré ailleurs. Regardés contre l'API Gemini :
//   - temperature 0 → déterministe ; 0.9-1.0 → créatif. Le Tri et la
//     Vérification doivent être STRICTS (0.1), la Rédaction CRÉATIVE (0.9).
//   - topP : nucleus sampling — 0.9/0.95 = garde ~90/95% des tokens les plus
//     probables (réduit les réponses hors-sujet).
//   - maxOutputTokens : les brouillons L'Assez (headline + body + requêtes
//     image + tags) peuvent être longs → 8192 pour la rédaction.
const (
	researchTemp   = float32(0.1)
	researchTopP   = float32(0.9)
	researchTokens = int32(1024)

	editorTemp   = float32(0.9)
	editorTopP   = float32(0.95)
	editorTokens = int32(8192)

	validatorTemp   = float32(0.1)
	validatorTopP   = float32(0.9)
	validatorTokens = int32(2048)
)

type geminiParams struct {
	apiKey         string
	model          string
	system         string
	user           string
	temperature    float32
	topP           float32
	maxTokens      int32
	search         bool           // grounding Google Search (recherche web réelle)
	responseSchema map[string]any // sortie JSON structurée (nil = texte libre)
}

var geminiHTTPClient = &http.Client{Timeout: 120 * time.Second}

// buildGeminiBody — le corps JSON de l'appel REST, testable sans réseau.
func buildGeminiBody(p geminiParams) map[string]any {
	gc := map[string]any{
		"temperature":    p.temperature,
		"topP":           p.topP,
		"maxOutputTokens": p.maxTokens,
		"candidateCount": 1,
	}
	if p.responseSchema != nil {
		gc["responseMimeType"] = "application/json"
		gc["responseSchema"] = p.responseSchema
	}
	body := map[string]any{
		"system_instruction": map[string]any{"parts": []any{map[string]any{"text": p.system}}},
		"contents":           []any{map[string]any{"role": "user", "parts": []any{map[string]any{"text": p.user}}}},
		"generationConfig":   gc,
	}
	if p.search {
		// Grounding Google Search : le modèle fait de VRAIES recherches web
		// pendant la génération et peut citer ses sources.
		body["tools"] = []any{map[string]any{"google_search": map[string]any{}}}
	}
	return body
}

// callGemini exécute un appel génération, retourne le texte produit.
func callGemini(ctx context.Context, p geminiParams) (string, error) {
	raw, err := json.Marshal(buildGeminiBody(p))
	if err != nil {
		return "", err
	}
	endpoint := fmt.Sprintf("%s/models/%s:generateContent", geminiRESTBase, url.PathEscape(p.model))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", p.apiKey)

	resp, err := geminiHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2_000_000))
	if err != nil {
		return "", err
	}

	var r geminiRESTResponse
	if err := json.Unmarshal(respBody, &r); err != nil {
		return "", fmt.Errorf("réponse Gemini illisible (%d) : %s", resp.StatusCode, truncate(string(respBody), 300))
	}
	if r.Error != nil {
		return "", fmt.Errorf("gemini %d: %s", r.Error.Code, r.Error.Message)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini HTTP %d : %s", resp.StatusCode, truncate(string(respBody), 300))
	}
	if len(r.Candidates) == 0 || len(r.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("réponse Gemini vide")
	}
	var sb strings.Builder
	for _, part := range r.Candidates[0].Content.Parts {
		sb.WriteString(part.Text)
	}
	return strings.TrimSpace(sb.String()), nil
}

type geminiRESTResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// PingGemini — test de connectivité utilisé par le bouton « Tester la clé »
// du studio (POST /api/gemini/test) : MÊME chemin que le pipeline (REST +
// grounding google_search), pour valider exactement ce que feront les nœuds.
func PingGemini(ctx context.Context, apiKey string) (latencyMs int64, reply string, err error) {
	start := time.Now()
	text, err := callGemini(ctx, geminiParams{
		apiKey:      apiKey,
		model:       "gemini-3.5-flash-lite",
		system:      "Tu es un assistant de test. Réponds uniquement par le mot : OK",
		user:        "Test de connexion.",
		temperature: 0,
		topP:        0.9,
		maxTokens:   32,
		search:      true,
	})
	if err != nil {
		return 0, "", err
	}
	return time.Since(start).Milliseconds(), strings.TrimSpace(text), nil
}

// ── Schémas de sortie JSON (structured output, mêmes contrats qu'avant) ──

func jsonObj(props map[string]any, required []string) map[string]any {
	return map[string]any{"type": "object", "properties": props, "required": required}
}
func jsonStr(desc string) map[string]any   { return map[string]any{"type": "string", "description": desc} }
func jsonBool(desc string) map[string]any  { return map[string]any{"type": "boolean", "description": desc} }
func jsonArr(desc string) map[string]any {
	return map[string]any{"type": "array", "description": desc, "items": map[string]any{"type": "string"}}
}

// schemaResearcher — Tri : approbation + score 0-100 + raison + catégorie.
func schemaResearcher() map[string]any {
	return jsonObj(map[string]any{
		"approved":          jsonBool("true si le sujet mérite d'être traité, false sinon"),
		"score":             map[string]any{"type": "integer", "description": "Note 0-100 (≥ scoreThreshold = accepté)"},
		"reason":            jsonStr("Justification du verdict"),
		"suggestedTaxonomy": jsonStr("Un des ids de CATÉGORIES DISPONIBLES ci-dessus"),
		"suggestedGeo":      jsonStr("france ou international"),
	}, []string{"approved", "score", "reason"})
}

// schemaEditorialist — Rédaction : le brouillon complet (schéma des formats).
func schemaEditorialist() map[string]any {
	return jsonObj(map[string]any{
		"taxonomie":            jsonStr("La catégorie choisie (FLASH, CITATION, ALERTE, DÉCRYPTAGE, INFO)"),
		"geo":                  jsonStr("Zone géographique (france / international)"),
		"tags":                 jsonArr("Mots-clés et thématiques"),
		"headline":             jsonStr("Titre percutant au style L'Assez"),
		"body":                 jsonStr("Corps complet du post (respecte le format de la catégorie)"),
		"image_search_queries": jsonArr("1 à 3 requêtes d'image selon la méthode des Tirs"),
		"metadata":             jsonObj(map[string]any{"accent_color": jsonStr("Couleur du format")}, []string{"accent_color"}),
	}, []string{"taxonomie", "geo", "tags", "headline", "body"})
}

// schemaValidator — Vérification : verdict + corrections + raison.
func schemaValidator() map[string]any {
	return jsonObj(map[string]any{
		"isValid":     jsonBool("true si validé, false sinon"),
		"corrections": jsonStr("Le texte corrigé si nécessaire"),
		"reason":      jsonStr("Justification du verdict de validation"),
	}, []string{"isValid", "reason"})
}
