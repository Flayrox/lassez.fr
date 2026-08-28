// Récupération du contenu COMPLET des articles — la « matière première » des
// nœuds IA. Avant ceci, le pipeline ne transmettait aux modèles que le titre
// du cluster (le mergedTopic persisté ne contenait ni excerpt ni
// source_content) : le researcher et l'éditorialiste travaillaient à
// l'aveugle. Ici on lit le vrai texte de l'article (go-readability), avec
// timeout, limite de taille et repli propre sur l'extrait RSS en cas d'échec
// (paywall, page JS, réseau…).
package nodes

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/go-shiori/go-readability"
)

const (
	// maxFetchBytes : HTML brut maximum téléchargé par article (1,5 Mo).
	maxFetchBytes = 1_500_000
	// maxContentChars : texte lisible conservé par article (~12k caractères).
	maxContentChars = 12_000
	// minContentChars : en dessous, on considère le fetch comme un échec
	// (page de login, contenu rendu en JS, page vide…).
	minContentChars = 300
	// fullFetchLimit : nombre d'articles dont on récupère le contenu complet
	// par sujet (les meilleures sources d'abord).
	fullFetchLimit = 2
	// snippetLimit : taille maximale d'un extrait RSS injecté dans le prompt.
	snippetLimit = 600
)

var fetchClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        12,
		MaxIdleConnsPerHost: 4,
		IdleConnTimeout:     45 * time.Second,
	},
}

// fetchFullContent retourne le texte lisible d'un article, ou une erreur
// (réseau, HTTP ≠ 200, HTML illisible, contenu trop court). L'appelant garde
// l'extrait RSS en repli — le fetch ne doit jamais bloquer le pipeline.
func fetchFullContent(ctx context.Context, pageURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LassezBot/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr,fr-FR;q=0.9,en;q=0.8")

	resp, err := fetchClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFetchBytes))
	if err != nil {
		return "", err
	}
	parsedURL, err := url.Parse(pageURL)
	if err != nil {
		return "", err
	}
	article, err := readability.FromReader(strings.NewReader(string(body)), parsedURL)
	if err != nil {
		return "", err
	}
	text := strings.TrimSpace(article.TextContent)
	if len(text) < minContentChars {
		return "", fmt.Errorf("contenu trop court (%d caractères)", len(text))
	}
	if len(text) > maxContentChars {
		text = text[:maxContentChars]
	}
	return text, nil
}

// buildSourceMaterial construit la section « MATIÈRE PREMIÈRE » d'un sujet :
// les extraits RSS de tous les articles (avec biais + confiance de chaque
// source), puis le contenu COMPLET des meilleures sources (confiance la plus
// haute), récupéré en direct. Vide si le sujet n'a pas d'articles.
func buildSourceMaterial(articles []IngestedArticle) string {
	if len(articles) == 0 {
		return ""
	}
	sorted := append([]IngestedArticle(nil), articles...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].TrustScore > sorted[j].TrustScore })

	var sb strings.Builder
	sb.WriteString("\n\nMATIÈRE PREMIÈRE (les articles réels du sujet) :\n")
	for i, a := range sorted {
		if i >= 8 {
			sb.WriteString("… (autres articles du sujet non listés)\n")
			break
		}
		sb.WriteString(fmt.Sprintf("--- Article %d : %s (%s)\n", i+1, orTitle(a.Title), orSource(a.SourceName)))
		sb.WriteString(fmt.Sprintf("Biais de la source : %s | Confiance : %d/10\n", orBias(a.SourceBias), a.TrustScore))
		snip := strings.TrimSpace(a.Content)
		if len(snip) > snippetLimit {
			snip = snip[:snippetLimit] + "…"
		}
		if snip != "" {
			sb.WriteString("Extrait RSS : " + snip + "\n")
		}
	}

	// Contenu complet des meilleures sources — la vraie matière de rédaction.
	fetched := 0
	for _, a := range sorted {
		if fetched >= fullFetchLimit {
			break
		}
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		full, err := fetchFullContent(ctx, a.URL)
		cancel()
		if err != nil || full == "" {
			log.Printf("[Editorialist] ⚠️ Contenu complet indisponible (%s) : %v", a.URL, err)
			continue
		}
		fetched++
		sb.WriteString(fmt.Sprintf("\n=== CONTENU COMPLET (%s, %s) ===\n%s\n", orSource(a.SourceName), a.URL, full))
	}
	return sb.String()
}
