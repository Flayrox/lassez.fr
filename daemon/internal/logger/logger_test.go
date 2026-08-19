package logger

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// readLog reads the daemon.log written in dir.
func readLog(t *testing.T, dir string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, "daemon.log"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestLevelFiltering(t *testing.T) {
	dir := t.TempDir()
	l, err := New(nil, dir, Options{Level: "WARN"})
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	l.Info("Daemon", "info message should be filtered")
	l.Warn("Daemon", "warn message should persist")
	l.Error("Daemon", "error message should persist")
	l.Close()

	log := readLog(t, dir)
	if strings.Contains(log, "info message") {
		t.Error("INFO entries must be filtered when Level=WARN")
	}
	if !strings.Contains(log, "warn message") {
		t.Error("WARN entries must persist when Level=WARN")
	}
	if !strings.Contains(log, "error message") {
		t.Error("ERROR entries must persist when Level=WARN")
	}
}

func TestSuccessAlwaysPersisted(t *testing.T) {
	dir := t.TempDir()
	l, err := New(nil, dir, Options{Level: "ERROR"})
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	l.Success("Daemon", "success message always kept")
	l.Close()

	log := readLog(t, dir)
	if !strings.Contains(log, "success message") {
		t.Error("SUCCESS entries must always be persisted, even at ERROR level")
	}
}

func TestLevelDefaultsToInfo(t *testing.T) {
	dir := t.TempDir()
	l, err := New(nil, dir, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if l.minLevel != levelRank["INFO"] {
		t.Errorf("default level must be INFO, got rank %d", l.minLevel)
	}
	if l.mirror {
		t.Error("mirror must be disabled when no client is provided")
	}

	l.Info("Daemon", "default info persists")
	l.Close()

	if !strings.Contains(readLog(t, dir), "default info persists") {
		t.Error("INFO entries must persist at the default level")
	}
}
