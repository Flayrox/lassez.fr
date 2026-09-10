package api

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMediaProxyValidation(t *testing.T) {
	srv := &Server{Mux: http.NewServeMux()}
	srv.Mux.HandleFunc("GET /api/media/proxy", srv.mediaProxy)

	cases := []struct {
		name  string
		query string
		code  int
	}{
		{"manquant", "", 400},
		{"scheme non http", "url=ftp://example.com/a.png", 400},
		{"relative", "url=/local/a.png", 400},
		{"boucle ipv4", "url=http://127.0.0.1/a.png", 403},
		{"boucle ipv6", "url=http://[::1]/a.png", 403},
		{"localhost", "url=https://localhost/a.png", 403},
		{"rfc1918 10/8", "url=http://10.0.0.5/a.png", 403},
		{"rfc1918 192.168", "url=http://192.168.1.1/a.png", 403},
		{"rfc1918 172.16", "url=http://172.16.9.9/a.png", 403},
		{"lien-local", "url=http://169.254.169.254/x", 403},
		{"suffixe .local", "url=http://cdn.local/a.png", 403},
		{"suffixe .test", "url=http://cdn.test/a.png", 403},
		{"userinfo", "url=https://user:pass@example.com/a.png", 400},
		{"hôte inexistant (fail-closed)", "url=https://inexistant-xyz-12345.invalid/a.png", 403},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/media/proxy?"+tc.query, nil)
			rec := httptest.NewRecorder()
			srv.Mux.ServeHTTP(rec, req)
			if rec.Code != tc.code {
				t.Fatalf("code = %d, want %d (body: %s)", rec.Code, tc.code, rec.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("réponse non JSON : %v", err)
			}
			if _, ok := body["error"]; !ok {
				t.Fatalf("champ error manquant : %v", body)
			}
		})
	}
}

func TestIsPrivateHostLookup(t *testing.T) {
	old := lookupIP
	defer func() { lookupIP = old }()

	t.Run("IP publique résolue → autorisé", func(t *testing.T) {
		lookupIP = func(_ context.Context, _ string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		}
		if isPrivateHost("cdn.example.com") {
			t.Fatal("hôte public classé privé")
		}
	})

	t.Run("IP privée résolue → refusé", func(t *testing.T) {
		lookupIP = func(_ context.Context, _ string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("10.9.9.9")}, nil
		}
		if !isPrivateHost("intranet.example.com") {
			t.Fatal("hôte privé non bloqué")
		}
	})

	t.Run("échec DNS → refusé (fail-closed), sans panic", func(t *testing.T) {
		lookupIP = func(_ context.Context, _ string) ([]net.IP, error) {
			return nil, context.DeadlineExceeded
		}
		if !isPrivateHost("down.example.com") {
			t.Fatal("échec DNS non refusé")
		}
	})
}

func TestMediaProxySuccess(t *testing.T) {
	old := mediaAllowPrivate
	mediaAllowPrivate = true
	defer func() { mediaAllowPrivate = old }()

	png := []byte{137, 80, 78, 71, 13, 10, 26, 10, 0, 0}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/photo.png" {
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(png)
			return
		}
		if r.URL.Path == "/page.html" {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html></html>"))
			return
		}
		w.WriteHeader(404)
	}))
	defer upstream.Close()

	srv := &Server{Mux: http.NewServeMux()}
	srv.Mux.HandleFunc("GET /api/media/proxy", srv.mediaProxy)
	get := func(target string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/media/proxy?url="+target, nil)
		rec := httptest.NewRecorder()
		srv.Mux.ServeHTTP(rec, req)
		return rec
	}

	t.Run("relaye le binaire avec content-type et cache", func(t *testing.T) {
		rec := get(upstream.URL + "/photo.png")
		if rec.Code != 200 {
			t.Fatalf("code = %d, want 200", rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "image/png" {
			t.Fatalf("content-type = %q", ct)
		}
		if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "max-age=86400") {
			t.Fatalf("cache-control = %q", cc)
		}
		if body, _ := io.ReadAll(rec.Result().Body); string(body) != string(png) {
			t.Fatalf("corps altéré (%d octets)", len(body))
		}
	})

	t.Run("refuse les types non médias", func(t *testing.T) {
		rec := get(upstream.URL + "/page.html")
		if rec.Code != 415 {
			t.Fatalf("code = %d, want 415", rec.Code)
		}
	})

	t.Run("amont 404 → 502", func(t *testing.T) {
		rec := get(upstream.URL + "/manquant.png")
		if rec.Code != 502 {
			t.Fatalf("code = %d, want 502", rec.Code)
		}
	})
}

func TestMediaProxyTooLarge(t *testing.T) {
	old := mediaAllowPrivate
	mediaAllowPrivate = true
	defer func() { mediaAllowPrivate = old }()
	oldMax := mediaMaxBytes
	mediaMaxBytes = 8
	defer func() { mediaMaxBytes = oldMax }()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("0123456789abcdef"))
	}))
	defer upstream.Close()

	srv := &Server{Mux: http.NewServeMux()}
	srv.Mux.HandleFunc("GET /api/media/proxy", srv.mediaProxy)
	req := httptest.NewRequest(http.MethodGet, "/api/media/proxy?url="+upstream.URL+"/big.png", nil)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	// Le serveur amont annonce Content-Length: 16 > plafond 8 → 413 direct.
	if rec.Code != 413 {
		t.Fatalf("code = %d, want 413", rec.Code)
	}
}
