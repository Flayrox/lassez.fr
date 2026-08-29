// Telemetry — état de santé temps réel de chaque brique du pipeline,
// exposé au studio par GET /api/system-health (page Système + Dashboard).
//
// Chaque nœud enregistre sa dernière exécution (durée + erreur). Règles de
// statut : succès → "ok" (échecs consécutifs remis à zéro), échec → "warning",
// 3 échecs consécutifs ou plus → "danger", jamais exécuté → "idle".
package nodes

import (
	"sync"
	"time"
)

// Brick — état d'une brique du pipeline.
type Brick struct {
	Type       string    `json:"type"`
	Label      string    `json:"label"`
	Status     string    `json:"status"` // idle | ok | warning | danger
	LastRun    time.Time `json:"lastRun,omitempty"`
	DurationMS int64     `json:"durationMs,omitempty"`
	LastError  string    `json:"lastError,omitempty"`
	Errors     int       `json:"errors"` // échecs consécutifs
}

// DaemonInfo — métadonnées du daemon (uptime, dernier cycle, qoe.fi).
type DaemonInfo struct {
	StartedAt           time.Time `json:"startedAt,omitempty"`
	UptimeSeconds       int64     `json:"uptimeSeconds"`
	LastCycleAt         time.Time `json:"lastCycleAt,omitempty"`
	LastCycleDurationMS int64     `json:"lastCycleDurationMs,omitempty"`
	LastCycleError      string    `json:"lastCycleError,omitempty"`
	CycleCount          int64     `json:"cycleCount"`
	QoeMock             bool      `json:"qoeMock"`
	QoePublicationID    string    `json:"qoePublicationId,omitempty"`
}

// brickCatalog — l'ordre d'affichage + les libellés des briques connues.
// Les briques jamais exécutées apparaissent quand même en "idle".
var brickCatalog = []struct{ Type, Label string }{
	{"ingestion", "Ingestion"},
	{"dedup", "Dédoublonnage"},
	{"research", "Researcher"},
	{"editor", "Editorialist"},
	{"validator", "Validator"},
	{"media", "Média"},
	{"publisher", "Publisher"},
}

var (
	teleMu  sync.RWMutex
	bricks  = map[string]*Brick{}
	started = time.Now()
	cycle   = struct {
		lastAt  time.Time
		lastDur time.Duration
		lastErr string
		count   int64
	}{}
)

// RecordBrickRun — enregistre la fin d'exécution d'une brique du pipeline.
func RecordBrickRun(nodeType, label string, err error, dur time.Duration) {
	teleMu.Lock()
	defer teleMu.Unlock()
	b := bricks[nodeType]
	if b == nil {
		b = &Brick{Type: nodeType, Label: label}
		bricks[nodeType] = b
	}
	b.LastRun = time.Now()
	b.DurationMS = dur.Milliseconds()
	if err != nil {
		b.Errors++
		b.LastError = err.Error()
		if b.Errors >= 3 {
			b.Status = "danger"
		} else {
			b.Status = "warning"
		}
		return
	}
	b.Errors = 0
	b.LastError = ""
	b.Status = "ok"
}

// RecordCycleDone — bilan global d'un cycle complet (pour le "dernier passage").
func RecordCycleDone(err error, dur time.Duration) {
	teleMu.Lock()
	defer teleMu.Unlock()
	cycle.lastAt = time.Now()
	cycle.lastDur = dur
	cycle.count++
	if err != nil {
		cycle.lastErr = err.Error()
	} else {
		cycle.lastErr = ""
	}
}

// TelemetrySnapshot — copie lisible de l'état (briques ordonnées + daemon).
func TelemetrySnapshot() ([]Brick, DaemonInfo) {
	teleMu.RLock()
	defer teleMu.RUnlock()

	out := make([]Brick, 0, len(brickCatalog)+1)
	for _, c := range brickCatalog {
		if b, ok := bricks[c.Type]; ok {
			out = append(out, *b)
			continue
		}
		out = append(out, Brick{Type: c.Type, Label: c.Label, Status: "idle"})
	}

	info := DaemonInfo{
		StartedAt:           started,
		UptimeSeconds:       int64(time.Since(started).Seconds()),
		LastCycleAt:         cycle.lastAt,
		LastCycleDurationMS: cycle.lastDur.Milliseconds(),
		LastCycleError:      cycle.lastErr,
		CycleCount:          cycle.count,
	}
	return out, info
}
