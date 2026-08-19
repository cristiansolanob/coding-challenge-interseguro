import type { Matrix, PoolStatistics } from './types';

/**
 * Computes pooled descriptive statistics over every numeric element of the
 * given matrices, concatenated into a single combined pool (not per-matrix).
 *
 * Single-pass accumulator: O(N) time, no intermediate allocation.
 */
export function poolStatistics(matrices: Matrix[]): PoolStatistics {
  let count = 0;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;

  for (const m of matrices) {
    for (const row of m) {
      for (const v of row) {
        count++;
        sum += v;
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }
  }

  if (count === 0) {
    // Unreachable post-validation: parseStatisticsRequest guarantees a non-empty pool.
    throw new Error('poolStatistics: empty pool');
  }

  return { count, sum, max, min, average: sum / count };
}
