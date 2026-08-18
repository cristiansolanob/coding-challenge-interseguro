// Package client implements the outbound adapter to the downstream Node
// API. It satisfies internal/http.DownstreamClient structurally; the
// interface itself is declared consumer-side (in internal/http) so the
// handler never needs to import this package.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	httpdto "github.com/interseguro/matrix-qr-api/internal/http"
)

// NodeAPI is an HTTP client for the downstream Node API.
type NodeAPI struct {
	baseURL string
	path    string
	timeout time.Duration
	client  *http.Client
}

// New builds a NodeAPI client. timeout governs the per-request context
// deadline; the shared *http.Client itself has Timeout: 0 so context
// propagation (not the client-wide timeout) is what cancels the call,
// making the deadline testable via a deliberately slow httptest server.
func New(baseURL, path string, timeout time.Duration) *NodeAPI {
	return &NodeAPI{
		baseURL: baseURL,
		path:    path,
		timeout: timeout,
		client: &http.Client{
			Timeout: 0,
		},
	}
}

// Send posts the rotated matrix and its QR factorization to the
// downstream Node API and returns its JSON response body verbatim. Any
// connection failure, context deadline, or non-2xx status is returned
// as an error; the caller (internal/http) maps it to 502
// DOWNSTREAM_UNAVAILABLE.
func (n *NodeAPI) Send(ctx context.Context, p httpdto.DownstreamPayload) (json.RawMessage, error) {
	ctx, cancel := context.WithTimeout(ctx, n.timeout)
	defer cancel()

	payload, err := json.Marshal(p)
	if err != nil {
		return nil, fmt.Errorf("client: encode payload: %w", err)
	}

	url := n.baseURL + n.path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("client: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("client: request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("client: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("client: downstream returned status %d", resp.StatusCode)
	}

	return json.RawMessage(body), nil
}
