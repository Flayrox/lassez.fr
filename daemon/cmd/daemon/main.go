// Command daemon is the Go rewrite of the Radar automation daemon.
//
// It replaces radar_lassez/ (TypeScript) node by node. This first milestone
// runs the ingestion node once against Payload; the full pipeline loop,
// scheduler and publisher loop are added as the remaining nodes are ported.
package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/nodes"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

func main() {
	loadEnv()

	client := payload.New("")
	resolver := config.NewResolver(client)

	log.Printf("==========================================")
	log.Printf("   L'ASSEZ - DEMON RADAR (Go)            ")
	log.Printf("==========================================")
	log.Printf("[Daemon] API Payload : %s", client.BaseURL())

	articles, err := nodes.RunIngestion(client, resolver)
	if err != nil {
		log.Printf("[Daemon] ❌ Erreur critique : %v", err)
		os.Exit(1)
	}
	log.Printf("[Daemon] ✅ %d articles aspirés.", len(articles))

	if len(articles) > 0 {
		if err := nodes.RunDeduplicator(client, resolver, articles); err != nil {
			log.Printf("[Daemon] ❌ Erreur deduplicator : %v", err)
		}
	}

	if err := nodes.RunResearcher(client, resolver); err != nil {
		log.Printf("[Daemon] ❌ Erreur researcher : %v", err)
	}

	if err := nodes.RunEditorialist(client, resolver); err != nil {
		log.Printf("[Daemon] ❌ Erreur editorialist : %v", err)
	}

	if err := nodes.RunValidator(client, resolver); err != nil {
		log.Printf("[Daemon] ❌ Erreur validator : %v", err)
	}

	if err := nodes.RunMedia(client, resolver); err != nil {
		log.Printf("[Daemon] ❌ Erreur media : %v", err)
	}
}

// loadEnv mirrors radar_lassez/lib/env.ts: the repo-root .env first, then
// radar_lassez/.env which takes precedence.
func loadEnv() {
	wd, err := os.Getwd()
	if err != nil {
		return
	}
	_ = godotenv.Load(filepath.Join(wd, ".env"))
	_ = godotenv.Overload(filepath.Join(wd, "radar_lassez", ".env"))
}
