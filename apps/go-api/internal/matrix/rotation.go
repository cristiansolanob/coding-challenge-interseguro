// Package matrix implements pure matrix transformations with no
// framework dependencies, so they are trivially table-testable in
// isolation from the HTTP layer.
package matrix

// RotateCW90 rotates an m×n matrix 90 degrees clockwise into a fresh
// n×m matrix. It allocates a new backing structure in a single pass and
// never mutates the input, satisfying rotated[j][m-1-i] = input[i][j].
func RotateCW90(input [][]float64) [][]float64 {
	rows := len(input)
	if rows == 0 {
		return [][]float64{}
	}
	cols := len(input[0])

	out := make([][]float64, cols)
	for j := 0; j < cols; j++ {
		out[j] = make([]float64, rows)
	}

	for i := 0; i < rows; i++ {
		for j := 0; j < cols; j++ {
			out[j][rows-1-i] = input[i][j]
		}
	}

	return out
}
