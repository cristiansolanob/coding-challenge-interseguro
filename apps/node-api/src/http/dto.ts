import type { Matrix } from '../stats/types';
import { errors } from './errors';

export interface StatisticsRequest {
  matrix: Matrix;
  q: Matrix;
  r: Matrix;
}

const MAX_ROWS = 100;
const MAX_COLS = 100;
const MAX_ELEMENTS = 10000;

type FieldName = 'matrix' | 'q' | 'r';

function isNumericValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseMatrixField(body: Record<string, unknown>, field: FieldName): Matrix {
  const value = body[field];

  if (value === undefined || value === null || !Array.isArray(value)) {
    throw errors.matrixRequired(field);
  }

  if (!value.every((row) => Array.isArray(row))) {
    throw errors.matrixRequired(field);
  }

  const matrix = value as unknown[][];

  if (matrix.length === 0) {
    throw errors.matrixEmpty(field);
  }

  if (matrix.length > MAX_ROWS) {
    throw errors.matrixTooLarge(field);
  }

  const expectedCols = matrix[0]!.length;

  if (expectedCols === 0) {
    throw errors.matrixEmpty(field);
  }

  if (expectedCols > MAX_COLS) {
    throw errors.matrixTooLarge(field);
  }

  let totalElements = 0;

  for (let row = 0; row < matrix.length; row++) {
    const currentRow = matrix[row]!;

    if (currentRow.length !== expectedCols) {
      throw errors.matrixRagged(field, row, expectedCols, currentRow.length);
    }

    for (const cell of currentRow) {
      if (!isNumericValue(cell)) {
        throw errors.matrixNotNumeric(field);
      }
      totalElements++;
    }
  }

  if (totalElements > MAX_ELEMENTS) {
    throw errors.matrixTooLarge(field);
  }

  return matrix as Matrix;
}

/**
 * Validates and parses the full { matrix, q, r } request body. Validation
 * completes for all three fields before any statistics work begins, so a
 * partial/incoherent result is never emitted.
 */
export function parseStatisticsRequest(body: unknown): StatisticsRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw errors.payloadInvalid();
  }

  const record = body as Record<string, unknown>;

  const matrix = parseMatrixField(record, 'matrix');
  const q = parseMatrixField(record, 'q');
  const r = parseMatrixField(record, 'r');

  return { matrix, q, r };
}
