// Package pipeline — cœur de L'Assez : orchestre un cycle complet du pipeline
// d'automatisation (le daemon Go).
//
// Flot explicite (7 nœuds, 2 boucles) :
//   Boucle principale (tous les X min) : ingestion → dedup → research → editor → validator → media
//   Boucle publisher (toutes les 2 min) : diffusion qoe.fi / Discord / X / Bluesky (hors cycle)
//
// Le graphe actif des nœuds est pilotable depuis config.yaml (section pipeline,
// éditée via le Studio) : un nœud désactivé est simplement sauté. C'est ce qui
// rend la pipeline modulaire sans redéployer. Fallback = défauts si graph vide.
package pipeline

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/logger"
	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
)

// NodeType — identifiant explicite d'un nœud (utilisé dans pipelineGraphJson.nodes[].type)
const (
	NodeIngestion = "ingestion"
	NodeDedup     = "dedup"
	NodeResearch  = "research"
	NodeEditor    = "editor"
	NodeValidator = "validator"
	NodeMedia     = "media"
	// publisher est hors cycle (boucle séparée daemon/cmd/daemon/main.go)
)

// NodeMeta — métadonnées affichées dans le studio Vue (studio.lassez.fr)
type NodeMeta struct {
	Type        string `json:"type"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Order       int    `json:"order"`
}

var NodeCatalog = []NodeMeta{
	{Type: NodeIngestion, Label: "Ingestion", Description: "RSS → SeenUrl", Order: 1},
	{Type: NodeDedup, Label: "Dédoublonnage", Description: "string-similarity 0.45, 48h lookback", Order: 2},
	{Type: NodeResearch, Label: "Researcher", Description: "Gemini Flash scoring 0-100, triage", Order: 3},
	{Type: NodeEditor, Label: "Editorialist", Description: "Gemini Pro rédaction investigation", Order: 4},
	{Type: NodeValidator, Label: "Validator", Description: "Vérif faits + conformité", Order: 5},
	{Type: NodeMedia, Label: "Media", Description: "Enrichissement image (Unsplash/keywords)", Order: 6},
}

// defaultActiveNodes = graphe par défaut si aucun JSON en DB
var defaultActiveNodes = map[string]bool{
	NodeIngestion: true,
	NodeDedup:     true,
	NodeResearch:  true,
	NodeEditor:    true,
	NodeValidator: true,
	NodeMedia:     true,
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
			Type    string `json:"type"`
			Enabled *bool  `json:"enabled"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal([]byte(graphStr), &graph); err != nil {
		return active
	}
	if len(graph.Nodes) == 0 {
		return active
	}

	// Replace the default set with the graph's node list. Un nœud est actif
	// sauf si son champ "enabled" est explicitement à false (l'éditeur visuel
	// du graphe permet de désactiver un nœud sans perdre ses réglages).
	active = map[string]bool{}
	for _, n := range graph.Nodes {
		if n.Type == "" {
			continue
		}
		if n.Enabled != nil && !*n.Enabled {
			continue
		}
		active[n.Type] = true
	}
	return active
}

