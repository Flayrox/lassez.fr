// Package pipeline orchestrates one full cycle of the Radar nodes,
// mirroring radar_lassez/daemon.ts runPipeline: the active node set is read
// from the pipelineGraphJson setting (admin-configurable, this is what makes
// the pipeline modular from the Payload UI), then each active node runs in
// order. The publisher node runs on its own loop and is not part of a cycle.
package pipeline

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/logger"
	"github.com/Flayrox/LASSEZ/daemon/internal/nodes"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

// defaultActiveNodes matches the TS default set (validator enabled).
var defaultActiveNodes = map[string]bool{
	"ingestion": true,
	"dedup":     true,
	"research":  true,
	"editor":    true,
	"validator": true,
	"media":     true,
}

// ActiveNodes reads the pipelineGraphJson setting and returns the set of
// enabled node types. Falls back to the defaults on missing/invalid graph.
func ActiveNodes(resolver *config.Resolver) map[string]bool {
	active := map[string]bool{}
	for k, v := range defaultActiveNodes {
		active[k] = v
	}

	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return active
	}
	graphStr, _ := settings["pipelineGraphJson"].(string)
	if strings.TrimSpace(graphStr) == "" || graphStr == "{}" || graphStr == "[]" {
		return active
	}

	var graph struct {
		Nodes []struct {
			Type string `json:"type"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal([]byte(graphStr), &graph); err != nil {
		return active
	}
	if len(graph.Nodes) == 0 {
		return active
	}

	// Replace the default set with the graph's node list.
	active = map[string]bool{}
	for _, n := range graph.Nodes {
		if n.Type != "" {
			active[n.Type] = true
		}
	}
	return active
}

// RunCycle executes one full pipeline pass over the active nodes.
func RunCycle(client *payload.Client, resolver *config.Resolver, log *logger.Logger) error {
	active := ActiveNodes(resolver)
	log.Info("Daemon", "🚀 Démarrage d'un nouveau cycle du pipeline V3...")

	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return fmt.Errorf("les paramètres globaux sont introuvables")
	}

	modelFlash := strVal(settings["aiModelFlash"], "gemini-3.1-flash-lite-preview")
	modelPro := strVal(settings["aiModelPro"], "gemini-3-flash-preview")
	log.Info("Daemon", fmt.Sprintf("🧠 Modèles IA : %s (Analyse Rapide) / %s (Rédaction)", modelFlash, modelPro))

	var articles []nodes.IngestedArticle
	if active["ingestion"] {
		log.Info("Node 1", "📡 Lancement du nœud d'Ingestion multi-sources...")
		fetched, err := nodes.RunIngestion(client, resolver)
		if err != nil {
			log.Error("Node 1", "❌ Erreur ingestion: "+err.Error())
		}
		articles = fetched
	} else {
		log.Info("Daemon", "⏭️ Nœud Ingestion désactivé dans le graphe. Étape ignorée.")
	}

	if len(articles) > 0 {
		log.Info("Node 1", fmt.Sprintf("%d nouveaux articles aspirés.", len(articles)))
		if active["dedup"] {
			log.Info("Node 2", "🗑️ Lancement du Deduplicator (Élimination des doublons)...")
			if err := nodes.RunDeduplicator(client, resolver, articles); err != nil {
				log.Error("Node 2", "❌ Erreur deduplicator: "+err.Error())
			}
		}
	} else if active["ingestion"] {
		log.Info("Node 1", "ℹ️ Aucun nouvel article détecté. Passage au cycle suivant.")
	}

	// Les nœuds suivants traitent les signals laissés en attente par les
	// cycles précédents (statuts Payload), même sans nouveaux articles.

	if active["research"] {
		log.Info("Node 3", "🤖 Lancement du Researcher (IA Flash / Scoring & Filtrage)...")
		if err := nodes.RunResearcher(client, resolver); err != nil {
			log.Error("Node 3", "❌ Erreur researcher: "+err.Error())
		}
	}

	if active["editor"] {
		log.Info("Node 4", "✍️ Lancement de l'Editorialist (IA Pro / Rédaction d'investigation)...")
		if err := nodes.RunEditorialist(client, resolver); err != nil {
			log.Error("Node 4", "❌ Erreur editorialist: "+err.Error())
		}
	}

	if active["validator"] {
		log.Info("Node 5", "⚖️ Lancement du Validator (Vérification et sécurité)...")
		if err := nodes.RunValidator(client, resolver); err != nil {
			log.Error("Node 5", "❌ Erreur validator: "+err.Error())
		}
	}

	if active["media"] {
		log.Info("Node 6", "📸 Lancement du Media Enrichment (Création et assignation visuelle)...")
		if err := nodes.RunMedia(client, resolver); err != nil {
			log.Error("Node 6", "❌ Erreur media: "+err.Error())
		}
	}

	log.Success("Daemon", "✅ Cycle du pipeline terminé avec succès.")
	return nil
}

func strVal(v any, def string) string {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}
