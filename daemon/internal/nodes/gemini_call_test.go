package nodes

import (
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
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
)

// TestBuildGeminiBodyRechercheWeb — l'outil google_search (grounding) est
// attaché quand search=true : c'est ce qui fait réellement chercher le modèle
// sur internet à chaque appel.
func TestBuildGeminiBodyRechercheWeb(t *testing.T) {
	body := buildGeminiBody(geminiParams{
		apiKey: "K", model: "gemini-x", system: "S", user: "U",
		temperature: 0.9, topP: 0.95, maxTokens: 8192, search: true,
		responseSchema: schemaEditorialist(),
	}, providerStudio)
	tools, ok := body["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("tools attendu : %v", body["tools"])
	}
	first, ok := tools[0].(map[string]any)
	if !ok || first["google_search"] == nil {
		t.Fatalf("outil google_search attendu : %v", tools[0])
	}

	gc := body["generationConfig"].(map[string]any)
	if gc["temperature"] != float32(0.9) {
		t.Errorf("temperature attendue 0.9, obtenu %v", gc["temperature"])
	}
	if gc["maxOutputTokens"] != int32(8192) {
		t.Errorf("maxOutputTokens attendu 8192, obtenu %v", gc["maxOutputTokens"])
	}
	if gc["responseMimeType"] != "application/json" {
		t.Errorf("responseMimeType attendu application/json, obtenu %v", gc["responseMimeType"])
	}
	if _, ok := gc["responseSchema"].(map[string]any); !ok {
		t.Errorf("responseSchema attendu, obtenu %v", gc["responseSchema"])
	}
}

// TestBuildGeminiBodySansRecherche — search=false → aucun outil, et le
// système/le contenu user sont bien séparés (system_instruction).
func TestBuildGeminiBodySansRecherche(t *testing.T) {
	body := buildGeminiBody(geminiParams{
		apiKey: "K", model: "gemini-x", system: "SYSTÈME", user: "USER",
		search: false,
	}, providerStudio)
	if _, ok := body["tools"]; ok {
		t.Errorf("tools ne doit pas exister sans recherche : %v", body["tools"])
	}
	sys := body["system_instruction"].(map[string]any)
	parts := sys["parts"].([]any)
	text := parts[0].(map[string]any)["text"]
	if text != "SYSTÈME" {
		t.Errorf("system_instruction attendu SYSTÈME, obtenu %v", text)
	}
	contents := body["contents"].([]any)
	first := contents[0].(map[string]any)
	if first["role"] != "user" {
		t.Errorf("role user attendu, obtenu %v", first["role"])
	}
}

// TestBuildGeminiBodyVertex — le corps pour Vertex AI est en camelCase
// (systemInstruction) et porte l'outil googleSearchRetrieval : c'est ce qui
// fait chercher le modèle sur internet sur le chemin payant fiable.
func TestBuildGeminiBodyVertex(t *testing.T) {
	body := buildGeminiBody(geminiParams{
		apiKey: "K", model: "gemini-x", system: "S", user: "U", search: true,
		responseSchema: schemaResearcher(),
	}, providerVertex)
	if _, ok := body["system_instruction"]; ok {
		t.Errorf("Vertex ne doit PAS utiliser system_instruction (snake_case) : %v", body["system_instruction"])
	}
	sys, ok := body["systemInstruction"].(map[string]any)
	if !ok {
		t.Fatalf("systemInstruction camelCase attendu : %v", body)
	}
	parts := sys["parts"].([]any)
	if parts[0].(map[string]any)["text"] != "S" {
		t.Errorf("systemInstruction texte attendu S, obtenu %v", parts[0])
	}
	tools, ok := body["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("tools attendu : %v", body["tools"])
	}
	first, ok := tools[0].(map[string]any)
	if !ok || first["googleSearchRetrieval"] == nil {
		t.Fatalf("outil googleSearchRetrieval attendu : %v", tools[0])
	}
	gc := body["generationConfig"].(map[string]any)
	if gc["responseMimeType"] != "application/json" {
		t.Errorf("responseMimeType attendu application/json, obtenu %v", gc["responseMimeType"])
	}
}

