// Package config — registre des pipelines : une instance = sa propre config
// YAML, sa propre base SQLite, son propre port API et son propre planning.
// Le fichier daemon/config/pipelines.yaml déclare la liste (le studio la lit
// via GET /api/pipelines pour basculer d'une instance à l'autre).
package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// PipelineMeta décrit une instance de pipeline (registre pipelines.yaml).
type PipelineMeta struct {
	ID          string `yaml:"id" json:"id"`
	Name        string `yaml:"name" json:"name"`
	Description string `yaml:"description" json:"description"`
	Enabled     bool   `yaml:"enabled" json:"enabled"`
	ConfigPath  string `yaml:"configPath" json:"configPath"`
	DBPath      string `yaml:"dbPath" json:"dbPath"`
	Port        int    `yaml:"port" json:"port"`
	Color       string `yaml:"color" json:"color"`
}

// DefaultPipelines — si pipelines.yaml est absent (ou vide), on retombe sur
// l'instance unique historique : config/config.yaml + data/pipeline.db + :4406.
func DefaultPipelines() []PipelineMeta {
	return []PipelineMeta{
		{ID: "principal", Name: "Principal", Description: "Le pipeline principal (tous formats)", Enabled: true, ConfigPath: "config/config.yaml", DBPath: "../data/pipeline.db", Port: 4406, Color: "#F59E0B"},
	}
}

// LoadPipelines lit le registre depuis le fichier donné. Fichier absent ou
// invalide → registre par défaut (instance unique).
func LoadPipelines(path string) ([]PipelineMeta, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return DefaultPipelines(), nil
	}
	var doc struct {
		Pipelines []PipelineMeta `yaml:"pipelines"`
	}
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return DefaultPipelines(), nil
	}
	if len(doc.Pipelines) == 0 {
		return DefaultPipelines(), nil
	}
	return doc.Pipelines, nil
}
