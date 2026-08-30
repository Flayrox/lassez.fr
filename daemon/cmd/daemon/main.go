// Command daemon is the Go rewrite of the pipeline automation daemon.
//
// It replaces radar_lassez/ (TypeScript). Two autonomous loops mirror the TS
// daemon.ts: the main pipeline cycle runs the active nodes from the
// pipelineGraphJson graph on a schedule (pulse / calendar / hybrid), and the
// publisher loop checks due publications every 2 minutes.
//
// Multi-pipeline : le registre daemon/config/pipelines.yaml déclare plusieurs
// instances (chacune avec sa config YAML, sa base SQLite, son port API et son
// planning). Une goroutine par instance = une boucle pipeline + une boucle
// publisher indépendantes, qui peuvent tourner en parallèle.
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
	"sync"
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
	// -once : exécute un cycle complet (pipeline + publisher) de chaque
	// instance active puis sort. -config : chemin du YAML de configuration
	// (n'agit que sur l'instance unique historique).
	once := flag.Bool("once", false, "exécuter un seul cycle et sortir")
	configPath := flag.String("config", "config/config.yaml", "chemin du fichier de configuration YAML")
	flag.Parse()

	// Chemins canoniques : tout est résolu depuis le dossier du daemon
	// (détecté via le binaire ou $DAEMON_ROOT), indépendant du répertoire
	// de lancement — config, données, logs et .env pointent toujours au bon
	// endroit, qu'on démarre de la racine du repo ou de daemon/.
	daemonRoot := daemonDir()
	repoRoot := filepath.Dir(daemonRoot)
	logDir := filepath.Join(daemonRoot, "logs")

	loadEnv(repoRoot)

	// ── Registre multi-instances ──
	pipelinesPath := resolvePath(daemonRoot, "config/pipelines.yaml")
	metas, err := config.LoadPipelines(pipelinesPath)
	if err != nil {
		log.Fatalf("[Daemon] 💥 Registre pipelines illisible : %v", err)
	}
	// Compat : -config ne s'applique qu'à l'instance unique historique.
	if len(metas) == 1 && *configPath != "config/config.yaml" {
		metas[0].ConfigPath = *configPath
	}

	// Logger global : les log.Printf des nœuds (process-wide) fan-out vers
	// toutes les instances pour que chaque fichier daemon-<id>.log soit complet.
	fan := &logFan{}

	if *once {
		for _, m := range metas {
			if !m.Enabled {
				continue
			}
			inst := newInstance(m, metas, daemonRoot, repoRoot, logDir, fan)
			if err := inst.runCycle(); err != nil {
				fmt.Printf("[%s] ❌ Erreur critique pipeline : %v\n", m.Name, err)
			}
			recordPublisherRun(inst.client, time.Now())
			inst.close()
		}
		return
	}

	// Arrêt propre sur SIGTERM/SIGINT (PM2).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-stop
		log.Println("🛑 Signal reçu, arrêt propre du démon...")
		fan.closeAll()
		os.Exit(0)
	}()

	// Une goroutine par instance active — les pipelines tournent en parallèle.
	for _, m := range metas {
		if !m.Enabled {
			continue
		}
		m := m
		inst := newInstance(m, metas, daemonRoot, repoRoot, logDir, fan)
		go inst.run()
	}

	select {}
}

// ── Une instance de pipeline ────────────────────────────────────────────────

type instance struct {
	meta     config.PipelineMeta
	client   *store.Client
	resolver *config.Resolver
	log      *logger.Logger
	trigger  chan struct{}
}

func newInstance(m config.PipelineMeta, all []config.PipelineMeta, daemonRoot, repoRoot, logDir string, fan *logFan) *instance {
	cfgPath := resolvePath(daemonRoot, m.ConfigPath)

	// Resolver : chaque instance lit SA config YAML.
	resolver := config.NewResolverFromProvider(config.FileProvider(cfgPath))

	// Base SQLite : chaque instance a SA base. dbPath est relatif au dossier
	// du daemon (../data/pipeline.db = <projet>/data/pipeline.db).
	dbPath := m.DBPath
	if dbPath == "" {
		dbPath = "../data/pipeline.db"
	}
	if !filepath.IsAbs(dbPath) {
		dbPath = filepath.Join(daemonRoot, dbPath)
	}
	if p := os.Getenv("PIPELINE_DB_PATH"); p != "" {
		dbPath = p
	}
	client, err := store.NewLocal(dbPath, func() (map[string]any, error) {
		return resolver.Settings()
	})
	if err != nil {
		log.Fatalf("[Daemon:%s] 💥 SQLite indisponible (%s) : %v", m.ID, dbPath, err)
	}

	// Logger : fichier dédié par instance (logs/daemon-<id>.log).
	resolver.Invalidate()
	settings, _ := resolver.Settings()
	logOpts := logger.Options{
		Level:    settingString(settings, "logLevel", "INFO"),
		Filename: "daemon-" + m.ID + ".log",
	}
	instanceLogger, err := logger.New(logDir, logOpts)
	if err != nil {
		log.Printf("[Daemon:%s] ⚠️ Logger fichier indisponible: %v", m.ID, err)
	}
	fan.add(instanceLogger)
	log.SetOutput(fan)
	log.SetFlags(0)

	inst := &instance{meta: m, client: client, resolver: resolver, log: instanceLogger, trigger: make(chan struct{}, 1)}

	// API HTTP du studio : un port par instance.
	{
		srv := api.New(client, cfgPath, resolver)
		srv.Trigger = inst.trigger
		srv.LogPath = filepath.Join(logDir, "daemon-"+m.ID+".log")
		srv.Pipelines = all
		addr := listenAddr(m.Port)
		go func() {
			log.Printf("[Daemon:%s] API studio sur %s (signaux : %s)", m.ID, addr, dbPath)
			if err := http.ListenAndServe(addr, api.CORS(srv.Mux)); err != nil {
				log.Fatalf("[Daemon:%s] 💥 Impossible de joindre le studio : écoute sur %s échouée (%v).", m.ID, addr, err)
			}
		}()
	}

	instanceLogger.Info("Daemon", "==========================================")
	instanceLogger.Info("Daemon", "   L'ASSEZ — PIPELINE "+strings.ToUpper(m.Name)+" (Go)")
	instanceLogger.Info("Daemon", "==========================================")
	instanceLogger.Info("Daemon", "[Daemon] Stockage : "+client.BaseURL())
	instanceLogger.Info("Daemon", "[Daemon] Journalisation : niveau="+logOpts.Level+" (daemon-"+m.ID+".log)")

	return inst
}

