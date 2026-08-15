// Command daemon is the Go rewrite of the Radar automation daemon.
//
// It replaces radar_lassez/ (TypeScript). Two autonomous loops mirror the TS
// daemon.ts: the main pipeline cycle runs the active nodes from the
// pipelineGraphJson graph on a schedule (pulse / calendar / hybrid), and the
// publisher loop checks due publications every 2 minutes while heartbeating
// the admin dashboard through the Payload logs collection.
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/Flayrox/LASSEZ/daemon/internal/config"
	"github.com/Flayrox/LASSEZ/daemon/internal/logger"
	"github.com/Flayrox/LASSEZ/daemon/internal/nodes"
	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
	"github.com/Flayrox/LASSEZ/daemon/internal/pipeline"
	"github.com/Flayrox/LASSEZ/daemon/internal/scheduler"
)

func main() {
	// -once : exécute un seul cycle complet (pipeline + publisher) puis sort.
	// Utilisé par l'endpoint POST /api/payload/radar/trigger (bouton "Nouveau scan").
	once := flag.Bool("once", false, "exécuter un seul cycle et sortir")
	flag.Parse()

	loadEnv()

	client := payload.New("")
	resolver := config.NewResolver(client)

	// Le logger écrit dans logs/daemon.log (rotation 10 Mo) ET envoie les
	// entrées dans la collection Payload logs (heartbeat du dashboard).
	loggerInstance, err := logger.New(client, "")
	if err != nil {
		log.Printf("[Daemon] ⚠️ Logger fichier indisponible: %v", err)
	}
	defer loggerInstance.Close()

	// Redirige les log.Printf des nœuds vers le logger (fichier + Payload).
	log.SetFlags(0)
	log.SetOutput(&logRedirect{logger: loggerInstance})

	loggerInstance.Info("Daemon", "==========================================")
	loggerInstance.Info("Daemon", "   L'ASSEZ - DEMON RADAR (Go)            ")
	loggerInstance.Info("Daemon", "==========================================")
	loggerInstance.Info("Daemon", "[Daemon] API Payload : "+client.BaseURL())

	// Assure l'existence du global radar-settings.
	if err := client.EnsureSettings(); err != nil {
		loggerInstance.Warn("Daemon", "⚠️ radar-settings introuvables, initialisation : "+err.Error())
	} else {
		loggerInstance.Info("Daemon", "radar-settings chargées.")
	}
	resolver.Invalidate()

	// Mode one-shot (trigger manuel) : un cycle pipeline + publisher puis exit.
	if *once {
		if err := pipeline.RunCycle(client, resolver, loggerInstance); err != nil {
			loggerInstance.Error("Daemon", "❌ Erreur critique dans le pipeline : "+err.Error())
		}
		if err := nodes.RunPublisher(client, resolver); err != nil {
			loggerInstance.Error("Daemon", "❌ Erreur dans la boucle Publisher : "+err.Error())
		}
		return
	}

	// Arrêt propre sur SIGTERM/SIGINT (PM2).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-stop
		loggerInstance.Info("Daemon", "🛑 Signal reçu, arrêt propre du démon...")
		os.Exit(0)
	}()

	// 1. Boucle principale (ingestion → rédaction) avec planification.
	go func() {
		for {
			if err := pipeline.RunCycle(client, resolver, loggerInstance); err != nil {
				loggerInstance.Error("Daemon", "❌ Erreur critique dans le pipeline : "+err.Error())
			}

			settings, _ := resolver.Settings()
			next := scheduler.Compute(settings, time.Now())
			loggerInstance.Info("Daemon", "⏳ Prochain scan programmé : "+next.Label+" ("+formatMinutes(next.Delay)+" min).")
			time.Sleep(next.Delay)
		}
	}()

	// 2. Boucle publisher (tour de contrôle) toutes les 2 minutes + heartbeat.
	go func() {
		for {
			if err := nodes.RunPublisher(client, resolver); err != nil {
				loggerInstance.Error("Daemon", "❌ Erreur dans la boucle Publisher : "+err.Error())
			}

			// Heartbeat : rafraîchit updatedAt + log Payload (dashboard).
			if err := client.UpdateSettings(map[string]any{"updatedAt": time.Now().UTC().Format(time.RFC3339)}); err != nil {
				loggerInstance.Warn("Daemon", "⚠️ Heartbeat updatedAt : "+err.Error())
			}
			resolver.Invalidate()
			time.Sleep(2 * time.Minute)
		}
	}()

	select {}
}

// logRedirect envoie chaque ligne du package log vers le Logger, pour que
// les nœuds (log.Printf) alimentent aussi le fichier + Payload logs.
type logRedirect struct {
	logger *logger.Logger
}

func (r *logRedirect) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	if line != "" {
		r.logger.Stdout(line)
	}
	return len(p), nil
}

// formatMinutes affiche un délai en minutes (arrondi à la minute).
func formatMinutes(d time.Duration) string {
	return fmt.Sprintf("%d", int(d.Minutes()))
}

// loadEnv charges le .env à la racine du repo (le daemon TS a été supprimé,
// ses secrets ont été fusionnés dans le .env racine).
func loadEnv() {
	wd, err := os.Getwd()
	if err != nil {
		return
	}
	_ = godotenv.Load(filepath.Join(wd, ".env"))
}

var _ io.Writer = (*logRedirect)(nil)
