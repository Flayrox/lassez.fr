// Appels Gemini via l'API REST — pourquoi : le SDK Go google/generative-ai-go
// (v0.20.1, DERNIÈRE version) n'expose PAS l'outil google_search (grounding
// web) : son type Tool ne connaît que FunctionDeclarations et CodeExecution.
// L'API REST, elle, supporte nativement tools:[{google_search:{}}] — c'est le
// seul moyen propre de faire réellement chercher le modèle sur internet à
// chaque rédaction. Un seul chemin pour les 3 nœuds IA : température, topP,
// maxTokens, recherche web, sortie JSON structurée (mêmes capacités que le
// SDK, plus le grounding).
//
// Deux fournisseurs (providers) sont supportés, testés dans l'ordre :
//  1. Vertex AI / Gemini Enterprise Agent Platform (aiplatform.googleapis.com)
//     avec un compte de service Google Cloud — payant, « marche à coup sûr »,
//     SOURCE PRINCIPALE quand un compte est configuré.
//  2. AI Studio (generativelanguage.googleapis.com) avec une clé API — gratuit,
//     utilisé en repli si Vertex est absent ou échoue : le pipeline ne s'arrête
//     jamais.
package nodes

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const geminiRESTBase = "https://generativelanguage.googleapis.com/v1beta"

// Presets de génération par nœud — semi-dur : la base de référence si rien
// n'est configuré ailleurs. Regardés contre l'API Gemini :
//   - temperature 0 → déterministe ; 0.9-1.0 → créatif. Le Tri doit être
//     STRICT (0.1), la Rédaction CRÉATIVE (0.9).
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
	// editorThinking : budget de « raisonnement » (thinking tokens) de la
	// rédaction. Très élevé : l'IA raisonne longuement (avec Google Search)
	// avant d'écrire, ce qui remplace l'ancien nœud de validation — un seul
	// passage fait à la fois rédiger ET contrôler. Facturé en tokens de sortie.
	editorThinking = int32(16384)

	// Orchestrateur (chef de desk) : 1 appel/cycle, strict, thinking MOYEN —
	// il planifie et aiguille, la rédaction rédige (très élevé).
	orchestratorTemp      = float32(0.1)
	orchestratorTopP      = float32(0.9)
	orchestratorTokens    = int32(8192)
	orchestratorThinking  = int32(2048)
)

// geminiProvider — le fournisseur vers lequel part l'appel REST.
type geminiProvider int

const (
	providerStudio geminiProvider = iota // AI Studio : clé API + google_search
	providerVertex                       // Vertex AI : compte de service + googleSearch
)

// vertexConfig — connexion Vertex AI (Gemini Enterprise Agent Platform) :
// le compte de service Google Cloud fait foi (JSON téléchargé depuis la
// console), le project_id en est extrait, la région choisit l'endpoint.
type vertexConfig struct {
	ProjectID          string // extrait du JSON du compte de service (project_id)
	Region             string // "global" (recommandé) ou us-central1, europe-west1…
	ServiceAccountJSON string // contenu complet du fichier .json du compte de service
}

type geminiParams struct {
	apiKey          string
	model           string
	modelFallback   string         // modèle de repli si 429 (ex: 3.7 flash hors quota → flash-lite)
	system          string
	user            string
	temperature     float32
	topP            float32
	maxTokens       int32
	thinkingBudget  int32          // thinking tokens (raisonnement) — 0 = pas de raisonnement
	search          bool           // grounding Google Search (recherche web réelle)
	responseSchema  map[string]any // sortie JSON structurée (nil = texte libre)
	vertex          *vertexConfig  // secours Vertex AI (nil = pas de secours)
}

var geminiHTTPClient = &http.Client{Timeout: 120 * time.Second}

