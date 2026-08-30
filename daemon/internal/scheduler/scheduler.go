// Package scheduler computes the delay until the next pipeline scan from the
// config (section scheduling), mirroring radar_lassez/daemon.ts getDelayToNextScan:
//   - mode "pulse": fixed interval (scrapingInterval minutes)
//   - mode "calendar"/"hybrid": next slot from daemonSchedule (weekly grid),
//     falling back to the interval when no schedule is configured
//
// Le modèle est une « cadence » hebdomadaire à la humaine :
//   - plusieurs heures par jour (une ligne par créneau : "LUN 20:08")
//   - semaines A/B : "LUN 20:08 A" = semaines ISO impaires, "B" = paires
//   - fenêtre d'activité (schedulingActiveFrom/Until) : la pipeline ne tourne
//     qu'entre ces dates — « 3 jours par semaine puis plus jamais »
//   - publications planifiées : NextPublishAt renvoie la prochaine heure de
//     publication (heure explicite du créneau ou scan + publishOffsetMinutes)
package scheduler

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// NextScan describes when the next pipeline cycle should run.
type NextScan struct {
	Delay time.Duration
	Label string
}

var dayMap = map[string]int{
	"DIM": 0, "LUN": 1, "MAR": 2, "MER": 3, "JEU": 4, "VEN": 5, "SAM": 6,
}

// Compute returns the delay to the next scan for the given settings map
// (le bloc scheduling du YAML, cf. config/config.yaml).
func Compute(settings map[string]any, now time.Time) NextScan {
	interval := 60
	if v, ok := settings["scrapingInterval"].(float64); ok && v > 0 {
		interval = int(v)
	}
	fallback := time.Duration(interval) * time.Minute

	mode := "hybrid"
	if v, ok := settings["schedulingMode"].(string); ok && v != "" {
		mode = v
	}
	if mode == "pulse" {
		return NextScan{Delay: fallback, Label: intervalLabel(interval)}
	}

	// Fenêtre d'activité : avant activeFrom → attendre la date ; après
	// activeUntil → la pipeline dort (plus jamais de scan).
	if until := parseActiveDate(settings, "schedulingActiveUntil"); until != nil && now.After(*until) {
		return NextScan{Delay: 365 * 24 * time.Hour, Label: "inactive — fin de programmation atteinte"}
	}
	if from := parseActiveDate(settings, "schedulingActiveFrom"); from != nil && now.Before(*from) {
		return NextScan{Delay: from.Sub(now), Label: "démarre le " + from.Format("02/01/2006")}
	}

	schedule := ""
	if v, ok := settings["daemonSchedule"].(string); ok {
		schedule = v
	}
	trimmed := strings.TrimSpace(schedule)
	if trimmed == "" || trimmed == "[]" || trimmed == "{}" {
		return NextScan{Delay: fallback, Label: intervalLabel(interval)}
	}

	lines := splitLines(trimmed)
	if len(lines) == 0 {
		return NextScan{Delay: fallback, Label: intervalLabel(interval)}
	}

	currentDay := int(now.Weekday())
	currentMinutes := now.Hour()*60 + now.Minute()

	bestDelay := time.Duration(math.MaxInt64)
	bestLabel := ""

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		days := strings.Split(strings.ToUpper(parts[0]), ",")
		timeParts := strings.Split(parts[1], ":")
		if len(timeParts) < 2 {
			continue
		}
		targetHour, errH := strconv.Atoi(timeParts[0])
		targetMin, errM := strconv.Atoi(timeParts[1])
		if errH != nil || errM != nil {
			continue
		}
		targetTotal := targetHour*60 + targetMin
		week := ""
		if len(parts) >= 3 {
			week = strings.ToUpper(parts[2])
		}

		for _, d := range days {
			targetDay, ok := dayMap[strings.TrimSpace(d)]
			if !ok {
				continue
			}
			daysDiff := targetDay - currentDay
			minutesDiff := targetTotal - currentMinutes
			if daysDiff < 0 || (daysDiff == 0 && minutesDiff <= 0) {
				daysDiff += 7
			}
			// Semaines A/B : le filtre s'applique à la semaine CIBLE du créneau.
			if !weekMatches(week, now.AddDate(0, 0, daysDiff)) {
				continue
			}
			if daysDiff == 0 && minutesDiff > 0 {
				delay := time.Duration(minutesDiff)*time.Minute - time.Duration(now.Second())*time.Second - time.Duration(now.Nanosecond())
				if delay < bestDelay {
					bestDelay = delay
					bestLabel = "Aujourd'hui à " + parts[1]
				}
			} else if daysDiff > 0 {
				delay := time.Duration(daysDiff*24*60+minutesDiff)*time.Minute - time.Duration(now.Second())*time.Second - time.Duration(now.Nanosecond())
				if delay < bestDelay {
					bestDelay = delay
					bestLabel = strings.TrimSpace(d) + " à " + parts[1]
				}
			}
		}
	}

	if bestDelay != time.Duration(math.MaxInt64) && bestDelay > 0 {
		return NextScan{Delay: bestDelay, Label: bestLabel}
	}
	return NextScan{Delay: fallback, Label: intervalLabel(interval)}
}

