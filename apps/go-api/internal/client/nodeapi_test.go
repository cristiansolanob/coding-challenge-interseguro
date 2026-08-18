package client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	httpdto "github.com/interseguro/matrix-qr-api/internal/http"
)

// Scenario: 2xx passthrough — the downstream body is returned verbatim.
func TestNodeAPI_Send_2xxPassthrough(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"mean":3.5,"stddev":1.2}`))
	}))
	defer server.Close()

	na := New(server.URL, "", 2*time.Second)
	body, err := na.Send(context.Background(), httpdto.DownstreamPayload{
		Matrix: [][]float64{{1, 2}},
		Q:      [][]float64{{1}},
		R:      [][]float64{{1}},
	})
	if err != nil {
		t.Fatalf("Send() unexpected error: %v", err)
	}
	if string(body) != `{"mean":3.5,"stddev":1.2}` {
		t.Errorf("Send() body = %s, want verbatim passthrough", body)
	}
}

// Scenario: Downstream returns non-2xx -> error.
func TestNodeAPI_Send_NonSuccessStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	na := New(server.URL, "", 2*time.Second)
	_, err := na.Send(context.Background(), httpdto.DownstreamPayload{})
	if err == nil {
		t.Fatal("Send() expected error for non-2xx response, got nil")
	}
}

// Scenario: Downstream times out / context is cancelled.
func TestNodeAPI_Send_TimeoutOrCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	na := New(server.URL, "", 10*time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	_, err := na.Send(ctx, httpdto.DownstreamPayload{})
	if err == nil {
		t.Fatal("Send() expected timeout error, got nil")
	}
}

// Scenario: Malformed base URL -> error, not panic.
func TestNodeAPI_Send_MalformedURL(t *testing.T) {
	na := New("://not-a-url", "", 2*time.Second)
	_, err := na.Send(context.Background(), httpdto.DownstreamPayload{})
	if err == nil {
		t.Fatal("Send() expected error for malformed URL, got nil")
	}
}
