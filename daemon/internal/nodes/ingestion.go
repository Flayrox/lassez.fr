// Package nodes contains the pipeline nodes. Node 1 (ingestion) pulls
// configured RSS / Google News feeds and returns the new articles.
package nodes

import (
	"encoding/json"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mmcdole/gofeed"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

// IngestedArticle is a freshly ingested article, ready for deduplication.
// JSON tags mirror the TS IngestedArticle so raw_data stays compatible.
type IngestedArticle struct {
	Title             string    `json:"title"`
	URL               string    `json:"url"`
	Content           string    `json:"content"`
	PubDate           time.Time `json:"pubDate"`
	SourceName        string    `json:"source_name"`
	SourceBias        string    `json:"source_bias"`
	TrustScore        int       `json:"trust_score"`
	AllowSourceImages bool      `json:"allowSourceImages"`
}

type sourceToProcess struct {
	URL               string
	Type              string
	SourceName        string
	SourceBias        string
	TrustScore        int
	AllowSourceImages bool
}

// RunIngestion is Node 1 of the pipeline. It pulls the configured sources
// (sources collection + rss_feeds + google_news_queries from radar-settings)
// over a time window and returns the new, unseen articles.
func RunIngestion(client *payload.Client, resolver *config.Resolver) ([]IngestedArticle, error) {
	timeWindowHours := 12.0
	if v := resolver.GetEffectiveParam("ingestion", "rss_lookback_hours", float64(12)); v != nil {
		timeWindowHours = toFloat64(v, 12)
	}

	log.Printf("[Node 1: Ingestion] 🌐 Démarrage de l'aspiration (fenêtre: %.0fh)", timeWindowHours)

	settings, err := client.GetSettings()
	if err != nil {
		return nil, err
	}

	var sources []sourceToProcess

	// 1. Sources permanentes (collection sources).
	dbSources, err := client.GetActiveSources()
	if err != nil {
		log.Printf("[Node 1] ❌ Lecture des sources Payload: %v", err)
	}
	for _, s := range dbSources {
		sources = append(sources, sourceToProcess{
			URL:               s.URL,
			Type:              s.Type,
			SourceName:        s.SourceName,
			SourceBias:        s.SourceBias,
			TrustScore:        s.TrustScore,
			AllowSourceImages: s.AllowSourceImages,
		})
	}

	// 2. Flux RSS depuis radar-settings (rss_feeds).
	for _, feedURL := range parseStringArray(settings["rss_feeds"]) {
		if containsSource(sources, feedURL) {
			continue
		}
		host := feedURL
		if u, err := url.Parse(feedURL); err == nil {
			host = u.Hostname()
		}
		sources = append(sources, sourceToProcess{
			URL:               feedURL,
			Type:              "RSS",
			SourceName:        host,
			SourceBias:        "Indépendant",
			TrustScore:        8,
			AllowSourceImages: true,
		})
	}

	// 3. Requêtes Google News (google_news_queries).
	for _, query := range parseStringArray(settings["google_news_queries"]) {
		feedURL := "https://news.google.com/rss/search?q=" + url.QueryEscape(query) + "&hl=fr&gl=FR&ceid=FR:fr"
		sources = append(sources, sourceToProcess{
			URL:               feedURL,
			Type:              "GOOGLE_NEWS",
			SourceName:        "GNews: " + query,
			SourceBias:        "Multiple",
			TrustScore:        7,
			AllowSourceImages: false,
		})
	}

	if len(sources) == 0 {
		log.Printf("[Node 1: Ingestion] ⚠️ Aucune source configurée.")
		return nil, nil
	}

	cutoff := time.Now().Add(-time.Duration(timeWindowHours) * time.Hour)

	// Purge des URL observées de plus de 7 jours.
	_ = client.PurgeSeenURLs(time.Now().Add(-7 * 24 * time.Hour))

	seen := map[string]bool{}
	if urls, err := client.GetSeenURLs(); err == nil {
		for _, u := range urls {
			seen[u] = true
		}
	}

	parser := gofeed.NewParser()

	var (
		mu       sync.Mutex
		articles []IngestedArticle
		newSeen  []string
		wg       sync.WaitGroup
		sem      = make(chan struct{}, 5)
	)

	for _, src := range sources {
		wg.Add(1)
		sem <- struct{}{}
		go func(src sourceToProcess) {
			defer wg.Done()
			defer func() { <-sem }()

			feed, err := parser.ParseURL(src.URL)
			if err != nil {
				log.Printf("[Node 1] ❌ Erreur d'aspiration %s (%s): %v", src.SourceName, src.URL, err)
				return
			}

			for _, item := range feed.Items {
				if item.Link == "" || item.Title == "" {
					continue
				}
				pub := item.PublishedParsed
				if pub == nil {
					now := time.Now()
					pub = &now
				}
				if pub.Before(cutoff) {
					continue
				}

				mu.Lock()
				if !seen[item.Link] {
					seen[item.Link] = true
					newSeen = append(newSeen, item.Link)
					articles = append(articles, IngestedArticle{
						Title:             strings.TrimSpace(item.Title),
						URL:               item.Link,
						Content:           snippet(item),
						PubDate:           *pub,
						SourceName:        src.SourceName,
						SourceBias:        src.SourceBias,
						TrustScore:        src.TrustScore,
						AllowSourceImages: src.AllowSourceImages,
					})
				}
				mu.Unlock()
			}
		}(src)
	}
	wg.Wait()

	if len(newSeen) > 0 {
		if err := client.AddSeenURLs(newSeen); err != nil {
			log.Printf("[Node 1] ❌ Enregistrement des URL vues: %v", err)
		}
	}

	log.Printf("[Node 1: Ingestion] ✅ Aspiration terminée: %d nouveaux articles.", len(articles))
	return articles, nil
}

// snippet mirrors rss-parser's contentSnippet || content || title.
func snippet(item *gofeed.Item) string {
	if item.Description != "" {
		return item.Description
	}
	if item.Content != "" {
		return item.Content
	}
	return item.Title
}

func parseStringArray(v any) []string {
	s, ok := v.(string)
	if !ok || s == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil
	}
	return out
}

func containsSource(sources []sourceToProcess, feedURL string) bool {
	for _, s := range sources {
		if s.URL == feedURL {
			return true
		}
	}
	return false
}

func toFloat64(v any, def float64) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case json.Number:
		f, err := t.Float64()
		if err == nil {
			return f
		}
	}
	return def
}
