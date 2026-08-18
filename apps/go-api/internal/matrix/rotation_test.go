package matrix

import (
	"reflect"
	"testing"
)

// Scenarios from spec: matrix-rotation
func TestRotateCW90(t *testing.T) {
	tests := []struct {
		name  string
		input [][]float64
		want  [][]float64
	}{
		{
			name:  "non-square 3x2 rotates to 2x3",
			input: [][]float64{{1, 2}, {3, 4}, {5, 6}},
			want:  [][]float64{{5, 3, 1}, {6, 4, 2}},
		},
		{
			name:  "square 2x2 rotates correctly",
			input: [][]float64{{1, 2}, {3, 4}},
			want:  [][]float64{{3, 1}, {4, 2}},
		},
		{
			name:  "1x3 row vector rotates to 3x1 column",
			input: [][]float64{{1, 2, 3}},
			want:  [][]float64{{1}, {2}, {3}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := RotateCW90(tt.input)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("RotateCW90(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// Scenario: Rotation does not mutate the input
func TestRotateCW90_DoesNotMutateInput(t *testing.T) {
	input := [][]float64{{1, 2}, {3, 4}}
	original := [][]float64{{1, 2}, {3, 4}}

	_ = RotateCW90(input)

	if !reflect.DeepEqual(input, original) {
		t.Errorf("input was mutated: got %v, want %v", input, original)
	}
}
