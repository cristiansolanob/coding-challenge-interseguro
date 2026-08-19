export type Matrix = number[][];

export interface PoolStatistics {
  count: number;
  sum: number;
  max: number;
  min: number;
  average: number;
}

export interface DiagonalReport {
  matrix: boolean;
  q: boolean;
  r: boolean;
}