// buildGeminiBody — le corps JSON de l'appel REST, testable sans réseau.
// Les deux providers parlent le même protocole, mais avec des noms de champs
// et des outils différents : AI Studio accepte snake_case + google_search,
// Vertex exige camelCase + googleSearch.
func buildGeminiBody(p geminiParams, prov geminiProvider) map[string]any {
	gc := map[string]any{
		"temperature":     p.temperature,
		"topP":            p.topP,
		"maxOutputTokens": p.maxTokens,
		"candidateCount":  1,
	}
	if p.thinkingBudget > 0 {
		// reasoning de la réponse (thinkingConfig.thinkingBudget = nombre de
		// tokens de réflexion). 0 = réponse directe. Les deux fournisseurs
		// acceptent le même champ camelCase.
		gc["thinkingConfig"] = map[string]any{"thinkingBudget": p.thinkingBudget}
	}
	if p.responseSchema != nil {
		gc["responseMimeType"] = "application/json"
		gc["responseSchema"] = p.responseSchema
	}
	var body map[string]any
	if prov == providerVertex {
		body = map[string]any{
			"systemInstruction": map[string]any{"parts": []any{map[string]any{"text": p.system}}},
			"contents":          []any{map[string]any{"role": "user", "parts": []any{map[string]any{"text": p.user}}}},
			"generationConfig":  gc,
		}
		if p.search {
			// Vertex AI : le grounding Google Search porte un nom différent de
			// celui d'AI Studio (googleSearch, pas googleSearchRetrieval).
			body["tools"] = []any{map[string]any{"googleSearch": map[string]any{}}}
		}
		return body
	}
	body = map[string]any{
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
// Deux niveaux de repli pour ne JAMAIS stagner :
//
// Niveau 1 — le fournisseur : Vertex AI d'abord (compte de service, source
// principale) quand il est configuré, puis AI Studio si Vertex échoue pour
// n'importe quelle raison. Sans Vertex configuré, seul AI Studio est utilisé.
//
// Niveau 2 — dans chaque fournisseur :
//  1. La recherche web (grounding) échoue par quota (429) → on réessaie SANS
//     l'outil, l'IA travaille alors sur la matière première seule.
//  2. Le modèle est hors quota sur le compte → repli sur modelFallback.
func callGemini(ctx context.Context, p geminiParams) (string, error) {
	var fallbackErr error
	// Vertex AI d'abord (source principale) quand un compte de service est
	// configuré — fiable, ne dépend pas des crédits AI Studio. AI Studio reste
	// le repli système (gratuit) si Vertex échoue ou n'est pas configuré.
	if p.vertex != nil {
		text, err := callGeminiWithFallbacks(ctx, p, providerVertex)
		if err == nil {
			return text, nil
		}
		fallbackErr = err
		if p.apiKey == "" {
			return "", err
		}
		log.Printf("[Gemini] ⚠️ Vertex AI indisponible (%v) — bascule sur AI Studio.", err)
	} else if p.apiKey == "" {
		return "", fmt.Errorf("aucune configuration Gemini : ni compte de service Vertex AI ni clé AI Studio")
	}

	text, err := callGeminiWithFallbacks(ctx, p, providerStudio)
	if err != nil {
		if fallbackErr != nil {
			return "", fmt.Errorf("Vertex AI : %v — puis AI Studio : %v", fallbackErr, err)
		}
		return "", err
	}
	return text, nil
}

// callGeminiWithFallbacks — un fournisseur donné, avec les replis recherche
// web puis modèle de secours (les deux ne doivent jamais bloquer un cycle).
func callGeminiWithFallbacks(ctx context.Context, p geminiParams, prov geminiProvider) (string, error) {
	text, err := callGeminiRaw(ctx, p, prov)
	if err == nil || !isQuotaError(err) {
		return text, err
	}
	// 1. La recherche web peut être le facteur limitant → sans grounding.
	if p.search {
		p2 := p
		p2.search = false
		log.Printf("[Gemini] ⚠️ Recherche web indisponible (%v) — nouvel essai sans grounding.", err)
		text, err = callGeminiRaw(ctx, p2, prov)
		if err == nil || !isQuotaError(err) {
			return text, err
		}
	}
	// 2. Le modèle peut être hors quota sur ce compte → repli sur le modèle de secours.
	if p.modelFallback != "" && p.modelFallback != p.model {
		p3 := p
		p3.model = p.modelFallback
		p3.search = false
		log.Printf("[Gemini] ⚠️ Modèle %s hors quota (%v) — repli sur %s.", p.model, err, p.modelFallback)
		return callGeminiRaw(ctx, p3, prov)
	}
	return "", err
}

// callGeminiRaw — l'appel REST nu (sans fallback) vers le fournisseur donné.
func callGeminiRaw(ctx context.Context, p geminiParams, prov geminiProvider) (string, error) {
	raw, err := json.Marshal(buildGeminiBody(p, prov))
	if err != nil {
		return "", err
	}

	var endpoint string
	var req *http.Request
	if prov == providerVertex {
		if p.vertex == nil {
			return "", fmt.Errorf("configuration Vertex AI manquante")
		}
		tok, err := vertexAccessToken(ctx, p.vertex.ServiceAccountJSON)
		if err != nil {
			return "", err
		}
		// La région « global » n'a pas de préfixe d'hôte :
		// https://aiplatform.googleapis.com (les régions classiques, elles,
		// portent le préfixe : https://us-central1-aiplatform.googleapis.com).
		host := p.vertex.Region + "-aiplatform.googleapis.com"
		if p.vertex.Region == "global" {
			host = "aiplatform.googleapis.com"
		}
		endpoint = fmt.Sprintf("https://%s/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
			host, url.PathEscape(p.vertex.ProjectID), p.vertex.Region, url.PathEscape(p.model))
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+tok)
	} else {
		endpoint = fmt.Sprintf("%s/models/%s:generateContent", geminiRESTBase, url.PathEscape(p.model))
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
		if err != nil {
			return "", err
		}
		req.Header.Set("x-goog-api-key", p.apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

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
		// Ignore les parts « pensée » (thought:true) du mode raisonnement :
		// seul le texte final (le JSON) doit remonter au nœud.
		if part.Thought {
			continue
		}
		sb.WriteString(part.Text)
	}
	return strings.TrimSpace(sb.String()), nil
}

type geminiRESTResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text    string `json:"text"`
				Thought bool   `json:"thought"`
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

// ── Authentification Vertex AI : JWT signé → token OAuth2 (caché ~1 h) ──────
// Le compte de service Google Cloud s'authentifie sans mot de passe : on signe
// un JWT avec sa clé privée (RS256) et on l'échange contre un token d'accès
// court (1 h) auprès de oauth2.googleapis.com. Le token est réutilisé tant
// qu'il est valide — un seul échange par heure, pas un par appel.

var (
	vertexTokenMu sync.Mutex
	vertexToken   struct {
		sa    string // compte de service qui a produit le token (comparaison exacte)
		token string
		exp   time.Time
	}
)

// vertexAccessToken retourne un token OAuth2 valide pour le compte de service,
// en réutilisant le token en cache tant qu'il n'expire pas (5 min de marge).
func vertexAccessToken(ctx context.Context, saJSON string) (string, error) {
	vertexTokenMu.Lock()
	defer vertexTokenMu.Unlock()
	if vertexToken.sa == saJSON && vertexToken.token != "" && vertexToken.exp.After(time.Now().Add(5*time.Minute)) {
		return vertexToken.token, nil
	}
	tok, exp, err := fetchVertexToken(ctx, saJSON)
	if err != nil {
		return "", err
	}
	vertexToken = struct {
		sa    string
		token string
		exp   time.Time
	}{saJSON, tok, exp}
	return tok, nil
}

// fetchVertexToken — le vrai échange JWT → token OAuth2 (testé sans réseau).
func fetchVertexToken(ctx context.Context, saJSON string) (string, time.Time, error) {
	var sa struct {
		ClientEmail string `json:"client_email"`
		PrivateKey  string `json:"private_key"`
		TokenURI    string `json:"token_uri"`
	}
	if err := json.Unmarshal([]byte(saJSON), &sa); err != nil {
		return "", time.Time{}, fmt.Errorf("compte de service Vertex illisible (JSON invalide) : %v", err)
	}
	if sa.ClientEmail == "" || sa.PrivateKey == "" {
		return "", time.Time{}, fmt.Errorf("compte de service Vertex incomplet (client_email + private_key requis)")
	}
	tokenURI := sa.TokenURI
	if tokenURI == "" {
		tokenURI = "https://oauth2.googleapis.com/token"
	}

	// JWT RS256 signé avec la clé privée du compte de service.
	now := time.Now()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{
		"iss":   sa.ClientEmail,
		"scope": "https://www.googleapis.com/auth/cloud-platform",
		"aud":   tokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	})
	signingInput := header + "." + base64.RawURLEncoding.EncodeToString(claims)

	block, _ := pem.Decode([]byte(sa.PrivateKey))
	if block == nil {
		return "", time.Time{}, fmt.Errorf("clé privée Vertex illisible (PEM invalide)")
	}
	key, err := parseRSAPrivateKey(block.Bytes)
	if err != nil {
		return "", time.Time{}, err
	}
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", time.Time{}, err
	}
	assertion := signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", time.Time{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := geminiHTTPClient.Do(req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1_000_000))
	if err != nil {
		return "", time.Time{}, err
	}

	var tr struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(respBody, &tr); err != nil {
		return "", time.Time{}, fmt.Errorf("réponse token Vertex illisible (%d) : %s", resp.StatusCode, truncate(string(respBody), 200))
	}
	if tr.AccessToken == "" {
		return "", time.Time{}, fmt.Errorf("token Vertex refusé : %s %s", tr.Error, tr.ErrorDesc)
	}
	exp := time.Now().Add(time.Hour)
	if tr.ExpiresIn > 0 {
		exp = time.Now().Add(time.Duration(tr.ExpiresIn) * time.Second)
	}
	return tr.AccessToken, exp, nil
}

