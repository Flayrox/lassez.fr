package nodes

import (
	"testing"
)

// TestBuildGeminiBodyRechercheWeb — l'outil google_search (grounding) est
// attaché quand search=true : c'est ce qui fait réellement chercher le modèle
// sur internet à chaque appel.
func TestBuildGeminiBodyRechercheWeb(t *testing.T) {
	body := buildGeminiBody(geminiParams{
		apiKey: "K", model: "gemini-x", system: "S", user: "U",
		temperature: 0.9, topP: 0.95, maxTokens: 8192, search: true,
		responseSchema: schemaEditorialist(),
	})
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
	})
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
