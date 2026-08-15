package scheduler

import (
	"testing"
	"time"
)

// fixedNow is a Wednesday 2026-08-12 10:30:00 local.
func fixedNow() time.Time {
	return time.Date(2026, 8, 12, 10, 30, 0, 0, time.Local)
}

func TestPulseMode(t *testing.T) {
	settings := map[string]any{"schedulingMode": "pulse", "scrapingInterval": float64(45)}
	got := Compute(settings, fixedNow())
	if got.Delay != 45*time.Minute {
		t.Fatalf("expected 45m, got %v", got.Delay)
	}
	if got.Label != "45 minutes" {
		t.Fatalf("unexpected label %q", got.Label)
	}
}

func TestFallbackIntervalWhenNoSchedule(t *testing.T) {
	for _, s := range []map[string]any{
		{"schedulingMode": "calendar"},
		{"schedulingMode": "calendar", "daemonSchedule": ""},
		{"schedulingMode": "calendar", "daemonSchedule": "[]"},
		{"schedulingMode": "hybrid", "daemonSchedule": "{}"},
	} {
		got := Compute(s, fixedNow())
		if got.Delay != 60*time.Minute {
			t.Fatalf("settings %v: expected 60m fallback, got %v", s, got.Delay)
		}
	}
}

func TestCalendarLaterToday(t *testing.T) {
	// Mercredi 10:30, prochain créneau mercredi 14:00 → 3h30.
	settings := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "MER 14:00",
	}
	got := Compute(settings, fixedNow())
	if got.Delay != 3*time.Hour+30*time.Minute {
		t.Fatalf("expected 3h30, got %v", got.Delay)
	}
	if got.Label != "Aujourd'hui à 14:00" {
		t.Fatalf("unexpected label %q", got.Label)
	}
}

func TestCalendarNextDay(t *testing.T) {
	// Mercredi 10:30, prochain créneau VEN 08:00 → 1j 21h30.
	settings := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "VEN 08:00",
	}
	got := Compute(settings, fixedNow())
	want := (24*60 + 21*60 + 30) * time.Minute
	if got.Delay != want {
		t.Fatalf("expected %v, got %v", want, got.Delay)
	}
	if got.Label != "VEN à 08:00" {
		t.Fatalf("unexpected label %q", got.Label)
	}
}

func TestCalendarMultipleDays(t *testing.T) {
	// Mercredi 10:30 → LUN/MER/JEU 09:00 → le plus proche est JEU 09:00 (22h30).
	settings := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "LUN,MER,JEU 09:00",
	}
	got := Compute(settings, fixedNow())
	want := 22*time.Hour + 30*time.Minute
	if got.Delay != want {
		t.Fatalf("expected %v, got %v", want, got.Delay)
	}
}

func TestCalendarSemicolonLines(t *testing.T) {
	settings := map[string]any{
		"schedulingMode": "hybrid",
		"daemonSchedule": "LUN 08:00; JEU 16:30\nSAM 12:00",
	}
	got := Compute(settings, fixedNow())
	// Mercredi 10:30 → JEU 16:30 = 1j 6h.
	want := 30 * time.Hour
	if got.Delay != want {
		t.Fatalf("expected %v, got %v", want, got.Delay)
	}
}