func parseRSAPrivateKey(der []byte) (*rsa.PrivateKey, error) {
	if k, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		rk, ok := k.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("clé privée Vertex non-RSA")
		}
		return rk, nil
	}
	if k, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return k, nil
	}
	return nil, fmt.Errorf("clé privée Vertex illisible (PKCS8 ou PKCS1 attendue)")
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

// PingVertex — test de connectivité pour le bouton « Tester Vertex AI » du
// studio (POST /api/vertex/test) : MÊME chemin que le pipeline (REST +
// grounding googleSearch), via le compte de service.
func PingVertex(ctx context.Context, vc *vertexConfig) (latencyMs int64, reply string, err error) {
	start := time.Now()
	text, err := callGemini(ctx, geminiParams{
		vertex:      vc,
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

// schemaOrchestrator — Chef de desk : une décision par sujet de la liste
// (keep/drop + aiguillage format/zone/angle).
func schemaOrchestrator() map[string]any {
	item := jsonObj(map[string]any{
		"id":       jsonStr("L'id du sujet, exactement tel que fourni dans la liste"),
		"decision": jsonStr("keep (à traiter) ou drop (à écarter)"),
		"taxonomy": jsonStr("Un des ids de CATÉGORIES DISPONIBLES (obligatoire si keep)"),
		"geo":      jsonStr("france ou international (obligatoire si keep)"),
		"angle":    jsonStr("L'angle à prendre, une phrase (obligatoire si keep)"),
		"reason":   jsonStr("Justification du choix"),
	}, []string{"id", "decision"})
	return jsonObj(map[string]any{
		"decisions": map[string]any{"type": "array", "description": "Une entrée par sujet de la liste, sans omission ni invention", "items": item},
	}, []string{"decisions"})
}
