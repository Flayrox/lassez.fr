// Package config — résolution des paramètres du daemon.
//
// Depuis le pivot qoe.fi, les settings viennent de config/config.yaml
// (aplati en map avec les clés historiques) au lieu du global Payload.
// La cascade reste identique :
//  1. override du nœud dans pipelineGraphJson
//  2. clé préfixée par le nœud ("research.maxConcurrentTasks")
//  3. clé globale ("maxConcurrentTasks")
//  4. défaut du code
package config

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

const cacheTTL = 30 * time.Second

type SettingsProvider func() (map[string]any, error)

type Resolver struct {
	provider       SettingsProvider
	mu             sync.Mutex
	cached         map[string]any
	cacheExpiresAt time.Time
}

func NewResolverFromProvider(provider SettingsProvider) *Resolver {
	return &Resolver{provider: provider}
}

// Settings retourne la map de settings (cache 30 s).
func (r *Resolver) Settings() (map[string]any, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cached != nil && time.Now().Before(r.cacheExpiresAt) {
		return r.cached, nil
	}
	settings, err := r.provider()
	if err != nil {
		return nil, err
	}
	r.cached = settings
	r.cacheExpiresAt = time.Now().Add(cacheTTL)
	return settings, nil
}

// Invalidate relit le YAML au prochain accès.
func (r *Resolver) Invalidate() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cached = nil
	r.cacheExpiresAt = time.Time{}
}

// GraphOverride — valeur définie sur un nœud du graphe uniquement.
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

// GetEffectiveParam — cascade complète pour un paramètre de nœud.
func (r *Resolver) GetEffectiveParam(nodeType, key string, def any) any {
	settings, err := r.Settings()
	if err != nil || settings == nil {
		return def
	}

	// 1. Override dans le graphe (pipelineGraphJson).
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

	// 2. Clé préfixée par le nœud ("research.maxConcurrentTasks" = 5,
	//    "editor.maxConcurrentTasks" = 3 — valeurs différentes par étape).
	if v, ok := settings[nodeType+"."+key]; ok && !isEmptyValue(v) {
		return v
	}

	// 3. Clé globale historique.
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

// FileProvider — provider qui lit et aplatit le YAML à chaque appel
// (le cache 30 s du Resolver limite les lectures disque).
func FileProvider(path string) SettingsProvider {
	return func() (map[string]any, error) {
		return LoadYAMLSettings(path)
	}
}

// EnvOverride permet d'écraser des clés via l'environnement (secrets jamais en YAML).
func EnvOverride(settings map[string]any, pairs map[string]string) {
	for envKey, settingKey := range pairs {
		if v := os.Getenv(envKey); v != "" {
			settings[settingKey] = v
		}
	}
}
