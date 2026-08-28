package nodes

import (
	"strings"
	"testing"
)

// TestBuildResearchPromptBiais — le prompt du researcher doit contenir les
// VRAIS articles du sujet avec leur biais et leur confiance, pour que la règle
// CRITICAL_CROSSCHECK puisse s'appliquer (elle était morte : jamais alimentée).
func TestBuildResearchPromptBiais(t *testing.T) {
	raw := struct {
		ClusterTitle string            `json:"clusterTitle"`
		Articles     []IngestedArticle `json:"articles"`
	}{
		ClusterTitle: "Un gouvernement attaque une ONG",
		Articles: []IngestedArticle{
			{Title: "L'ONG dénoncée", SourceName: "cnews", SourceBias: "Extrême-Droite", TrustScore: 3, Content: "L'ONG gaspille l'argent public, selon des sources anonymes."},
			{Title: "L'ONG répond", SourceName: "mediapart", SourceBias: "Indépendant", TrustScore: 9, Content: "L'ONG publie ses comptes et démonte les accusations."},
		},
	}
	prompt := buildResearchPrompt("SYSTEM", "REJET", "", "", raw)
	for _, want := range []string{
		"Un gouvernement attaque une ONG",
		"cnews", "Biais de la source : Extrême-Droite", "Confiance : 3/10",
		"mediapart", "Biais de la source : Indépendant", "Confiance : 9/10",
		"CRITICAL_CROSSCHECK", "RÈGLE DU BIAIS",
	} {
		if !strings.Contains(prompt, want) {
			t.Errorf("prompt sans « %s » :\n%s", want, prompt)
		}
	}
}

// TestBuildResearchPromptSansArticles — pas d'articles → mention explicite,
// pas de panique.
func TestBuildResearchPromptSansArticles(t *testing.T) {
	raw := struct {
		ClusterTitle string            `json:"clusterTitle"`
		Articles     []IngestedArticle `json:"articles"`
	}{ClusterTitle: "Titre seul"}
	prompt := buildResearchPrompt("S", "R", "", "", raw)
	if !strings.Contains(prompt, "Aucun article brut associé") {
		t.Errorf("mention d'absence d'articles attendue :\n%s", prompt)
	}
}
