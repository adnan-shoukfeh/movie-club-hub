package handler

import (
	"regexp"
	"strings"
	"unicode"
)

var usernameRegex = regexp.MustCompile(`^[a-z0-9_]{2,32}$`)
var alphanumRegex = regexp.MustCompile(`[^a-zA-Z0-9]`)

func sanitizeUsername(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if len(s) > 32 {
		s = s[:32]
	}
	return s
}

func isValidUsername(username string) bool {
	return usernameRegex.MatchString(username)
}

func sanitizeText(raw string, maxLen int) string {
	s := strings.TrimSpace(raw)
	// Remove control characters
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, s)
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}

func sanitizeGroupName(raw string) string {
	return sanitizeText(raw, 100)
}

func sanitizeMovieTitle(raw string) string {
	return sanitizeText(raw, 200)
}

func sanitizeReview(raw string) string {
	return sanitizeText(raw, 2000)
}

func sanitizeInviteCode(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	s = alphanumRegex.ReplaceAllString(s, "")
	if len(s) > 32 {
		s = s[:32]
	}
	return s
}

func sanitizeImdbID(raw string) string {
	s := strings.TrimSpace(raw)
	s = alphanumRegex.ReplaceAllString(s, "")
	if len(s) > 20 {
		s = s[:20]
	}
	return s
}

func isValidDateStr(s string) bool {
	if len(s) != 10 {
		return false
	}
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}$`, s)
	return matched
}
