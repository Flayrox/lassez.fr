package nodes

import (
	"strings"
	"testing"

	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

// TestBuildOrchestratorPrompt — le prompt du chef de desk liste bien tous les
// sujets (id + titre + source) avec les critères et la consigne JSON.
func TestBuildOrchestratorPrompt(t *testing.T) {
	topics := []store.Signal{
		{
			ID: store.ID("1"),
			RawData: []byte(`{"clusterTitle":"Grève des transports","articles":[{"title":"Grève","source_name":"Mediapart","trust_score":9,"content":"Les transports sont à l'arrêt."}]}`),
		},
		{ID: store.ID("2"), RawData: []byte(`{"clusterTitle":"","articles":[]}`)},
	}
	p := buildOrchestratorPrompt("SYSTÈME", "CRITÈRES", "CATÉGORIES", topics)
	for _, want := range []string{"SYSTÈME", "CRITÈRES", "CATÉGORIES", "id=1", "id=2", "Grève des transports", "Mediapart", `"decisions"`} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt ne contient pas %q", want)
		}
	}
}

// TestBuildOrchestratorPromptEmpty — sans articles, le prompt reste valide
// (titre seul) et n'omet aucun id.
func TestBuildOrchestratorPromptEmpty(t *testing.T) {
	topics := []store.Signal{
		{ID: store.ID("7"), RawData: []byte(`{"clusterTitle":"Sujet nu","articles":[]}`)},
	}
	p := buildOrchestratorPrompt("S", "R", "", topics)
	if !strings.Contains(p, "id=7") {
		t.Errorf("id absent du prompt : %s", p)
	}
	if strings.Contains(p, "Extrait :") {
		t.Errorf("pas d'extrait attendu sans articles : %s", p)
	}
}
