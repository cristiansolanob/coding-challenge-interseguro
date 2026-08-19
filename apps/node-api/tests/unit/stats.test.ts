import { poolStatistics } from '../../src/stats/stats';
import type { Matrix } from '../../src/stats/types';

describe('poolStatistics', () => {
  it.each<{ name: string; matrices: Matrix[]; expected: { count: number; sum: number; max: number; min: number; average: number } }>([
    {
      name: 'Combined pool across three matrices',
      matrices: [
        [[1, 2]],
        [
          [3, 4],
          [5, 6],
        ],
        [[7]],
      ],
      expected: { count: 7, sum: 28, max: 7, min: 1, average: 4 },
    },
    {
      name: 'All-zeros pool',
      matrices: [
        [
          [0, 0],
          [0, 0],
        ],
      ],
      expected: { count: 4, sum: 0, max: 0, min: 0, average: 0 },
    },
    {
      name: 'Single 1x1 element',
      matrices: [[[42]]],
      expected: { count: 1, sum: 42, max: 42, min: 42, average: 42 },
    },
  ])('$name', ({ matrices, expected }) => {
    const result = poolStatistics(matrices);
    expect(result.count).toBe(expected.count);
    expect(result.sum).toBe(expected.sum);
    expect(result.max).toBe(expected.max);
    expect(result.min).toBe(expected.min);
    expect(result.average).toBe(expected.average);
  });

  it('Average equals sum divided by count exactly for a non-trivial pool', () => {
    const matrices: Matrix[] = [
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [[7, 8, 9]],
    ];
    const result = poolStatistics(matrices);
    expect(result.average).toBe(result.sum / result.count);
    expect(result.count).toBe(9);
  });

  it('Negative and fractional values included without truncation', () => {
    const matrices: Matrix[] = [[[-3.5, 2.25]], [[1]]];
    const result = poolStatistics(matrices);
    expect(result.min).toBe(-3.5);
    expect(result.sum).toBeCloseTo(-0.25, 10);
    expect(result.average).toBeCloseTo(-0.08333333333333, 10);
  });
});
