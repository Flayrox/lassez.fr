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

// weekMatches / Compute : semaines A/B.
func TestWeekParity(t *testing.T) {
	// 2026-08-12 est en semaine ISO 33 (impaire) → A.
	if !weekMatches("A", fixedNow()) || weekMatches("B", fixedNow()) {
		t.Fatalf("semaine ISO 33 attendue comme A (impaire)")
	}
}

func TestCalendarWeekAOnly(t *testing.T) {
	// Mercredi 10:30, semaine ISO impaire (A). Créneau marqué A → se déclenche.
	settings := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "MER 14:00 A",
	}
	got := Compute(settings, fixedNow())
	if got.Delay != 3*time.Hour+30*time.Minute {
		t.Fatalf("créneau A en semaine A : attendu 3h30, got %v", got.Delay)
	}
}

func TestCalendarWeekBOnlySkipped(t *testing.T) {
	// Créneau B en semaine A → aucune occurrence : repli intervalle 60 min.
	settings := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "MER 14:00 B",
	}
	got := Compute(settings, fixedNow())
	if got.Delay != 60*time.Minute {
		t.Fatalf("créneau B en semaine A : attendu repli 60m, got %v", got.Delay)
	}
}

func TestActiveWindow(t *testing.T) {
	// Fenêtre passée → la pipeline dort (1 an).
	past := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "MER 14:00",
		"schedulingActiveUntil": "2026-07-01",
	}
	if got := Compute(past, fixedNow()); got.Delay != 365*24*time.Hour {
		t.Fatalf("après activeUntil : attendu 1 an, got %v", got.Delay)
	}

	// Fenêtre future → attendre la date de démarrage.
	future := map[string]any{
		"schedulingMode": "calendar",
		"daemonSchedule": "MER 14:00",
		"schedulingActiveFrom": "2026-08-20",
	}
	got := Compute(future, fixedNow())
	if got.Delay < 7*24*time.Hour || got.Delay > 8*24*time.Hour {
		t.Fatalf("avant activeFrom : attendu ~7j, got %v", got.Delay)
	}
}

// NextPublishAt : heure explicite, offset, semaines A/B.
func TestNextPublishAtExplicit(t *testing.T) {
	now := fixedNow() // mercredi 10:30, semaine A
	settings := map[string]any{
		"weeklySlots": []any{map[string]any{"day": "MER", "time": "20:08", "publish": "21:00"}},
	}
	got := NextPublishAt(settings, now)
	if got == nil {
		t.Fatal("nil attendu non")
	}
	if got.Hour() != 21 || got.Minute() != 0 {
		t.Fatalf("publication explicite attendue 21:00, got %v", got)
	}
}

func TestNextPublishAtOffset(t *testing.T) {
	now := fixedNow()
	settings := map[string]any{
		"weeklySlots":                  []any{map[string]any{"day": "MER", "time": "20:08"}},
		"schedulingPublishOffsetMinutes": float64(30),
	}
	got := NextPublishAt(settings, now)
	if got == nil {
		t.Fatal("nil attendu non")
	}
	if got.Hour() != 20 || got.Minute() != 38 {
		t.Fatalf("scan 20:08 + 30 min attendu 20:38, got %v", got)
	}
}

func TestNextPublishAtOffsetPastMidnight(t *testing.T) {
	now := fixedNow()
	settings := map[string]any{
		"weeklySlots":                  []any{map[string]any{"day": "MER", "time": "23:50"}},
		"schedulingPublishOffsetMinutes": float64(30),
	}
	got := NextPublishAt(settings, now)
	if got == nil {
		t.Fatal("nil attendu non")
	}
	// 23:50 + 30 min = jeudi 00:20.
	if got.Weekday() != time.Thursday || got.Hour() != 0 || got.Minute() != 20 {
		t.Fatalf("attendu jeudi 00:20, got %v", got)
	}
}

func TestNextPublishAtWeekB(t *testing.T) {
	now := fixedNow() // semaine A
	settings := map[string]any{
		"weeklySlots": []any{map[string]any{"day": "MER", "time": "20:08", "week": "B"}},
	}
	// Créneau B ignoré en semaine A → aucune publication planifiée → nil.
	if got := NextPublishAt(settings, now); got != nil {
		t.Fatalf("créneau B en semaine A : nil attendu, got %v", got)
	}
}

func TestNextPublishAtRollsToNextWeek(t *testing.T) {
	// Mercredi 10:30, créneau uniquement DIM → publication dimanche prochain 20:38.
	now := fixedNow()
	settings := map[string]any{
		"weeklySlots":                  []any{map[string]any{"day": "DIM", "time": "20:08"}},
		"schedulingPublishOffsetMinutes": float64(30),
	}
	got := NextPublishAt(settings, now)
	if got == nil {
		t.Fatal("nil attendu non")
	}
	if got.Weekday() != time.Sunday || got.Hour() != 20 || got.Minute() != 38 {
		t.Fatalf("attendu dimanche 20:38, got %v", got)
	}
}
