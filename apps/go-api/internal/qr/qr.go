// Package qr wraps gonum's QR factorization (gonum.org/v1/gonum/mat) to
// decompose a matrix A into an orthonormal Q and an upper-triangular R
// such that A = Q * R.
//
// gonum's implementation uses Householder reflections (LAPACK's
// GEQRF/ORGQR under the hood), which is the standard, numerically
// stable algorithm for QR: it avoids the loss of orthogonality that
// naive Gram-Schmidt exhibits on ill-conditioned input, and it is a
// battle-tested implementation rather than a hand-rolled one. Because
// gonum panics when rows < cols instead of returning an error, this
// package enforces the shape precondition before calling gonum and
// wraps the factorization in a recover() as a defense-in-depth net so a
// panic here never crosses the package boundary.
package qr

import (
	"errors"
	"fmt"

	"gonum.org/v1/gonum/mat"
)

// ErrShapeUnsupported is returned when the input matrix has fewer rows
// than columns; gonum's mat.QR requires rows >= cols and panics
// otherwise, so this is checked explicitly before Factorize is invoked.
var ErrShapeUnsupported = errors.New("qr: rows must be >= cols")

// ErrFactorizationFailed wraps any unexpected panic recovered while
// gonum performs the factorization.
var ErrFactorizationFailed = errors.New("qr: factorization failed")

// Factorize computes the QR factorization of an m×n matrix a with
// m >= n, returning Q (m×m, orthonormal) and R (m×n, upper-triangular)
// such that Q*R reconstructs a. It returns ErrShapeUnsupported (without
// calling gonum) when rows < cols, and never panics: any unexpected
// panic from gonum is recovered and returned as ErrFactorizationFailed.
func Factorize(a [][]float64) (q [][]float64, r [][]float64, err error) {
	rows := len(a)
	if rows == 0 {
		return nil, nil, fmt.Errorf("%w: empty matrix", ErrShapeUnsupported)
	}
	cols := len(a[0])

	if rows < cols {
		return nil, nil, fmt.Errorf("%w: %dx%d", ErrShapeUnsupported, rows, cols)
	}

	defer func() {
		if rec := recover(); rec != nil {
			q, r, err = nil, nil, fmt.Errorf("%w: %v", ErrFactorizationFailed, rec)
		}
	}()

	flat := make([]float64, 0, rows*cols)
	for _, row := range a {
		flat = append(flat, row...)
	}
	dense := mat.NewDense(rows, cols, flat)

	var qrFact mat.QR
	qrFact.Factorize(dense)

	var qDense, rDense mat.Dense
	qrFact.QTo(&qDense)
	qrFact.RTo(&rDense)

	qOut := denseToSlice(&qDense)
	rOut := denseToSlice(&rDense)

	return qOut, rOut, nil
}

func denseToSlice(d *mat.Dense) [][]float64 {
	rows, cols := d.Dims()
	out := make([][]float64, rows)
	for i := 0; i < rows; i++ {
		out[i] = make([]float64, cols)
		for j := 0; j < cols; j++ {
			out[i][j] = d.At(i, j)
		}
	}
	return out
}