// run — les deux boucles autonomes de l'instance (pipeline + publisher).
func (inst *instance) run() {
	// Purge périodique des vieux journaux (rétention système).
	go pruneLogsLoop(inst.client, inst.resolver, inst.log)

	// 1. Boucle principale (ingestion → rédaction) avec planification.
	//    Un scan manuel (POST /api/scan du studio) réveille l'attente immédiatement.
	go func() {
		for {
			settings, _ := inst.resolver.Settings()
			next := scheduler.Compute(settings, time.Now())
			inst.log.Info("Daemon", "⏳ Prochain scan programmé : "+next.Label+" ("+formatMinutes(next.Delay)+" min).")
			select {
			case <-inst.trigger:
				inst.log.Info("Daemon", "⚡ Scan manuel demandé par le studio — cycle immédiat.")
			case <-time.After(next.Delay):
			}

			if err := inst.runCycle(); err != nil {
				inst.log.Error("Daemon", "❌ Erreur critique dans le pipeline : "+err.Error())
			}
		}
	}()

	// 2. Boucle publisher (tour de contrôle) toutes les 2 minutes + heartbeat.
	go func() {
		for {
			pubStart := time.Now()
			pubErr := nodes.RunPublisher(inst.client, inst.resolver)
			nodes.RecordBrickRun("publisher", "Publisher", pubErr, time.Since(pubStart))
			recordPublisherRun(inst.client, pubStart)
			if pubErr != nil {
				inst.log.Error("Daemon", "❌ Erreur dans la boucle Publisher : "+pubErr.Error())
			}

			// Heartbeat : rafraîchit updatedAt.
			if err := inst.client.UpdateSettings(map[string]any{"updatedAt": time.Now().UTC().Format(time.RFC3339)}); err != nil {
				inst.log.Warn("Daemon", "⚠️ Heartbeat updatedAt : "+err.Error())
			}
			inst.resolver.Invalidate()
			time.Sleep(2 * time.Minute)
		}
	}()
}

// runCycle — un passage complet du pipeline de l'instance.
func (inst *instance) runCycle() error {
	return pipeline.RunCycle(inst.client, inst.resolver, inst.log)
}

func (inst *instance) close() {
	inst.log.Close()
}

// listenAddr — port de l'API de l'instance. Pour l'instance historique :4406,
// on respecte les envs STUDIO_API_ADDR / DAEMON_PORT (compat). Les autres
// instances utilisent leur port déclaré dans le registre.
func listenAddr(port int) string {
	if port == 0 || port == 4406 {
		if addr := os.Getenv("STUDIO_API_ADDR"); addr != "" {
			return addr
		}
		if p := os.Getenv("DAEMON_PORT"); p != "" {
			return ":" + p
		}
		return ":4406"
	}
	return ":" + strconv.Itoa(port)
}

// ── Fan-out des log.Printf des nœuds vers tous les logger d'instances ──────

type logFan struct {
	mu      sync.Mutex
	loggers []*logger.Logger
}

func (f *logFan) add(l *logger.Logger) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if l != nil {
		f.loggers = append(f.loggers, l)
	}
}

// Write (io.Writer) — chaque ligne log.Printf est dupliquée vers toutes les
// instances : chaque daemon-<id>.log garde la trace complète de ses nœuds.
func (f *logFan) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, l := range f.loggers {
		if line != "" {
			l.Stdout(line)
		}
	}
	return len(p), nil
}

func (f *logFan) closeAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, l := range f.loggers {
		l.Close()
	}
	f.loggers = nil
}

var _ io.Writer = (*logFan)(nil)

// ── Helpers partagés ────────────────────────────────────────────────────────

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
