package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Flayrox/lassez.fr/daemon/internal/api"
	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

func setupTestServer(t *testing.T) (*api.Server, func()) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "api_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	cfgPath := filepath.Join(tmpDir, "config.yaml")

	// Init minimal config
	_ = os.WriteFile(cfgPath, []byte(`
scheduling:
  mode: weekly
  weeklySlots: []
publisher:
  enableDiscord: true
`), 0o644)

	provider := func() (map[string]any, error) {
		return config.LoadYAMLSettings(cfgPath)
	}
	resolver := config.NewResolverFromProvider(provider)
	client, err := store.NewLocal(dbPath, provider)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	pipelines := []config.PipelineMeta{
		{ID: "principal", Name: "Principal", Port: 4406, Enabled: true},
		{ID: "flash", Name: "Flash", Port: 4407, Enabled: true},
	}

	srv := api.New(client, cfgPath, resolver)
	srv.Pipelines = pipelines

	cleanup := func() {
		_ = client.Close()
		_ = os.RemoveAll(tmpDir)
	}

	return srv, cleanup
}

func TestHealthz(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/healthz", nil)
	rec := httptest.NewRecorder()

	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Errorf("invalid json response: %v", err)
	}
	if res["ok"] != true {
		t.Errorf("expected ok: true, got %v", res["ok"])
	}
}

func TestListPipelines(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/pipelines", nil)
	rec := httptest.NewRecorder()

	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	var res struct {
		Data []config.PipelineMeta `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(res.Data) != 2 {
		t.Errorf("expected 2 pipelines, got %d", len(res.Data))
	}
}

func TestGetAndPatchConfig(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. GET config
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("GET /api/config: expected 200, got %d", rec.Code)
	}

	// 2. PATCH config
	patchBody := []byte(`{"scheduling": {"scrapingIntervalMinutes": 45}}`)
	reqPatch := httptest.NewRequest(http.MethodPatch, "/api/config", bytes.NewReader(patchBody))
	reqPatch.Header.Set("Content-Type", "application/json")
	recPatch := httptest.NewRecorder()
	srv.Mux.ServeHTTP(recPatch, reqPatch)
	if recPatch.Code != http.StatusOK {
		t.Errorf("PATCH /api/config: expected 200, got %d", recPatch.Code)
	}
}

func TestRouteSignal(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Create a signal
	err := srv.Client.CreateSignals([]map[string]any{
		{
			"raw_data": `{"clusterTitle": "Test Signal"}`,
			"status":   "INGESTED",
			"tags":     `["test"]`,
		},
	})
	if err != nil {
		t.Fatalf("failed to create signal: %v", err)
	}

	sigs, err := srv.Client.GetSignalsByStatus("INGESTED")
	if err != nil || len(sigs) == 0 {
		t.Fatalf("signal not found")
	}
	sigID := sigs[0].ID.Number()

	// 2. Route signal to flash
	body := map[string]any{
		"signal_id":          sigID,
		"target_pipeline_id": "flash",
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/signals/route", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("POST /api/signals/route: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
}
