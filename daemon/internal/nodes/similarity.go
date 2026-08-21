package nodes

import "strings"

// compareTwoStrings ports npm's string-similarity compareTwoStrings: a
// bigram Sørensen–Dice coefficient over the whitespace-stripped strings.
func compareTwoStrings(first, second string) float64 {
	f := []rune(strings.Join(strings.Fields(first), ""))
	s := []rune(strings.Join(strings.Fields(second), ""))

	if string(f) == string(s) {
		return 1
	}
	if len(f) < 2 || len(s) < 2 {
		return 0
	}

	firstBigrams := map[string]int{}
	for i := 0; i < len(f)-1; i++ {
		firstBigrams[string(f[i:i+2])]++
	}

	intersection := 0
	for i := 0; i < len(s)-1; i++ {
		bg := string(s[i : i+2])
		if count := firstBigrams[bg]; count > 0 {
			firstBigrams[bg] = count - 1
			intersection++
		}
	}

	return (2.0 * float64(intersection)) / float64(len(f)+len(s)-2)
}

func containsString(list []string, value string) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}
