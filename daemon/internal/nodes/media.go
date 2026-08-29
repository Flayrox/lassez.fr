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

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
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
func RunMedia(client *store.Client, resolver *config.Resolver) error {
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
	// Identifiants de la recherche d'images officielle Google (Custom Search
	// JSON API) — optionnelle : si absente, on retombe sur Wikimedia Commons.
	cseKey, cseID := GoogleCSEConfig(resolver)
	if cseKey != "" && cseID != "" {
		log.Printf("📸 [Node 6: Media] 🔎 Recherche d'images Google officielle configurée (Custom Search API).")
	} else {
		log.Printf("📸 [Node 6: Media] ℹ️ Pas de clé Custom Search API — repli Wikimedia Commons pour les images.")
	}
	log.Printf("📸 [Node 6: Media] %d sujets prêts pour l'enrichissement média.", len(topics))

	var (
		wg  sync.WaitGroup
		sem = make(chan struct{}, 2)
	)

	for _, topic := range topics {
		wg.Add(1)
		sem <- struct{}{}
		go func(topic store.Signal) {
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
				// 1. Google Images (scraping HTML) — parfois bloqué (consentement,
				//    CAPTCHA), on ne s'y fie pas.
				images, err := googleImageSearch(context.Background(), q)
				if err != nil {
					log.Printf("📸 [Node 6: Media] ⚠️ Google Images indisponible sur \"%s\" : %v", q, err)
				}
				for _, img := range images {
					if isUsableImageURL(img.URL) {
						selected = img.URL
						break
					}
				}
				// 1b. API officielle Google Images (Custom Search JSON API) —
				//     fiable, 100 requêtes/jour gratuites, si configurée.
				if selected == "" && cseKey != "" && cseID != "" {
					cseImages, cseErr := googleCseImageSearch(context.Background(), cseKey, cseID, q)
					if cseErr != nil {
						log.Printf("📸 [Node 6: Media] ⚠️ Custom Search API indisponible sur \"%s\" : %v", q, cseErr)
					} else {
						for _, img := range cseImages {
							if isUsableImageURL(img.URL) {
								selected = img.URL
								log.Printf("📸 [Node 6: Media] ✅ Image Google officielle pour [%s] (\"%s\")", topic.ID, q)
								break
							}
						}
					}
				}
				// 2. Repli : Wikimedia Commons (API JSON libre, sans clé, photos de
				//    presse sous licence libre) — fiable quand Google bloque.
				if selected == "" {
					wmImages, wmErr := wikimediaImageSearch(context.Background(), q)
					if wmErr != nil {
						log.Printf("📸 [Node 6: Media] ⚠️ Wikimedia indisponible sur \"%s\" : %v", q, wmErr)
					} else {
						for _, img := range wmImages {
							if isUsableImageURL(img.URL) {
								selected = img.URL
								log.Printf("📸 [Node 6: Media] ✅ Image Wikimedia pour [%s] (\"%s\")", topic.ID, q)
								break
							}
						}
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
// googleCseImageSearch — recherche d'images via l'API officielle Google
// (Custom Search JSON API). Gratuit : 100 requêtes/jour (1 requête = jusqu'à
// 10 résultats). Il faut une clé API (Google Cloud Console, sans facturation)
// + un « Programmable Search Engine » (cx) avec la recherche d'images activée
// sur tout le web.
func googleCseImageSearch(ctx context.Context, apiKey, cseID, query string) ([]imageResult, error) {
	apiURL := "https://www.googleapis.com/customsearch/v1?key=" + url.QueryEscape(apiKey) +
		"&cx=" + url.QueryEscape(cseID) +
		"&searchType=image&num=6&safe=active&q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := mediaHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(body, &e)
		return nil, fmt.Errorf("customsearch %d: %s", resp.StatusCode, e.Error.Message)
	}
	var r struct {
		Items []struct {
			Link string `json:"link"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("réponse Custom Search illisible : %v", err)
	}
	var results []imageResult
	for _, item := range r.Items {
		if item.Link != "" {
			results = append(results, imageResult{URL: item.Link})
		}
	}
	return results, nil
}

// wikimediaImageSearch — recherche d'images sur Wikimedia Commons via son API
// JSON (action=query + generator=search sur l'espace Fichier). Gratuit, sans
// clé, fiable : c'est le repli quand le scraping Google Images est bloqué
// (consentement, CAPTCHA, HTML différent). Les images sont sous licence libre
// (attribution requise — le studio affiche le crédit au besoin).
func wikimediaImageSearch(ctx context.Context, query string) ([]imageResult, error) {
	apiURL := "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search" +
		"&gsrnamespace=6&gsrlimit=6&gsrsearch=" + url.QueryEscape(query) +
		"&prop=imageinfo&iiprop=url&iiurlwidth=1280"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "LAssezStudio/1.0 (daemon de publication du site lassez.fr)")

	resp, err := mediaHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wikimedia status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	var r struct {
		Query struct {
			Pages map[string]struct {
				Title      string `json:"title"`
				ImageInfo []struct {
					URL      string `json:"url"`
					ThumbURL string `json:"thumburl"`
				} `json:"imageinfo"`
			} `json:"pages"`
		} `json:"query"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("réponse Wikimedia illisible : %v", err)
	}
	var results []imageResult
	for _, page := range r.Query.Pages {
		for _, ii := range page.ImageInfo {
			u := ii.ThumbURL
			if u == "" {
				u = ii.URL
			}
			if strings.HasPrefix(u, "http") {
				results = append(results, imageResult{URL: u})
			}
		}
	}
	return results, nil
}

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

// isUsableImageURL — l'URL pointe vers une vraie image web (et pas un PDF,
// une vidéo, un SVG… ni un domaine banni). Les résultats Wikimedia incluent
// parfois des fichiers non-image (PDF, .ogv…).
func isUsableImageURL(u string) bool {
	if isBannedImageURL(u) {
		return false
	}
	lower := strings.ToLower(u)
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"} {
		if strings.Contains(lower, ext) {
			return true
		}
	}
	return false
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
