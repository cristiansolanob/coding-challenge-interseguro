// Package apierr defines the typed error taxonomy shared across the
// service. Every layer returns *Error instead of raw errors so that the
// HTTP status and machine-readable code travel with the failure and
// cannot drift between packages.
package apierr

import "net/http"

// Error is the canonical typed error for this service. Code is the
// machine-readable identifier documented in the API contract, HTTPStatus
// is the status the transport layer must respond with, Message is a
// human-readable summary, and Details carries optional structured
// context (e.g. which row was ragged).
type Error struct {
	Code       string
	HTTPStatus int
	Message    string
	Details    map[string]any
}

// Error implements the error interface.
func (e *Error) Error() string {
	return e.Message
}

// Known error codes, per the API contract.
const (
	CodeMatrixRequired        = "MATRIX_REQUIRED"
	CodeMatrixEmpty           = "MATRIX_EMPTY"
	CodeMatrixRagged          = "MATRIX_RAGGED"
	CodeMatrixNotNumeric      = "MATRIX_NOT_NUMERIC"
	CodeMatrixTooLarge        = "MATRIX_TOO_LARGE"
	CodeQRShapeUnsupported    = "QR_SHAPE_UNSUPPORTED"
	CodeDownstreamUnavailable = "DOWNSTREAM_UNAVAILABLE"
	CodeInternal              = "INTERNAL"
)

// MatrixRequired builds the 400 MATRIX_REQUIRED error.
func MatrixRequired() *Error {
	return &Error{
		Code:       CodeMatrixRequired,
		HTTPStatus: http.StatusBadRequest,
		Message:    "matrix is required",
	}
}

// MatrixEmpty builds the 400 MATRIX_EMPTY error.
func MatrixEmpty() *Error {
	return &Error{
		Code:       CodeMatrixEmpty,
		HTTPStatus: http.StatusBadRequest,
		Message:    "matrix must have at least one row and one column",
	}
}

// MatrixRagged builds the 400 MATRIX_RAGGED error with row-length details.
func MatrixRagged(row, expected, got int) *Error {
	return &Error{
		Code:       CodeMatrixRagged,
		HTTPStatus: http.StatusBadRequest,
		Message:    "all rows must have the same length",
		Details: map[string]any{
			"row":      row,
			"expected": expected,
			"got":      got,
		},
	}
}

// MatrixNotNumeric builds the 400 MATRIX_NOT_NUMERIC error.
func MatrixNotNumeric() *Error {
	return &Error{
		Code:       CodeMatrixNotNumeric,
		HTTPStatus: http.StatusBadRequest,
		Message:    "matrix elements must be finite numbers",
	}
}

// MatrixTooLarge builds the 400 MATRIX_TOO_LARGE error.
func MatrixTooLarge() *Error {
	return &Error{
		Code:       CodeMatrixTooLarge,
		HTTPStatus: http.StatusBadRequest,
		Message:    "matrix exceeds the maximum allowed size (100x100, 10000 elements)",
	}
}

// QRShapeUnsupported builds the 422 QR_SHAPE_UNSUPPORTED error.
func QRShapeUnsupported() *Error {
	return &Error{
		Code:       CodeQRShapeUnsupported,
		HTTPStatus: http.StatusUnprocessableEntity,
		Message:    "rotated matrix must have rows >= cols for QR factorization",
	}
}

// DownstreamUnavailable builds the 502 DOWNSTREAM_UNAVAILABLE error.
func DownstreamUnavailable(cause string) *Error {
	details := map[string]any{}
	if cause != "" {
		details["cause"] = cause
	}
	return &Error{
		Code:       CodeDownstreamUnavailable,
		HTTPStatus: http.StatusBadGateway,
		Message:    "downstream API is unavailable",
		Details:    details,
	}
}

// Internal builds the 500 INTERNAL error, used by the recover middleware
// and the qr.Factorize panic guard.
func Internal(cause string) *Error {
	details := map[string]any{}
	if cause != "" {
		details["cause"] = cause
	}
	return &Error{
		Code:       CodeInternal,
		HTTPStatus: http.StatusInternalServerError,
		Message:    "internal server error",
		Details:    details,
	}
}
