package api

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Proxy médias du studio Slide : les exports PNG doivent embarquer les images
// externes en dataURL (html-to-image refuse les canvas "taintés" CORS).
// Le navigateur ne peut pas les lire directement (CORS/COEP) → le daemon les
// relaye. Garde-fou SSRF : http(s) uniquement, hôtes privés/bouclage refusés,
// types image/vidéo uniquement, taille plafonnée.
//
//	GET /api/media/proxy?url=https://… → binaire (content-type d'origine)

var (
	mediaHTTPClient = &http.Client{Timeout: 15 * time.Second}
	// Surchargé en tests (réseau local).
	mediaAllowPrivate = false
	mediaMaxBytes     = int64(25 << 20) // 25 Mo
)

func (srv *Server) mediaProxy(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("url"))
	if raw == "" {
		writeJSON(w, 400, map[string]any{"error": "paramètre url manquant"})
		return
	}
	target, err := url.Parse(raw)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" {
		writeJSON(w, 400, map[string]any{"error": "URL http(s) absolue requise"})
		return
	}
	if target.User != nil {
		writeJSON(w, 400, map[string]any{"error": "userinfo interdit dans l'URL"})
		return
	}
	if !mediaAllowPrivate {
		host := strings.ToLower(target.Hostname())
		if isPrivateHost(host) {
			writeJSON(w, 403, map[string]any{"error": "hôte privé ou local interdit"})
			return
		}
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, target.String(), nil)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": "requête invalide"})
		return
	}
	req.Header.Set("User-Agent", "LassezStudio/1.0 (media-proxy)")
	req.Header.Set("Accept", "image/*,video/*,*/*;q=0.1")

	resp, err := mediaHTTPClient.Do(req)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": fmt.Sprintf("amont injoignable : %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, 502, map[string]any{"error": fmt.Sprintf("amont HTTP %d", resp.StatusCode)})
		return
	}
	if resp.ContentLength > mediaMaxBytes {
		writeJSON(w, 413, map[string]any{"error": "fichier trop volumineux"})
		return
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	base := strings.ToLower(strings.TrimSpace(strings.SplitN(ct, ";", 2)[0]))
	if !strings.HasPrefix(base, "image/") && !strings.HasPrefix(base, "video/") {
		writeJSON(w, 415, map[string]any{"error": fmt.Sprintf("type non média : %s", base)})
		return
	}

	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(200)
	_, _ = io.Copy(w, io.LimitReader(resp.Body, mediaMaxBytes+1))
}

// Résolution DNS injectable (tests déterministes, sans réseau).
var lookupIP = func(ctx context.Context, host string) ([]net.IP, error) {
	return net.DefaultResolver.LookupIP(ctx, "ip", host)
}

// isPrivateHost refuse bouclage, RFC1918, lien-local, donné brut ou résolu.
// La résolution DNS reste best-effort : échec → refus (fail-closed).
func isPrivateHost(host string) bool {
	if host == "" || host == "localhost" {
		return true
	}
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()
	}
	// Nom se terminant en .local / .internal / .invalid / .test → privé.
	lower := strings.ToLower(host)
	for _, suffix := range []string{".local", ".internal", ".invalid", ".test", ".localhost"} {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	ips, err := lookupIP(ctx, host)
	if err != nil || len(ips) == 0 {
		return true
	}
	for _, ip := range ips {
		if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
			return true
		}
	}
	return false
}
