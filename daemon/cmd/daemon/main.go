// Command daemon is the Go rewrite of the pipeline automation daemon.
//
// It replaces radar_lassez/ (TypeScript). Two autonomous loops mirror the TS
// daemon.ts: the main pipeline cycle runs the active nodes from the
// pipelineGraphJson graph on a schedule (pulse / calendar / hybrid), and the
// publisher loop checks due publications every 2 minutes.
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/Flayrox/lassez.fr/daemon/internal/api"
	"github.com/Flayrox/lassez.fr/daemon/internal/config"
	"github.com/Flayrox/lassez.fr/daemon/internal/logger"
	"github.com/Flayrox/lassez.fr/daemon/internal/nodes"
	"github.com/Flayrox/lassez.fr/daemon/internal/store"
	"github.com/Flayrox/lassez.fr/daemon/internal/pipeline"
	"github.com/Flayrox/lassez.fr/daemon/internal/scheduler"
)

func main() {
	// -once : exécute un seul cycle complet (pipeline + publisher) puis sort.
	// -config : chemin du YAML de configuration.
	once := flag.Bool("once", false, "exécuter un seul cycle et sortir")
	configPath := flag.String("config", "config/config.yaml", "chemin du fichier de configuration YAML")
	flag.Parse()

	// Chemins canoniques : tout est résolu depuis le dossier du daemon
	// (détecté via le binaire ou $DAEMON_ROOT), indépendant du répertoire
	// de lancement — config, données, logs et .env pointent toujours au bon
	// endroit, qu'on démarre de la racine du repo ou de daemon/.
	daemonRoot := daemonDir()
	repoRoot := filepath.Dir(daemonRoot)
	cfgPath := resolvePath(daemonRoot, *configPath)
	logDir := filepath.Join(daemonRoot, "logs")

	loadEnv(repoRoot)

	// ── Settings YAML + client local SQLite ──
	resolver := config.NewResolverFromProvider(config.FileProvider(cfgPath))

	// ── API HTTP du studio (signaux SQLite local) ──
	dbPath := os.Getenv("PIPELINE_DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join(repoRoot, "data", "pipeline.db")
	}
	localClient, err := store.NewLocal(dbPath, func() (map[string]any, error) {
		return resolver.Settings()
	})
	if err != nil {
		log.Fatalf("[Daemon] 💥 SQLite indisponible (%s) : %v", dbPath, err)
	}
	client := localClient // même interface que l'ancien client CMS

	// Scan manuel : POST /api/scan du studio réveille la boucle principale
	// (le canal est rempli par le serveur API, vidé par la boucle ci-dessous).
	trigger := make(chan struct{}, 1)

	{
		// API HTTP du studio : signaux réels du pipeline (daemon_signals) + config.
		srv := api.New(client, *configPath, resolver)
		srv.Trigger = trigger
		// Panneau de logs du studio : on lit la fin de daemon/logs/daemon.log.
		srv.LogPath = filepath.Join(logDir, "daemon.log")
		go func() {
			// Port canonique de l'API studio : :4406 par défaut, LA valeur que
			// le proxy dev (vite) et dev-domain.sh attendent partout. Résolu dans
			// l'ordre : STUDIO_API_ADDR (si précisé) → DAEMON_PORT (alias dev-conjugué
			// avec vite.config) → 4406. Le daemon ne doit plus JAMAIS se retrouver
			// sur un autre port que celui que le studio attend, quelle que soit la
			// façon dont il est lancé (screen, PM2, dev-domain, ./bin/daemon nu).
			addr := os.Getenv("STUDIO_API_ADDR")
			if addr == "" {
				if p := os.Getenv("DAEMON_PORT"); p != "" {
					addr = ":" + p
				} else {
					addr = ":4406"
				}
			}
			log.Printf("[Daemon] API studio sur %s (signaux : %s)", addr, dbPath)
			if err := http.ListenAndServe(addr, api.CORS(srv.Mux)); err != nil {
				log.Fatalf("[Daemon] 💥 Impossible de joindre le studio : écoute sur %s échouée (%v).", addr, err)
			}
		}()
	}

	resolver.Invalidate()

	settings, _ := resolver.Settings()
	logOpts := logger.Options{
		Level: settingString(settings, "logLevel", "INFO"),
	}

	// Logger : fichier daemon/logs/daemon.log (rotation 10 Mo).
	loggerInstance, err := logger.New(logDir, logOpts)
	if err != nil {
		log.Printf("[Daemon] ⚠️ Logger fichier indisponible: %v", err)
	}
	defer loggerInstance.Close()

	// Redirige les log.Printf des nœuds vers le logger (fichier).
	log.SetFlags(0)
	log.SetOutput(&logRedirect{logger: loggerInstance})

	loggerInstance.Info("Daemon", "==========================================")
	loggerInstance.Info("Daemon", "   L'ASSEZ — DAEMON PIPELINE (Go)      ")
	loggerInstance.Info("Daemon", "==========================================")
	loggerInstance.Info("Daemon", "[Daemon] Stockage : "+client.BaseURL())
	loggerInstance.Info("Daemon", "[Daemon] Journalisation : niveau="+logOpts.Level)

	// Purge périodique des vieux journaux (rétention système) — no-op local.
	go pruneLogsLoop(client, resolver, loggerInstance)

	// Mode one-shot (trigger manuel) : un cycle pipeline + publisher puis exit.
	if *once {
		if err := pipeline.RunCycle(client, resolver, loggerInstance); err != nil {
			loggerInstance.Error("Daemon", "❌ Erreur critique dans le pipeline : "+err.Error())
		}
		recordPublisherRun(client, time.Now())
		return
	}

	// Arrêt propre sur SIGTERM/SIGINT (PM2).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-stop
		loggerInstance.Info("Daemon", "🛑 Signal reçu, arrêt propre du démon...")
		// os.Exit ne déroule pas les defers : on ferme le logger
		// explicitement avant de sortir.
		loggerInstance.Close()
		os.Exit(0)
	}()

	// 1. Boucle principale (ingestion → rédaction) avec planification.
	//    Un scan manuel (POST /api/scan du studio) réveille l'attente immédiatement.
	go func() {
		for {
			if err := pipeline.RunCycle(client, resolver, loggerInstance); err != nil {
				loggerInstance.Error("Daemon", "❌ Erreur critique dans le pipeline : "+err.Error())
			}

			settings, _ := resolver.Settings()
			next := scheduler.Compute(settings, time.Now())
			loggerInstance.Info("Daemon", "⏳ Prochain scan programmé : "+next.Label+" ("+formatMinutes(next.Delay)+" min).")
			select {
			case <-trigger:
				loggerInstance.Info("Daemon", "⚡ Scan manuel demandé par le studio — cycle immédiat.")
			case <-time.After(next.Delay):
			}
		}
	}()

	// 2. Boucle publisher (tour de contrôle) toutes les 2 minutes + heartbeat.
	go func() {
		for {
			pubStart := time.Now()
			pubErr := nodes.RunPublisher(client, resolver)
			nodes.RecordBrickRun("publisher", "Publisher", pubErr, time.Since(pubStart))
			recordPublisherRun(client, pubStart)
			if pubErr != nil {
				loggerInstance.Error("Daemon", "❌ Erreur dans la boucle Publisher : "+pubErr.Error())
			}

			// Heartbeat : rafraîchit updatedAt.
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
// les nœuds (log.Printf) alimentent aussi le fichier.
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

// recordPublisherRun — enregistre une diffusion publisher comme un cycle à
// part (étape unique « Publié ») pour l'historique « Suivi » du studio.
func recordPublisherRun(client *store.Client, start time.Time) {
	cycleID, err := client.StartCycle("publisher")
	if err != nil {
		return
	}
	dur := time.Since(start)
	client.RecordCycleStep(cycleID, "publisher", "Publié", "ok", dur, "", "diffusion qoe.fi / Discord / X")
	client.EndCycle(cycleID, nil, dur)
}

// pruneLogsLoop supprime périodiquement les vieux journaux (plus vieux que
// logRetentionDays, 0 = jamais). Lit les réglages à chaque passage pour
// prendre en compte un changement sans redémarrage.
func pruneLogsLoop(client *store.Client, resolver *config.Resolver, loggerInstance *logger.Logger) {
	prune := func() {
		settings, err := resolver.Settings()
		if err != nil || settings == nil {
			return
		}
		days := int(toFloat(settings["logRetentionDays"]))
		if days <= 0 {
			return
		}
		cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
		if err := client.PruneLogs(cutoff); err != nil {
			loggerInstance.Warn("Daemon", "⚠️ Purge des logs échouée : "+err.Error())
		} else {
			loggerInstance.Warn("Daemon", "🧹 Purge des vieux journaux effectuée.")
		}
		resolver.Invalidate()
	}

	// Première purge au démarrage, puis toutes les 6 heures.
	prune()
	for range time.Tick(6 * time.Hour) {
		prune()
	}
}

// settingString lit une valeur texte d'un map de réglages (avec défaut).
func settingString(settings map[string]any, key, def string) string {
	if settings == nil {
		return def
	}
	if v, ok := settings[key].(string); ok && v != "" {
		return v
	}
	return def
}

// settingBool lit une valeur booléenne d'un map de réglages (avec défaut).
func settingBool(settings map[string]any, key string, def bool) bool {
	if settings == nil {
		return def
	}
	if v, ok := settings[key].(bool); ok {
		return v
	}
	return def
}

// toFloat convertit une valeur numérique (int, float64, string) en float64.
func toFloat(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case string:
		f, _ := strconv.ParseFloat(n, 64)
		return f
	default:
		return 0
	}
}

// loadEnv charge le .env à la racine du repo (les secrets y vivent :
// GEMINI_API_KEY, DISCORD_WEBHOOK_URL…).
func loadEnv(repoRoot string) {
	_ = godotenv.Load(filepath.Join(repoRoot, ".env"))
}

// daemonDir retourne le dossier canonique du daemon (celui qui contient
// config/config.yaml). Priorité : $DAEMON_ROOT, puis le dossier du binaire
// compilé (daemon/bin/daemon → daemon/), puis le répertoire courant.
func daemonDir() string {
	if r := os.Getenv("DAEMON_ROOT"); r != "" {
		return r
	}
	var candidates []string
	if exe, err := os.Executable(); err == nil {
		d := filepath.Dir(exe)
		candidates = append(candidates, d, filepath.Dir(d))
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, wd)
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "config", "config.yaml")); err == nil {
			return c
		}
	}
	if len(candidates) > 0 {
		return candidates[len(candidates)-1]
	}
	return "."
}

// resolvePath rend un chemin absolu contre root quand il est relatif.
func resolvePath(root, p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(root, p)
}

var _ io.Writer = (*logRedirect)(nil)