// RunCycle — exécute 1 cycle complet, nœud par nœud, en respectant activeNodes.
// Chaque étape est loggée explicitement (Node 1..6) pour le dashboard studio.
func RunCycle(client *store.Client, resolver *config.Resolver, log *logger.Logger) error {
	active := ActiveNodes(resolver)
	log.Info("Daemon", "🚀 Démarrage cycle pipeline — actifs: "+strings.Join(activeList(active), ", "))

	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return fmt.Errorf("les paramètres globaux sont introuvables")
	}

	modelFlash := strVal(settings["aiModelFlash"], "gemini-3.5-flash-lite")
	modelPro := strVal(settings["aiModelPro"], "gemini-3.7-flash")
	log.Info("Daemon", fmt.Sprintf("🧠 Modèles IA : %s (Analyse Rapide) / %s (Rédaction)", modelFlash, modelPro))

	cycleStart := time.Now()
	// Historique « Suivi » : chaque cycle est enregistré en SQLite avec ses
	// étapes (aspiré → trié → rédigé → validé → publié), pour le studio.
	cycleID, _ := client.StartCycle("pipeline")

	var articles []nodes.IngestedArticle
	if active["ingestion"] {
		log.Info("Node 1", "📡 Lancement du nœud d'Ingestion multi-sources...")
		start := time.Now()
		fetched, err := nodes.RunIngestion(client, resolver)
		nodes.RecordBrickRun(NodeIngestion, "Ingestion", err, time.Since(start))
		client.RecordCycleStep(cycleID, NodeIngestion, "Aspiré", stepStatus(err), time.Since(start), errMsg(err),
			fmt.Sprintf("%d article%s aspiré%s", len(fetched), plural(len(fetched)), plural(len(fetched))))
		if err != nil {
			log.Error("Node 1", "❌ Erreur ingestion: "+err.Error())
		}
		articles = fetched
	} else {
		client.RecordCycleStep(cycleID, NodeIngestion, "Aspiré", "skipped", 0, "", "étape désactivée")
		log.Info("Daemon", "⏭️ Nœud Ingestion désactivé dans le graphe. Étape ignorée.")
	}

	if len(articles) > 0 {
		log.Info("Node 1", fmt.Sprintf("%d nouveaux articles aspirés.", len(articles)))
		if active["dedup"] {
			log.Info("Node 2", "🗑️ Lancement du Deduplicator (Élimination des doublons)...")
			start := time.Now()
			err := nodes.RunDeduplicator(client, resolver, articles)
			nodes.RecordBrickRun(NodeDedup, "Dédoublonnage", err, time.Since(start))
			client.RecordCycleStep(cycleID, NodeDedup, "Anti-doublons", stepStatus(err), time.Since(start), errMsg(err), "doublons filtrés")
			if err != nil {
				log.Error("Node 2", "❌ Erreur deduplicator: "+err.Error())
			}
		}
	} else if active["ingestion"] {
		log.Info("Node 1", "ℹ️ Aucun nouvel article détecté. Passage au cycle suivant.")
	}

	// Les nœuds suivants traitent les signals laissés en attente par les
	// cycles précédents (statuts du pipeline), même sans nouveaux articles.

	if active["research"] {
		log.Info("Node 3", "🤖 Lancement du Researcher (IA Flash / Scoring & Filtrage)...")
		start := time.Now()
		err := nodes.RunResearcher(client, resolver)
		nodes.RecordBrickRun(NodeResearch, "Researcher", err, time.Since(start))
		client.RecordCycleStep(cycleID, NodeResearch, "Trié", stepStatus(err), time.Since(start), errMsg(err), "sujets notés 0–100")
		if err != nil {
			log.Error("Node 3", "❌ Erreur researcher: "+err.Error())
		}
	}

	if active["editor"] {
		log.Info("Node 4", "✍️ Lancement de l'Editorialist (IA Pro / Rédaction d'investigation)...")
		start := time.Now()
		err := nodes.RunEditorialist(client, resolver)
		nodes.RecordBrickRun(NodeEditor, "Editorialist", err, time.Since(start))
		client.RecordCycleStep(cycleID, NodeEditor, "Rédigé", stepStatus(err), time.Since(start), errMsg(err), "articles rédigés")
		if err != nil {
			log.Error("Node 4", "❌ Erreur editorialist: "+err.Error())
		}
	}

	if active["validator"] {
		log.Info("Node 5", "⚖️ Lancement du Validator (Vérification et sécurité)...")
		start := time.Now()
		err := nodes.RunValidator(client, resolver)
		nodes.RecordBrickRun(NodeValidator, "Validator", err, time.Since(start))
		client.RecordCycleStep(cycleID, NodeValidator, "Validé", stepStatus(err), time.Since(start), errMsg(err), "faits vérifiés")
		if err != nil {
			log.Error("Node 5", "❌ Erreur validator: "+err.Error())
		}
	}

	if active["media"] {
		log.Info("Node 6", "📸 Lancement du Media Enrichment (Création et assignation visuelle)...")
		start := time.Now()
		err := nodes.RunMedia(client, resolver)
		nodes.RecordBrickRun(NodeMedia, "Média", err, time.Since(start))
		client.RecordCycleStep(cycleID, NodeMedia, "Illustré", stepStatus(err), time.Since(start), errMsg(err), "visuels assignés")
		if err != nil {
			log.Error("Node 6", "❌ Erreur media: "+err.Error())
		}
	}

	nodes.RecordCycleDone(nil, time.Since(cycleStart))
	client.EndCycle(cycleID, nil, time.Since(cycleStart))
	log.Success("Daemon", "✅ Cycle du pipeline terminé avec succès.")
	return nil
}

func stepStatus(err error) string {
	if err != nil {
		return "error"
	}
	return "ok"
}

func errMsg(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func plural(n int) string {
	if n > 1 {
		return "s"
	}
	return ""
}

func strVal(v any, def string) string {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}

// activeList — liste ordonnée des nœuds actifs pour le log
func activeList(active map[string]bool) []string {
	order := []string{NodeIngestion, NodeDedup, NodeResearch, NodeEditor, NodeValidator, NodeMedia}
	var out []string
	for _, n := range order {
		if active[n] {
			out = append(out, n)
		}
	}
	return out
}
