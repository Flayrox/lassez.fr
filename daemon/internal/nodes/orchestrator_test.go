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
	p := buildOrchestratorPrompt("SYSTÈME", "CRITÈRES", "CATÉGORIES", topics, nil)
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
	p := buildOrchestratorPrompt("S", "R", "", topics, nil)
	if !strings.Contains(p, "id=7") {
		t.Errorf("id absent du prompt : %s", p)
	}
	if strings.Contains(p, "Extrait :") {
		t.Errorf("pas d'extrait attendu sans articles : %s", p)
	}
}

// TestBuildOrchestratorPromptMemory — la mémoire éditoriale est bien injectée
// dans le prompt (les titres publiés récents apparaissent).
func TestBuildOrchestratorPromptMemory(t *testing.T) {
	memory := []store.MemoryEntry{
		{Headline: "Retailleau annonce des baisses d'impôts", Taxonomy: "ALERTE", PublishedAt: "2026-08-01T10:00:00Z"},
	}
	p := buildOrchestratorPrompt("S", "R", "", nil, memory)
	for _, want := range []string{"MÉMOIRE ÉDITORIALE", "Retailleau annonce des baisses d'impôts", "[ALERTE]", "2026-08-01"} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt ne contient pas la mémoire %q", want)
		}
	}
}

// TestSanitizeTaxonomyRepli — un id inconnu retombe sur le PREMIER format
// actif de la liste (jamais un format désactivé), et sur INFO seulement si
// la liste des formats est vide.
func TestSanitizeTaxonomyRepli(t *testing.T) {
	templates := []store.TaxonomyTemplate{
		{Name: "FLASH"},
		{Name: "ALERTE"},
	}
	if got := sanitizeTaxonomy("ALERTE", templates); got != "ALERTE" {
		t.Errorf("id connu mal reconnu : %q", got)
	}
	if got := sanitizeTaxonomy("INFO", templates); got != "FLASH" {
		t.Errorf("repli attendu sur le premier format actif (FLASH), obtenu %q", got)
	}
	if got := sanitizeTaxonomy("", templates); got != "FLASH" {
		t.Errorf("repli vide attendu FLASH, obtenu %q", got)
	}
	if got := sanitizeTaxonomy("DÉCRYPTAGE", nil); got != "INFO" {
		t.Errorf("sans template, repli INFO attendu, obtenu %q", got)
	}
}
