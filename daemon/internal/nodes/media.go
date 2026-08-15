package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"time"
	"strings"
	"sync"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

// bannedDomains mirrors the TS media node's blocked image sources. Matching
// is done on the hostname (see isBannedImageURL), so substrings like "x.com"
// can never ban unrelated domains (e.g. "example.com").
var bannedDomains = []string{
	"instagram.com", "facebook.com", "pinterest.com", "tiktok.com", "twitter.com", "x.com",
}

// mediaHTTPClient gives the Google scrape a hard timeout (http.DefaultClient
// has none and could hang the media node forever).
var mediaHTTPClient = &http.Client{Timeout: 20 * time.Second}

type imageResult struct {
	URL string
}

// RunMedia is Node 6 of the pipeline: it assigns a royalty-free illustration
// to VALIDATED signals, then moves them to PENDING.
func RunMedia(client *payload.Client, resolver *config.Resolver) error {
	log.Printf("\n📸 [Node 6: Media] Démarrage de la recherche d'images (OSINT / Google Images)")

	topics, err := client.GetSignalsByStatus("VALIDATED")
	if err != nil {
		return err
	}
	if len(topics) == 0 {
		log.Printf("📸 [Node 6: Media] ℹ️ Aucun topic en statut VALIDATED à traiter.")
		return nil
	}

	allowGlobalImages := true
	if v := resolver.GetEffectiveParam("media", "allowSourceImages", true); v != nil {
		allowGlobalImages = toBool(v, true)
	}
	log.Printf("📸 [Node 6: Media] %d sujets prêts pour l'enrichissement média.", len(topics))

	var (
		wg  sync.WaitGroup
		sem = make(chan struct{}, 2)
	)

	for _, topic := range topics {
		wg.Add(1)
		sem <- struct{}{}
		go func(topic payload.Signal) {
			defer wg.Done()
			defer func() { <-sem }()

			if len(topic.FinalDraft) == 0 {
				log.Printf("📸 [Node 6: Media] ⚠️ Sujet %s sans final_draft, ignoré.", topic.ID)
				return
			}

			if !allowGlobalImages {
				log.Printf("📸 [Node 6: Media] ⚠️ allowSourceImages désactivé. Passage direct en PENDING.")
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "PENDING"})
				return
			}

			raw := struct {
				Articles []struct {
					AllowSourceImages bool   `json:"allowSourceImages"`
					SourceName        string `json:"source_name"`
				} `json:"articles"`
			}{}
			_ = json.Unmarshal(topic.RawData, &raw)

			if len(raw.Articles) > 0 && !raw.Articles[0].AllowSourceImages {
				log.Printf("📸 [Node 6: Media] 🚫 Source \"%s\" interdit les images. Passage en PENDING.", raw.Articles[0].SourceName)
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "PENDING"})
				return
			}

			var draft struct {
				ImageSearchQueries []string `json:"image_search_queries"`
			}
			_ = json.Unmarshal(topic.FinalDraft, &draft)

			queries := draft.ImageSearchQueries
			if len(queries) == 0 {
				queries = nonEmpty([]string{topic.ImageURL, topic.Taxonomy, "investigation"})
			}

			selected := ""
			for _, q := range queries {
				log.Printf("📸 [Node 6: Media] 🎯 Recherche pour [%s] : \"%s\"", topic.ID, q)
				images, err := googleImageSearch(context.Background(), q)
				if err != nil {
					log.Printf("📸 [Node 6: Media] ⚠️ Recherche indisponible sur \"%s\" : %v", q, err)
					continue
				}
				for _, img := range images {
					if !isBannedImageURL(img.URL) {
						selected = img.URL
						break
					}
				}
				if selected != "" {
					break
				}
			}

			if selected != "" {
				log.Printf("📸 [Node 6: Media] ✅ Image assignée pour [%s]", topic.ID)
				_ = client.UpdateSignal(topic.ID, map[string]any{"image_url": selected, "status": "PENDING"})
			} else {
				log.Printf("📸 [Node 6: Media] ℹ️ Aucune image trouvée. PENDING avec visuel par défaut.")
				_ = client.UpdateSignal(topic.ID, map[string]any{"status": "PENDING"})
			}
		}(topic)
	}
	wg.Wait()

	log.Printf("📸 [Node 6: Media] Traitement des médias terminé.")
	return nil
}

// googleImageSearch performs a best-effort Google Images HTML scrape. Google
// may block scrapers; callers must treat failures as "no image found".
func googleImageSearch(ctx context.Context, query string) ([]imageResult, error) {
	searchURL := "https://www.google.com/search?q=" + url.QueryEscape(query) + "&tbm=isch"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := mediaHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google status %d", resp.StatusCode)
	}
	html, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}

	re := regexp.MustCompile(`"ou":"(.*?)"`)
	var results []imageResult
	for _, m := range re.FindAllStringSubmatch(string(html), -1) {
		if len(m) < 2 {
			continue
		}
		u := strings.ReplaceAll(m[1], `\/`, "/")
		u = strings.ReplaceAll(u, `\u003d`, "=")
		u = strings.ReplaceAll(u, `\u0026`, "&")
		if strings.HasPrefix(u, "http") {
			results = append(results, imageResult{URL: u})
		}
	}
	return results, nil
}

func isBannedImageURL(u string) bool {
	parsed, err := url.Parse(u)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	host = strings.TrimPrefix(host, "www.")
	for _, b := range bannedDomains {
		if host == b || strings.HasSuffix(host, "."+b) {
			return true
		}
	}
	return false
}

func nonEmpty(items []string) []string {
	var out []string
	for _, s := range items {
		if strings.TrimSpace(s) != "" {
			out = append(out, s)
		}
	}
	return out
}

func toBool(v any, def bool) bool {
	switch t := v.(type) {
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		return t == "true"
	}
	return def
}
