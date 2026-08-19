import { isDiagonal, EPSILON, diagonalReport } from '../../src/stats/diagonal';
import type { Matrix } from '../../src/stats/types';

describe('isDiagonal', () => {
  it.each<{ name: string; matrix: Matrix; expected: boolean }>([
    {
      name: 'Square matrix with true-zero off-diagonal',
      matrix: [
        [5, 0],
        [0, 3],
      ],
      expected: true,
    },
    {
      name: 'Square matrix with float noise within epsilon',
      matrix: [
        [5, 1e-10],
        [1e-10, 3],
      ],
      expected: true,
    },
    {
      name: 'Non-square matrix',
      matrix: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      expected: false,
    },
    {
      name: 'Square with off-diagonal exceeding epsilon',
      matrix: [
        [5, 0.01],
        [0, 3],
      ],
      expected: false,
    },
    {
      name: 'Boundary: off-diagonal exactly 2e-9 is false',
      matrix: [
        [5, 2e-9],
        [0, 3],
      ],
      expected: false,
    },
    {
      name: 'Boundary: off-diagonal 5e-10 is true',
      matrix: [
        [5, 5e-10],
        [0, 3],
      ],
      expected: true,
    },
    {
      name: '1x1 matrix is diagonal',
      matrix: [[7]],
      expected: true,
    },
    {
      name: 'Zero matrix is diagonal',
      matrix: [
        [0, 0],
        [0, 0],
      ],
      expected: true,
    },
  ])('$name', ({ matrix, expected }) => {
    expect(isDiagonal(matrix)).toBe(expected);
  });

  it('exposes EPSILON as 1e-9', () => {
    expect(EPSILON).toBe(1e-9);
  });
});

describe('diagonalReport', () => {
  it('At least one diagonal produces global isDiagonal=true via OR', () => {
    const matrix: Matrix = [
      [1, 0.01],
      [0, 3],
    ]; // false
    const q: Matrix = [
      [5, 0],
      [0, 3],
    ]; // true
    const r: Matrix = [
      [1, 2, 3],
      [4, 5, 6],
    ]; // non-square false
    const report = diagonalReport(matrix, q, r);
    expect(report).toEqual({ matrix: false, q: true, r: false });
  });

  it('None diagonal yields all false', () => {
    const matrix: Matrix = [
      [1, 0.01],
      [0, 3],
    ];
    const q: Matrix = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const r: Matrix = [
      [1, 0.5],
      [0, 3],
    ];
    const report = diagonalReport(matrix, q, r);
    expect(report).toEqual({ matrix: false, q: false, r: false });
  });
});
