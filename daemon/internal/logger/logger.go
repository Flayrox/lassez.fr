// Package logger provides the daemon logger. It mirrors the TS
// radar_lassez/lib/logger.ts: coloured stdout output plus a local file with
// 10MB rotation. On top of that it asynchronously mirrors entries to the
// Payload logs collection, which feeds the admin dashboard heartbeat — the
// TS daemon only wrote to a file, so the dashboard health stayed "late".
package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Flayrox/LASSEZ/daemon/internal/payload"
)

const maxLogSize = 10 * 1024 * 1024 // 10 MB

var (
	nodeRe   = regexp.MustCompile(`\[Node (\d+)[:\]]`)
	daemonRe = regexp.MustCompile(`\[Daemon\]`)
	ansiRe   = regexp.MustCompile(`\x1B\[\d+m`)
)

// Logger writes daemon entries to stdout, a rotating local file and (async)
// to the Payload logs collection.
type Logger struct {
	client *payload.Client
	mu     sync.Mutex
	file   *os.File
	dir    string

	// The Payload mirror is a single worker draining a bounded queue: one
	// goroutine per log line would pile up unboundedly when the API slows
	// down, so we cap the queue and drop entries when it overflows. The
	// queue is closed only under mu with closed=true set first, so a log
	// racing with Close() can never send on a closed channel.
	queue  chan logEntry
	closed bool
	wg     sync.WaitGroup
}

type logEntry struct {
	level   string
	nodeID  string
	message string
}

// queueCap bounds the in-flight Payload mirror entries.
const queueCap = 256

// New creates a Logger. client may be nil (log file only). dir is where
// daemon.log lives; pass "" for ./logs.
func New(client *payload.Client, dir string) (*Logger, error) {
	if dir == "" {
		dir = filepath.Join(".", "logs")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "daemon.log")
	if st, err := os.Stat(path); err == nil && st.Size() >= maxLogSize {
		_ = os.Rename(path, filepath.Join(dir, "daemon.old.log"))
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	l := &Logger{client: client, file: f, dir: dir, queue: make(chan logEntry, queueCap)}
	if client != nil {
		l.wg.Add(1)
		go l.pump()
	}
	return l, nil
}

// enqueue adds an entry to the Payload mirror queue, dropping it when the
// queue is full or the logger is closed (never blocks, never panics).
func (l *Logger) enqueue(e logEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.closed {
		return
	}
	select {
	case l.queue <- e:
	default:
	}
}

// pump drains the queue into the Payload logs collection.
func (l *Logger) pump() {
	defer l.wg.Done()
	for e := range l.queue {
		l.client.AppendLog(e.level, e.nodeID, e.message)
	}
}

// Close drains the queue, stops the Payload worker and closes the log file.
func (l *Logger) Close() {
	if l == nil {
		return
	}
	l.mu.Lock()
	if !l.closed && l.queue != nil {
		l.closed = true
		close(l.queue)
	}
	l.mu.Unlock()
	l.wg.Wait()
	if l.file != nil {
		_ = l.file.Close()
	}
}

// log writes one entry. The Payload mirror runs in a goroutine so a slow API
// can never stall the pipeline.
func (l *Logger) log(level, nodeID, message string) {
	if nodeID == "" {
		nodeID = detectNodeID(message)
	}
	ts := time.Now().UTC().Format(time.RFC3339)

	l.mu.Lock()
	if l.file != nil {
		_, _ = fmt.Fprintf(l.file, "[%s] [%s] [%s] %s\n", ts, level, nodeID, ansiRe.ReplaceAllString(message, ""))
	}
	l.mu.Unlock()

	colors := map[string]string{"INFO": "\x1b[34m", "WARN": "\x1b[33m", "ERROR": "\x1b[31m", "SUCCESS": "\x1b[32m", "RESET": "\x1b[0m"}
	fmt.Fprintf(os.Stdout, "%s[%s] [%s] %s%s\n", colors[level], ts, nodeID, message, colors["RESET"])

	// Enqueue to the Payload mirror, dropping on overflow (never block).
	l.enqueue(logEntry{level: level, nodeID: nodeID, message: message})
}

// Info logs an INFO entry.
func (l *Logger) Info(nodeID, message string) { l.log("INFO", nodeID, message) }

// Warn logs a WARN entry.
func (l *Logger) Warn(nodeID, message string) { l.log("WARN", nodeID, message) }

// Error logs an ERROR entry.
func (l *Logger) Error(nodeID, message string) { l.log("ERROR", nodeID, message) }

// Success logs a SUCCESS entry.
func (l *Logger) Success(nodeID, message string) { l.log("SUCCESS", nodeID, message) }

// Stdout mirrors a raw line to the file as INFO with the detected node.
func (l *Logger) Stdout(line string) {
	l.log("INFO", detectNodeID(line), strings.TrimRight(line, "\n"))
}

// detectNodeID extracts "[Node N]" or "[Daemon]" from a message, mirroring
// the TS logger, defaulting to SYSTEM.
func detectNodeID(message string) string {
	if m := nodeRe.FindStringSubmatch(message); len(m) > 1 {
		return "Node " + m[1]
	}
	if daemonRe.MatchString(message) {
		return "Daemon"
	}
	return "SYSTEM"
}