// NextPublishAt — la prochaine heure de publication PLANIFIÉE >= after :
// pour chaque créneau, la publication part à l'heure explicite (publish) ou à
// scan + publishOffsetMinutes (offset par défaut 30 min). Les semaines A/B
// sont respectées sur la semaine cible. Renvoie nil si aucun créneau → le
// publisher retombe sur son délai aléatoire historique.
func NextPublishAt(settings map[string]any, after time.Time) *time.Time {
	offset := 30
	if v, ok := settings["schedulingPublishOffsetMinutes"].(float64); ok && v >= 0 {
		offset = int(v)
	}
	slotsRaw, _ := settings["weeklySlots"].([]any)
	if len(slotsRaw) == 0 {
		return nil
	}
	var best *time.Time
	for _, sl := range slotsRaw {
		m, ok := sl.(map[string]any)
		if !ok {
			continue
		}
		day, _ := m["day"].(string)
		scan, _ := m["time"].(string)
		week, _ := m["week"].(string)
		if _, ok := dayMap[day]; !ok {
			continue
		}
		pubDay, pubClock := planPublishClock(day, scan, m["publish"], offset)
		at := nextClock(pubDay, pubClock, after)
		if at == nil {
			continue
		}
		// Semaine A/B de la semaine cible de la publication.
		if !weekMatches(week, *at) {
			continue
		}
		if best == nil || at.Before(*best) {
			b := *at
			best = &b
		}
	}
	return best
}

// planPublishClock — jour + heure de publication pour un créneau :
// heure explicite (publish) le jour du créneau, sinon scan + offset (qui peut
// passer minuit → la publication tombe le lendemain).
func planPublishClock(day, scan string, publish any, offset int) (string, string) {
	if p, ok := publish.(string); ok && strings.TrimSpace(p) != "" {
		return day, strings.TrimSpace(p)
	}
	h, m, err := parseClockParts(scan)
	if err != nil {
		return day, "00:00"
	}
	total := h*60 + m + offset
	if total >= 24*60 {
		return nextDayKey(day), fmt.Sprintf("%02d:%02d", (total-24*60)/60, (total-24*60)%60)
	}
	return day, fmt.Sprintf("%02d:%02d", total/60, total%60)
}

// nextClock — prochaine occurrence (>= after) du jour + heure donnés.
func nextClock(day, clock string, after time.Time) *time.Time {
	dayIdx, ok := dayMap[day]
	if !ok {
		return nil
	}
	h, m, err := parseClockParts(clock)
	if err != nil {
		return nil
	}
	cand := time.Date(after.Year(), after.Month(), after.Day(), 0, 0, 0, 0, after.Location())
	diff := (dayIdx - int(after.Weekday()) + 7) % 7
	cand = cand.AddDate(0, 0, diff)
	cand = time.Date(cand.Year(), cand.Month(), cand.Day(), h, m, 0, 0, after.Location())
	if !cand.After(after) {
		cand = cand.AddDate(0, 0, 7)
	}
	return &cand
}

func parseClockParts(clock string) (int, int, error) {
	parts := strings.Split(clock, ":")
	if len(parts) < 2 {
		return 0, 0, fmt.Errorf("heure invalide %q", clock)
	}
	h, errH := strconv.Atoi(parts[0])
	m, errM := strconv.Atoi(parts[1])
	if errH != nil || errM != nil {
		return 0, 0, fmt.Errorf("heure invalide %q", clock)
	}
	return h, m, nil
}

func nextDayKey(day string) string {
	if idx, ok := dayMap[day]; ok {
		for k, v := range dayMap {
			if v == (idx+1)%7 {
				return k
			}
		}
	}
	return day
}

// weekMatches — un créneau « A » ne tourne que les semaines ISO impaires,
// « B » les semaines paires ; sans marqueur → toutes les semaines.
func weekMatches(week string, at time.Time) bool {
	_, iso := at.ISOWeek()
	odd := iso%2 == 1
	switch week {
	case "A":
		return odd
	case "B":
		return !odd
	}
	return true
}

// parseActiveDate — lit "2006-01-02" (ou RFC3339) ; pour activeUntil renvoie
// la fin de journée, pour activeFrom le début.
func parseActiveDate(settings map[string]any, key string) *time.Time {
	s, _ := settings[key].(string)
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	var t time.Time
	if parsed, err := time.ParseInLocation("2006-01-02", s, time.Local); err == nil {
		t = parsed
	} else if parsed, err := time.Parse(time.RFC3339, s); err == nil {
		t = parsed
	} else {
		return nil
	}
	if key == "schedulingActiveUntil" {
		t = t.Add(24*time.Hour - time.Second)
	}
	return &t
}

// splitLines splits on newlines and semicolons (mirrors TS split(/[\n;]+/)).
func splitLines(s string) []string {
	var out []string
	for _, l := range strings.FieldsFunc(s, func(r rune) bool { return r == '\n' || r == ';' }) {
		if l = strings.TrimSpace(l); l != "" {
			out = append(out, l)
		}
	}
	return out
}

func intervalLabel(minutes int) string {
	return strconv.Itoa(minutes) + " minutes"
}
