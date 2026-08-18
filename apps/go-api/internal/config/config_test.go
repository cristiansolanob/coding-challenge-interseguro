package config

import "testing"

// Scenario: Defaults apply when env vars are unset (spec: service-runtime)
func TestLoad_DefaultsWhenUnset(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("NODE_API_URL", "")
	t.Setenv("NODE_API_TIMEOUT", "")
	t.Setenv("NODE_API_PATH", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}
	if cfg.Port != "3000" {
		t.Errorf("Port = %q, want %q", cfg.Port, "3000")
	}
	if cfg.NodeAPITimeout.String() != "5s" {
		t.Errorf("NodeAPITimeout = %v, want 5s", cfg.NodeAPITimeout)
	}
}

// Scenario: Env vars override defaults (spec: service-runtime)
func TestLoad_OverridesFromEnv(t *testing.T) {
	t.Setenv("PORT", "8080")
	t.Setenv("NODE_API_TIMEOUT", "2s")
	t.Setenv("NODE_API_URL", "http://localhost:4000")
	t.Setenv("NODE_API_PATH", "/api/v1/statistics")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want %q", cfg.Port, "8080")
	}
	if cfg.NodeAPITimeout.String() != "2s" {
		t.Errorf("NodeAPITimeout = %v, want 2s", cfg.NodeAPITimeout)
	}
	if cfg.NodeAPIURL != "http://localhost:4000" {
		t.Errorf("NodeAPIURL = %q, want %q", cfg.NodeAPIURL, "http://localhost:4000")
	}
	if cfg.NodeAPIPath != "/api/v1/statistics" {
		t.Errorf("NodeAPIPath = %q, want %q", cfg.NodeAPIPath, "/api/v1/statistics")
	}
}

// Invalid NODE_API_TIMEOUT duration must produce an error, not a panic or silent default.
func TestLoad_InvalidTimeoutReturnsError(t *testing.T) {
	t.Setenv("NODE_API_TIMEOUT", "not-a-duration")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error for invalid NODE_API_TIMEOUT, got nil")
	}
}
