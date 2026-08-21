// Package scheduler computes the delay until the next pipeline scan from the
// radar-settings global, mirroring radar_lassez/daemon.ts getDelayToNextScan:
//   - mode "pulse": fixed interval (scrapingInterval minutes)
//   - mode "calendar"/"hybrid": next slot from daemonSchedule (weekly grid),
//     falling back to the interval when no schedule is configured
package scheduler

import (
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
// (the radar-settings global as returned by the Payload API).
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
