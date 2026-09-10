package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

// Serveur de test adossé à une vraie base temporaire (le fichier des
// templates en dérive, comme en prod).
func newSlideTemplateTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	client, err := store.NewLocal(
		filepath.Join(dir, "pipeline.db"),
		func() (map[string]any, error) { return map[string]any{}, nil },
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	srv := &Server{Client: client, Mux: http.NewServeMux()}
	srv.Mux.HandleFunc("GET /api/slide-templates", srv.listSlideTemplates)
	srv.Mux.HandleFunc("POST /api/slide-templates", srv.upsertSlideTemplate)
	srv.Mux.HandleFunc("DELETE /api/slide-templates", srv.deleteSlideTemplate)
	return srv
}

func postTemplate(t *testing.T, srv *Server, body string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/slide-templates", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestSlideTemplatesCRUD(t *testing.T) {
	srv := newSlideTemplateTestServer(t)

	// Liste vide au départ.
	req := httptest.NewRequest(http.MethodGet, "/api/slide-templates", nil)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"templates":[]`) {
		t.Fatalf("liste initiale = %d %s", rec.Code, rec.Body.String())
	}

	// Création.
	code, out := postTemplate(t, srv, `{"template":{
		"name": "Ma couv", "category": "Éditorial", "baseType": "cover",
		"format": "1:1", "templateState": {"headline": "H"}, "layers": [],
		"thumbnail": "data:image/jpeg;base64,xx"}}`)
	if code != 200 {
		t.Fatalf("create = %d %v", code, out)
	}
	tpl := out["template"].(map[string]any)
	if tpl["name"] != "Ma couv" || tpl["baseType"] != "COVER" {
		t.Fatalf("template renvoyé : %v", tpl)
	}
	id, _ := tpl["id"].(string)
	if id == "" {
		t.Fatal("id non généré")
	}

	// Liste : tri updated DESC, 1 élément.
	req = httptest.NewRequest(http.MethodGet, "/api/slide-templates", nil)
	rec = httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	if !strings.Contains(rec.Body.String(), "Ma couv") {
		t.Fatalf("liste après create : %s", rec.Body.String())
	}

	// Upsert même id (update, created_at conservé).
	created := tpl["createdAt"]
	code, out = postTemplate(t, srv, `{"template":{
		"id": "`+id+`", "name": "Ma couv v2", "baseType": "NEWS",
		"templateState": {}, "layers": []}}`)
	if code != 200 {
		t.Fatalf("upsert = %d %v", code, out)
	}
	if out["template"].(map[string]any)["createdAt"] != created {
		t.Fatal("createdAt non conservé à l'update")
	}

	// Suppression puis 404.
	req = httptest.NewRequest(http.MethodDelete, "/api/slide-templates?id="+id, nil)
	rec = httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("delete = %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	if rec.Code != 404 {
		t.Fatalf("re-delete = %d, want 404", rec.Code)
	}
}

func TestSlideTemplatesValidation(t *testing.T) {
	srv := newSlideTemplateTestServer(t)

	cases := []struct {
		name string
		body string
		code int
	}{
		{"json invalide", "{oups", 400},
		{"nom vide", `{"template": {"name": "", "baseType": "NEWS"}}`, 400},
		{"nom trop long", `{"template": {"name": "` + strings.Repeat("x", 61) + `", "baseType": "NEWS"}}`, 400},
		{"baseType inconnu", `{"template": {"name": "X", "baseType": "NOPE"}}`, 400},
		{"state invalide", `{"template": {"name": "X", "baseType": "NEWS", "templateState": "{bad"}}`, 400},
		{"layers invalides", `{"template": {"name": "X", "baseType": "NEWS", "layers": "nope"}}`, 400},
		{"id invalide", `{"template": {"id": "a b!", "name": "X", "baseType": "NEWS"}}`, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, out := postTemplate(t, srv, tc.body)
			if code != tc.code {
				t.Fatalf("code = %d, want %d (%v)", code, tc.code, out)
			}
			if _, ok := out["error"]; !ok {
				t.Fatal("champ error manquant")
			}
		})
	}

	// DELETE sans id / id invalide.
	for _, q := range []string{"", "?id=" + url.QueryEscape("a b!")} {
		req := httptest.NewRequest(http.MethodDelete, "/api/slide-templates"+q, nil)
		rec := httptest.NewRecorder()
		srv.Mux.ServeHTTP(rec, req)
		if rec.Code != 400 {
			t.Fatalf("delete %q = %d, want 400", q, rec.Code)
		}
	}
}
