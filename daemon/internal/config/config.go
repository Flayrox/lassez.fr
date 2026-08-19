// Package config resolves daemon parameters from the radar-settings global
// with a short-lived cache, mirroring radar_lassez/lib/config-resolver.ts.
package config

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

const cacheTTL = 30 * time.Second

// Resolver caches the radar-settings global and applies the parameter
// cascade: pipeline-graph node override → global value → default.
type Resolver struct {
	client         *payload.Client
	mu             sync.Mutex
	cached         map[string]any
	cacheExpiresAt time.Time
}

func NewResolver(client *payload.Client) *Resolver {
	return &Resolver{client: client}
}

// Settings returns the (cached) radar-settings global.
func (r *Resolver) Settings() (map[string]any, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cached != nil && time.Now().Before(r.cacheExpiresAt) {
		return r.cached, nil
	}
	settings, err := r.client.GetSettings()
	if err != nil {
		return nil, err
	}
	r.cached = settings
	r.cacheExpiresAt = time.Now().Add(cacheTTL)
	return settings, nil
}

// Invalidate drops the cached settings.
func (r *Resolver) Invalidate() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cached = nil
	r.cacheExpiresAt = time.Time{}
}

// GraphOverride returns a parameter value defined on a node in the pipeline
// graph (pipelineGraphJson) only — without falling back to the global
// setting. Used when a value must be resolvable per-node without letting the
// global override it.
func (r *Resolver) GraphOverride(nodeType, key string) (any, bool) {
	settings, err := r.Settings()
	if err != nil || settings == nil {
		return nil, false
	}
	graphStr, ok := settings["pipelineGraphJson"].(string)
	if !ok || graphStr == "" || graphStr == "{}" || graphStr == "[]" {
		return nil, false
	}
	var graph struct {
		Nodes []struct {
			Type     string `json:"type"`
			Settings []struct {
				Key   string `json:"key"`
				Value any    `json:"value"`
			} `json:"settings"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal([]byte(graphStr), &graph); err != nil {
		return nil, false
	}
	for _, n := range graph.Nodes {
		if n.Type != nodeType {
			continue
		}
		for _, s := range n.Settings {
			if s.Key == key && !isEmptyValue(s.Value) {
				return s.Value, true
			}
		}
	}
	return nil, false
}

// GetEffectiveParam resolves a single parameter for a node type.
func (r *Resolver) GetEffectiveParam(nodeType, key string, def any) any {
	settings, err := r.Settings()
	if err != nil || settings == nil {
		return def
	}

	// 1. Override in the pipeline graph (pipelineGraphJson).
	if graphStr, ok := settings["pipelineGraphJson"].(string); ok && graphStr != "" && graphStr != "{}" && graphStr != "[]" {
		var graph struct {
			Nodes []struct {
				Type     string `json:"type"`
				Settings []struct {
					Key   string `json:"key"`
					Value any    `json:"value"`
				} `json:"settings"`
			} `json:"nodes"`
		}
		if err := json.Unmarshal([]byte(graphStr), &graph); err == nil {
			for _, n := range graph.Nodes {
				if n.Type != nodeType {
					continue
				}
				for _, s := range n.Settings {
					if s.Key == key && !isEmptyValue(s.Value) {
						return s.Value
					}
				}
			}
		}
	}

	// 2. Global setting.
	if v, ok := settings[key]; ok && !isEmptyValue(v) {
		return v
	}
	return def
}

func isEmptyValue(v any) bool {
	if v == nil {
		return true
	}
	if s, ok := v.(string); ok {
		return s == ""
	}
	return false
}
