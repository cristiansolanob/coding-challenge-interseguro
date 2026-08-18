package http

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/interseguro/matrix-qr-api/internal/apierr"
	"github.com/interseguro/matrix-qr-api/internal/matrix"
	"github.com/interseguro/matrix-qr-api/internal/qr"
)

const (
	maxDimension = 100
	maxElements  = 10000
)

// Handler owns the HTTP pipeline for the matrix/QR endpoint.
type Handler struct {
	downstream DownstreamClient
}

// NewHandler builds a Handler wired to the given DownstreamClient.
func NewHandler(downstream DownstreamClient) *Handler {
	return &Handler{downstream: downstream}
}

// MatrixQR implements POST /api/v1/matrix/qr. It executes the pipeline
// in the exact documented order: decode -> validate raw input -> rotate
// 90 CW -> validate rotated shape -> factorize -> call downstream ->
// respond. Every failure returns a typed *apierr.Error, mapped to its
// HTTP status by Handle.
func (h *Handler) MatrixQR(c *fiber.Ctx) error {
	// 1. Decode + validate raw input.
	rawMatrix, decodeErr := decodeMatrixField(c.Body())
	if decodeErr != nil {
		return decodeErr
	}

	if validateErr := validateRawMatrix(rawMatrix); validateErr != nil {
		return validateErr
	}

	// 2. Rotate 90 CW (pure).
	rotated := matrix.RotateCW90(rawMatrix)

	// 3. Validate rotated shape for QR eligibility (rows >= cols).
	if len(rotated) < len(rotated[0]) {
		return apierr.QRShapeUnsupported()
	}

	// 4. Factorize.
	q, r, qrErr := qr.Factorize(rotated)
	if qrErr != nil {
		return apierr.Internal(qrErr.Error())
	}

	// 5. Call downstream.
	body, sendErr := h.downstream.Send(c.UserContext(), DownstreamPayload{
		Matrix: rotated,
		Q:      q,
		R:      r,
	})
	if sendErr != nil {
		return apierr.DownstreamUnavailable(sendErr.Error())
	}

	// 6. Respond.
	resp := MatrixResponse{
		Input: MatrixDims{
			Rows: len(rawMatrix),
			Cols: len(rawMatrix[0]),
		},
		Rotated: MatrixValues{
			Rows:   len(rotated),
			Cols:   len(rotated[0]),
			Values: rotated,
		},
		Q: MatrixValues{
			Rows:   len(q),
			Cols:   len(q[0]),
			Values: q,
		},
		R: MatrixValues{
			Rows:   len(r),
			Cols:   len(r[0]),
			Values: r,
		},
		Downstream: DownstreamResult{
			Status: "ok",
			Body:   body,
		},
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// decodeMatrixField decodes the request body and isolates the "matrix"
// field so MATRIX_REQUIRED (field missing/null) can be distinguished
// from MATRIX_NOT_NUMERIC (field present but not decodable as
// [][]float64).
func decodeMatrixField(rawBody []byte) ([][]float64, *apierr.Error) {
	var envelope struct {
		Matrix json.RawMessage `json:"matrix"`
	}

	if err := json.Unmarshal(rawBody, &envelope); err != nil {
		return nil, apierr.MatrixRequired()
	}

	if len(envelope.Matrix) == 0 || string(envelope.Matrix) == "null" {
		return nil, apierr.MatrixRequired()
	}

	var m [][]float64
	if err := json.Unmarshal(envelope.Matrix, &m); err != nil {
		return nil, apierr.MatrixNotNumeric()
	}

	return m, nil
}

// validateRawMatrix applies validation rules 2, 3, and 5 (empty,
// ragged, size guard) to a successfully decoded matrix. Rule 4
// (non-numeric) is enforced earlier, at decode time, because JSON has
// no NaN/Inf literal and a type mismatch already fails Unmarshal.
func validateRawMatrix(m [][]float64) *apierr.Error {
	if len(m) == 0 {
		return apierr.MatrixEmpty()
	}

	cols := len(m[0])
	if cols == 0 {
		return apierr.MatrixEmpty()
	}

	for i, row := range m {
		if len(row) == 0 {
			return apierr.MatrixEmpty()
		}
		if i == 0 {
			continue
		}
		if len(row) != cols {
			return apierr.MatrixRagged(i+1, cols, len(row))
		}
	}

	rows := len(m)
	if rows > maxDimension || cols > maxDimension || rows*cols > maxElements {
		return apierr.MatrixTooLarge()
	}

	return nil
}
