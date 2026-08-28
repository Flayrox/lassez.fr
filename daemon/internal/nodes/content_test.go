package nodes

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mmcdole/gofeed"
)

// TestFetchFullContent récupère un VRAI article (premier lien d'un flux RSS
// public) et vérifie qu'on obtient un texte substantiel — pas juste un titre.
// Skip si le réseau est indisponible (CI, machine hors ligne).
func TestFetchFullContent(t *testing.T) {
	fp := gofeed.NewParser()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	feed, err := fp.ParseURLWithContext("https://www.rfi.fr/en/rss", ctx)
	if err != nil {
		t.Skipf("réseau indisponible (flux RFI) : %v", err)
	}
	if len(feed.Items) == 0 {
		t.Skip("flux RFI vide")
	}
	url := feed.Items[0].Link
	if url == "" {
		t.Skip("article sans URL")
	}

	fctx, fcancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer fcancel()
	text, err := fetchFullContent(fctx, url)
	if err != nil {
		t.Skipf("fetch réel indisponible (%s) : %v", url, err)
	}
	if len(text) < minContentChars {
		t.Errorf("contenu trop court : %d caractères (min %d)", len(text), minContentChars)
	}
	if !strings.Contains(text, " ") {
		t.Errorf("contenu suspect (pas de phrases) : %.80s", text)
	}
	t.Logf("OK : %d caractères depuis %s", len(text), url)
}

// TestBuildSourceMaterial vérifie la structure du bloc « matière première » :
// extraits + biais + confiance présents, et un fetch qui échoue ne casse rien.
func TestBuildSourceMaterial(t *testing.T) {
	articles := []IngestedArticle{
		{Title: "Un sujet test", URL: "http://127.0.0.1:1/impossible", SourceName: "SourceA", SourceBias: "Droite", TrustScore: 3, Content: "Extrait court de l'article A."},
		{Title: "Un autre sujet", URL: "https://www.rfi.fr/en/culture", SourceName: "SourceB", SourceBias: "Indépendant", TrustScore: 9, Content: "Extrait plus long de l'article B, avec un peu plus de matière pour la démonstration."},
	}
	material := buildSourceMaterial(articles)
	if material == "" {
		t.Fatal("matière première vide")
	}
	for _, want := range []string{"MATIÈRE PREMIÈRE", "SourceB", "Biais de la source : Droite", "Confiance : 9/10", "Extrait RSS"} {
		if !strings.Contains(material, want) {
			t.Errorf("matière première sans « %s » :\n%s", want, material)
		}
	}
	// Le tri par confiance place SourceB (9) devant SourceA (3).
	if strings.Index(material, "SourceB") > strings.Index(material, "SourceA") {
		t.Errorf("tri par confiance incorrect : SourceB (9) devrait précéder SourceA (3)")
	}
	// Le fetch échoue proprement (URL injoignable) → pas de crash, pas de bloc
	// CONTENU COMPLET fantôme.
	if strings.Contains(material, "CONTENU COMPLET (SourceA") {
		t.Errorf("contenu complet récupéré sur une URL injoignable ?!\n%s", material)
	}
}

// TestBuildSourceMaterialVide — pas d'articles → pas de bloc.
func TestBuildSourceMaterialVide(t *testing.T) {
	if m := buildSourceMaterial(nil); m != "" {
		t.Errorf("matière première attendue vide, obtenu : %q", m)
	}
}
