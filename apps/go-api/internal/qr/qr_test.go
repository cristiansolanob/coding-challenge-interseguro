package qr

import (
	"errors"
	"math"
	"testing"

	"gonum.org/v1/gonum/mat"
)

const epsilon = 1e-9

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) <= epsilon
}

func toDense(rows int, cols int, values [][]float64) *mat.Dense {
	flat := make([]float64, 0, rows*cols)
	for _, row := range values {
		flat = append(flat, row...)
	}
	return mat.NewDense(rows, cols, flat)
}

// Scenario: Tall matrix factorizes successfully (spec: qr-factorization)
func TestFactorize_TallMatrix(t *testing.T) {
	input := [][]float64{{1, 2}, {3, 4}, {5, 6}}

	q, r, err := Factorize(input)
	if err != nil {
		t.Fatalf("Factorize() unexpected error: %v", err)
	}

	if len(q) != 3 || len(q[0]) != 3 {
		t.Fatalf("Q dims = %dx%d, want 3x3", len(q), len(q[0]))
	}
	if len(r) != 3 || len(r[0]) != 2 {
		t.Fatalf("R dims = %dx%d, want 3x2", len(r), len(r[0]))
	}

	// Q·R must reconstruct the input within epsilon.
	qd := toDense(3, 3, q)
	rd := toDense(3, 2, r)
	var product mat.Dense
	product.Mul(qd, rd)

	for i := 0; i < 3; i++ {
		for j := 0; j < 2; j++ {
			if !almostEqual(product.At(i, j), input[i][j]) {
				t.Errorf("Q*R[%d][%d] = %v, want %v", i, j, product.At(i, j), input[i][j])
			}
		}
	}
}

// Scenario: Square matrix factorizes successfully (spec: qr-factorization)
func TestFactorize_SquareMatrix(t *testing.T) {
	input := [][]float64{{1, 2}, {3, 4}}

	q, r, err := Factorize(input)
	if err != nil {
		t.Fatalf("Factorize() unexpected error: %v", err)
	}

	if len(q) != 2 || len(q[0]) != 2 {
		t.Fatalf("Q dims = %dx%d, want 2x2", len(q), len(q[0]))
	}
	if len(r) != 2 || len(r[0]) != 2 {
		t.Fatalf("R dims = %dx%d, want 2x2", len(r), len(r[0]))
	}

	// Q orthonormal: Qᵀ*Q ≈ I
	qd := toDense(2, 2, q)
	var qtq mat.Dense
	qtq.Mul(qd.T(), qd)
	for i := 0; i < 2; i++ {
		for j := 0; j < 2; j++ {
			want := 0.0
			if i == j {
				want = 1.0
			}
			if !almostEqual(qtq.At(i, j), want) {
				t.Errorf("QtQ[%d][%d] = %v, want %v", i, j, qtq.At(i, j), want)
			}
		}
	}

	// R upper-triangular: entries below the diagonal are 0 within epsilon.
	for i := 1; i < 2; i++ {
		for j := 0; j < i; j++ {
			if !almostEqual(r[i][j], 0) {
				t.Errorf("R[%d][%d] = %v, want ~0 (below diagonal)", i, j, r[i][j])
			}
		}
	}
}

// Scenario: Wide matrix is rejected before calling gonum (spec: qr-factorization)
func TestFactorize_WideMatrixRejectedWithoutPanic(t *testing.T) {
	input := [][]float64{{1, 2, 3}, {4, 5, 6}}

	func() {
		defer func() {
			if rec := recover(); rec != nil {
				t.Fatalf("Factorize() panicked instead of returning an error: %v", rec)
			}
		}()

		_, _, err := Factorize(input)
		if err == nil {
			t.Fatal("Factorize() expected error for rows < cols, got nil")
		}
		if !errors.Is(err, ErrShapeUnsupported) {
			t.Errorf("Factorize() error = %v, want wrapping ErrShapeUnsupported", err)
		}
	}()
}
