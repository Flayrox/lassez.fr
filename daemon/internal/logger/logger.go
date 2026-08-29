// Package logger provides the daemon logger: coloured stdout output plus a
// local file with 10MB rotation (daemon.log). Il remplace le logger TS de
// radar_lassez/lib/logger.ts.
package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const maxLogSize = 10 * 1024 * 1024 // 10 MB

var (
	nodeRe   = regexp.MustCompile(`\[Node (\d+)[:\]]`)
	daemonRe = regexp.MustCompile(`\[Daemon\]`)
	ansiRe   = regexp.MustCompile(`\x1B\[\d+m`)
)

// Options tunes how entries are persisted. All values have defaults when
// zero-valued, so New(dir, Options{}) behaves like the previous version
// (INFO level).
type Options struct {
	// Level is the minimum severity persisted to the local file.
	// Empty means INFO. SUCCESS entries are always kept.
	Level string
}

// Level ranks, DEBUG < INFO < WARN < ERROR < SUCCESS. SUCCESS always wins.
var levelRank = map[string]int{"DEBUG": 0, "INFO": 1, "WARN": 2, "ERROR": 3, "SUCCESS": 4}

// Logger writes daemon entries to stdout and a rotating local file.
type Logger struct {
	mu       sync.Mutex
	file     *os.File
	dir      string
	minLevel int
}

// New creates a Logger. dir is where daemon.log lives ; pass "" for ./logs.
// opts tunes level filtering; zero-valued fields keep their defaults.
func New(dir string, opts Options) (*Logger, error) {
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

	level := strings.ToUpper(strings.TrimSpace(opts.Level))
	if _, ok := levelRank[level]; !ok {
		level = "INFO"
	}

	return &Logger{
		file:     f,
		dir:      dir,
		minLevel: levelRank[level],
	}, nil
}

// Close ferme le fichier de log.
func (l *Logger) Close() {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		_ = l.file.Close()
	}
}

// log writes one entry: toujours à stdout, persiste dans le fichier quand le
// niveau le permet.
func (l *Logger) log(level, nodeID, message string) {
	if nodeID == "" {
		nodeID = detectNodeID(message)
	}
	ts := time.Now().UTC().Format(time.RFC3339)

	// Level filtering applies to the file ; the terminal always shows
	// everything so an operator never loses a line.
	persist := levelRank[level] >= l.minLevel || level == "SUCCESS"

	if persist && l.file != nil {
		l.mu.Lock()
		_, _ = fmt.Fprintf(l.file, "[%s] [%s] [%s] %s\n", ts, level, nodeID, ansiRe.ReplaceAllString(message, ""))
		l.mu.Unlock()
	}

	colors := map[string]string{"INFO": "\x1b[34m", "WARN": "\x1b[33m", "ERROR": "\x1b[31m", "SUCCESS": "\x1b[32m", "RESET": "\x1b[0m"}
	fmt.Fprintf(os.Stdout, "%s[%s] [%s] %s%s\n", colors[level], ts, nodeID, message, colors["RESET"])
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

// detectNodeID extracts "[Node N]" or "[Daemon]" from a message, defaulting
// to SYSTEM.
func detectNodeID(message string) string {
	if m := nodeRe.FindStringSubmatch(message); len(m) > 1 {
		return "Node " + m[1]
	}
	if daemonRe.MatchString(message) {
		return "Daemon"
	}
	return "SYSTEM"
}
