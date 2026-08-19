import type { Matrix, DiagonalReport } from './types';

/**
 * Tolerance for off-diagonal float noise (e.g. Householder QR residue).
 * Shared with the Go API's own diagonal test epsilon.
 */
export const EPSILON = 1e-9;

/**
 * A matrix is diagonal iff it is square and every off-diagonal element has
 * an absolute value strictly below EPSILON. Non-square matrices are never
 * an error — they simply report false.
 */
export function isDiagonal(m: Matrix): boolean {
  const rows = m.length;
  if (rows === 0 || m[0]!.length !== rows) return false;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      if (i !== j && Math.abs(m[i]![j]!) >= EPSILON) return false;
    }
  }
  return true;
}

/**
 * Per-matrix diagonal breakdown for matrix/q/r. The caller derives the
 * global isDiagonal flag as the logical OR of these three values.
 */
export function diagonalReport(matrix: Matrix, q: Matrix, r: Matrix): DiagonalReport {
  return {
    matrix: isDiagonal(matrix),
    q: isDiagonal(q),
    r: isDiagonal(r),
  };
}
