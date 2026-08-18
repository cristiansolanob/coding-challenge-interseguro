// Package config loads service configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds runtime configuration for the service.
type Config struct {
	// Port is the HTTP port the service listens on.
	Port string
	// NodeAPIURL is the base URL of the downstream Node API.
	NodeAPIURL string
	// NodeAPITimeout bounds the outbound call to the downstream Node API.
	NodeAPITimeout time.Duration
	// NodeAPIPath is the downstream endpoint path appended to NodeAPIURL.
	NodeAPIPath string
}

const (
	defaultPort           = "3000"
	defaultNodeAPITimeout = 5 * time.Second
)

// Load reads configuration from the environment, applying documented
// defaults (PORT=3000, NODE_API_TIMEOUT=5s) when the corresponding
// variable is unset or empty.
func Load() (Config, error) {
	cfg := Config{
		Port:           defaultPort,
		NodeAPITimeout: defaultNodeAPITimeout,
	}

	if v := os.Getenv("PORT"); v != "" {
		cfg.Port = v
	}

	if v := os.Getenv("NODE_API_URL"); v != "" {
		cfg.NodeAPIURL = v
	}

	if v := os.Getenv("NODE_API_PATH"); v != "" {
		cfg.NodeAPIPath = v
	}

	if v := os.Getenv("NODE_API_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return Config{}, fmt.Errorf("invalid NODE_API_TIMEOUT %q: %w", v, err)
		}
		cfg.NodeAPITimeout = d
	}

	return cfg, nil
}
