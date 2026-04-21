package service

// Config holds shared configuration for all services.
type Config struct {
	OmdbAPIKey string
	TimeZone   string // e.g. "America/New_York"
}
