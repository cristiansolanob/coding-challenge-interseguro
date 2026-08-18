// Package http implements the HTTP transport layer: request/response
// DTOs, the request pipeline (decode -> validate -> rotate -> shape
// guard -> factorize -> downstream -> respond), and the error mapper.
// It depends on the pure internal/matrix and internal/qr packages and
// on a consumer-defined DownstreamClient interface, but never imports
// internal/client directly, so handler tests run against a fake with no
// live Node API and no import cycle.
package http

import (
	"context"
	"encoding/json"
)

// MatrixRequest is the decoded request body for POST /api/v1/matrix/qr.
type MatrixRequest struct {
	Matrix [][]float64 `json:"matrix"`
}

// MatrixDims describes a matrix's shape.
type MatrixDims struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

// MatrixValues describes a matrix's shape plus its values.
type MatrixValues struct {
	Rows   int         `json:"rows"`
	Cols   int         `json:"cols"`
	Values [][]float64 `json:"values"`
}

// DownstreamResult carries the outcome of the outbound call to the Node
// API, with Body passed through byte-for-byte via json.RawMessage.
type DownstreamResult struct {
	Status string          `json:"status"`
	Body   json.RawMessage `json:"body"`
}

// MatrixResponse is the successful (200) response body.
type MatrixResponse struct {
	Input      MatrixDims       `json:"input"`
	Rotated    MatrixValues     `json:"rotated"`
	Q          MatrixValues     `json:"q"`
	R          MatrixValues     `json:"r"`
	Downstream DownstreamResult `json:"downstream"`
}

// ErrorDetail is the machine-readable payload of an error response.
type ErrorDetail struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

// ErrorResponse wraps ErrorDetail under the documented "error" envelope.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// DownstreamPayload is the request body sent to the downstream Node API:
// the rotated matrix plus its QR factorization.
type DownstreamPayload struct {
	Matrix [][]float64 `json:"matrix"`
	Q      [][]float64 `json:"q"`
	R      [][]float64 `json:"r"`
}

// DownstreamClient is the consumer-side seam for the outbound call to
// the Node API. It is declared here (in internal/http) rather than in
// internal/client so this package stays free of any dependency on the
// concrete client implementation; handler tests substitute a fake.
type DownstreamClient interface {
	Send(ctx context.Context, p DownstreamPayload) (json.RawMessage, error)
}
