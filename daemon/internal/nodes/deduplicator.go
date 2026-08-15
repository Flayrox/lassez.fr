package nodes

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

// mergedTopic mirrors the TS MergedTopic persisted in raw_data.
type mergedTopic struct {
	ClusterTitle   string            `json:"clusterTitle"`
	Articles       []IngestedArticle `json:"articles"`
	AggregatedBias []string          `json:"aggregatedBias"`
	Date           time.Time         `json:"date"`
}

// RunDeduplicator is Node 2 of the pipeline: clusters the ingested articles
// by title similarity, drops historical duplicates and persists the new
// topics as INGESTED signals.
func RunDeduplicator(client *payload.Client, resolver *config.Resolver, articles []IngestedArticle) error {
	log.Printf("[Node 2: Deduplicator] 🧩 Tamisage sur %d articles bruts.", len(articles))
	if len(articles) == 0 {
		return nil
	}

	threshold := 0.45
	if v := resolver.GetEffectiveParam("dedup", "similarityThreshold", 0.45); v != nil {
		threshold = toFloat64(v, 0.45)
	}

	// 1. Clustering by title similarity.
	var clusters []mergedTopic
	for _, article := range articles {
		found := false
		for i := range clusters {
			if compareTwoStrings(strings.ToLower(article.Title), strings.ToLower(clusters[i].ClusterTitle)) >= threshold {
				clusters[i].Articles = append(clusters[i].Articles, article)
				if article.SourceBias != "" && !containsString(clusters[i].AggregatedBias, article.SourceBias) {
					clusters[i].AggregatedBias = append(clusters[i].AggregatedBias, article.SourceBias)
				}
				found = true
				break
			}
		}
		if !found {
			bias := []string{"Indépendant"}
			if article.SourceBias != "" {
				bias = []string{article.SourceBias}
			}
			date := article.PubDate
			if date.IsZero() {
				date = time.Now()
			}
			clusters = append(clusters, mergedTopic{
				ClusterTitle:   article.Title,
				Articles:       []IngestedArticle{article},
				AggregatedBias: bias,
				Date:           date,
			})
		}
	}

	log.Printf("[Node 2: Deduplicator] 📉 %d articles compilés en %d sujets.", len(articles), len(clusters))

	// 2. Historical deduplication against existing signals.
	lookbackHours := 48.0
	if v := resolver.GetEffectiveParam("dedup", "dedupLookbackHours", float64(48)); v != nil {
		lookbackHours = toFloat64(v, 48)
	}
	cutoff := time.Now().Add(-time.Duration(lookbackHours) * time.Hour)

	historicalTitles := []string{}
	if historical, err := client.GetSignalsSince(cutoff); err != nil {
		log.Printf("[Node 2] ❌ Lecture historique: %v", err)
	} else {
		for _, h := range historical {
			var raw struct {
				ClusterTitle string `json:"clusterTitle"`
			}
			if err := json.Unmarshal(h.RawData, &raw); err == nil && raw.ClusterTitle != "" {
				historicalTitles = append(historicalTitles, strings.ToLower(raw.ClusterTitle))
			}
		}
	}

	// 3. Persist new topics.
	var toCreate []map[string]any
	saved, ignored := 0, 0
	for _, cluster := range clusters {
		current := strings.ToLower(cluster.ClusterTitle)
		duplicate := false
		for _, h := range historicalTitles {
			if compareTwoStrings(current, h) >= threshold*0.8 {
				duplicate = true
				break
			}
		}
		if duplicate {
			ignored++
			continue
		}

		rawJSON, err := json.Marshal(cluster)
		if err != nil {
			continue
		}
		toCreate = append(toCreate, map[string]any{
			"raw_data": string(rawJSON),
			"status":   "INGESTED",
			"tags":     "[]",
		})
		saved++
	}

	if len(toCreate) > 0 {
		if err := client.CreateSignals(toCreate); err != nil {
			log.Printf("[Node 2] ❌ Insertion Payload: %v", err)
		}
	}

	log.Printf("[Node 2: Deduplicator] ✅ %d Signals injectés (%d doublons historiques rejetés).", saved, ignored)
	return nil
}