// TestFetchVertexToken — l'échange JWT → token OAuth2 complet, sans réseau :
// une clé RSA générée, un faux serveur de token qui vérifie la signature du
// JWT, et le token récupéré doit être celui du serveur.
func TestFetchVertexToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})

	var ts *httptest.Server
	ts = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("form illisible : %v", err)
		}
		if got := r.Form.Get("grant_type"); got != "urn:ietf:params:oauth:grant-type:jwt-bearer" {
			t.Errorf("grant_type attendu jwt-bearer, obtenu %q", got)
		}
		assertion := r.Form.Get("assertion")
		parts := strings.Split(assertion, ".")
		if len(parts) != 3 {
			t.Fatalf("assertion JWT mal formée (%d segments)", len(parts))
		}
		// Vérifie la signature RS256 du JWT avec la clé publique.
		sig, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			t.Fatalf("signature JWT illisible : %v", err)
		}
		digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], sig); err != nil {
			t.Fatalf("signature JWT invalide : %v", err)
		}
		// Le JWT doit demander le scope cloud-platform et l'audience = token_uri.
		claimsRaw, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]any
		_ = json.Unmarshal(claimsRaw, &claims)
		if claims["scope"] != "https://www.googleapis.com/auth/cloud-platform" {
			t.Errorf("scope cloud-platform attendu, obtenu %v", claims["scope"])
		}
		if claims["aud"] != ts.URL {
			t.Errorf("audience = token_uri attendue, obtenue %v", claims["aud"])
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-123", "expires_in": 3599})
	}))
	defer ts.Close()

	saJSON := fmt.Sprintf(`{"client_email":"robot@proj.iam.gserviceaccount.com","private_key":%q,"token_uri":%q}`, string(pemKey), ts.URL)
	tok, exp, err := fetchVertexToken(context.Background(), saJSON)
	if err != nil {
		t.Fatal(err)
	}
	if tok != "tok-123" {
		t.Errorf("token attendu tok-123, obtenu %s", tok)
	}
	if !exp.After(time.Now()) {
		t.Errorf("expiration du token dans le passé")
	}
}

// TestFetchVertexTokenErreur — un JSON invalide ou une clé PEM cassée doivent
// renvoyer une erreur claire, pas un crash.
func TestFetchVertexTokenErreur(t *testing.T) {
	if _, _, err := fetchVertexToken(context.Background(), "pas du json"); err == nil {
		t.Errorf("JSON invalide doit échouer")
	}
	if _, _, err := fetchVertexToken(context.Background(), `{"client_email":"a@b","private_key":"pas une clé"}`); err == nil {
		t.Errorf("clé PEM invalide doit échouer")
	}
}

// TestVertexAIConfig — la résolution du secours depuis les settings : sans
// compte de service → nil (pas de secours) ; avec → project_id extrait du
// JSON et région par défaut « global ».
func TestVertexAIConfig(t *testing.T) {
	saJSON := `{"project_id":"lassez-prod-123","client_email":"r@x","private_key":"k"}`
	resolver := config.NewResolverFromProvider(func() (map[string]any, error) {
		return map[string]any{"vertexServiceAccount": saJSON}, nil
	})
	vc := VertexAIConfig(resolver)
	if vc == nil {
		t.Fatal("vertex config attendue")
	}
	if vc.ProjectID != "lassez-prod-123" {
		t.Errorf("project_id attendu lassez-prod-123, obtenu %s", vc.ProjectID)
	}
	if vc.Region != "global" {
		t.Errorf("région par défaut global attendue, obtenue %s", vc.Region)
	}
	if vc.ServiceAccountJSON != saJSON {
		t.Errorf("le JSON du compte de service doit être conservé")
	}

	resolver2 := config.NewResolverFromProvider(func() (map[string]any, error) {
		return map[string]any{"vertexRegion": "europe-west1"}, nil
	})
	if vc2 := VertexAIConfig(resolver2); vc2 != nil {
		t.Errorf("sans compte de service → nil attendu, obtenu %+v", vc2)
	}
}

// TestBuildGeminiBodyPresets — les presets par nœud respectent les contrats :
// Tri/Vérification strictes (basse température), Rédaction créative (haute).
func TestBuildGeminiBodyPresets(t *testing.T) {
	if researchTemp != 0.1 || validatorTemp != 0.1 {
		t.Errorf("Tri et Vérification doivent être strictes (temp 0.1) : research=%v validator=%v", researchTemp, validatorTemp)
	}
	if editorTemp < 0.8 {
		t.Errorf("Rédaction doit être créative (temp ≥ 0.8) : %v", editorTemp)
	}
	if editorTokens < 4096 {
		t.Errorf("Rédaction doit pouvoir produire de longs brouillons : %v tokens", editorTokens)
	}
}
