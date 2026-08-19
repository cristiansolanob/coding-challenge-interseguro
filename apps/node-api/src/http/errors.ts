import type { NextFunction, Request, Response } from 'express';

export type ErrorCode =
  | 'PAYLOAD_INVALID'
  | 'MATRIX_REQUIRED'
  | 'MATRIX_EMPTY'
  | 'MATRIX_RAGGED'
  | 'MATRIX_NOT_NUMERIC'
  | 'MATRIX_TOO_LARGE'
  | 'NOT_FOUND'
  | 'INTERNAL';

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  PAYLOAD_INVALID: 400,
  MATRIX_REQUIRED: 400,
  MATRIX_EMPTY: 400,
  MATRIX_RAGGED: 400,
  MATRIX_NOT_NUMERIC: 400,
  MATRIX_TOO_LARGE: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
    if (details !== undefined) this.details = details;
  }
}

export const errors = {
  payloadInvalid(): ApiError {
    return new ApiError('PAYLOAD_INVALID', 'Request body is not valid JSON.');
  },
  matrixRequired(field: string): ApiError {
    return new ApiError('MATRIX_REQUIRED', `Field "${field}" is required and must be an array of arrays of numbers.`, {
      field,
    });
  },
  matrixEmpty(field: string): ApiError {
    return new ApiError('MATRIX_EMPTY', `Field "${field}" must not be empty.`, { field });
  },
  matrixRagged(field: string, row: number, expected: number, got: number): ApiError {
    return new ApiError('MATRIX_RAGGED', `Field "${field}" has ragged rows: row ${row} expected ${expected} columns, got ${got}.`, {
      field,
      row,
      expected,
      got,
    });
  },
  matrixNotNumeric(field: string): ApiError {
    return new ApiError('MATRIX_NOT_NUMERIC', `Field "${field}" contains a non-numeric element.`, { field });
  },
  matrixTooLarge(field: string): ApiError {
    return new ApiError('MATRIX_TOO_LARGE', `Field "${field}" exceeds the maximum allowed size.`, { field });
  },
  notFound(): ApiError {
    return new ApiError('NOT_FOUND', 'The requested route was not found.');
  },
  internal(): ApiError {
    return new ApiError('INTERNAL', 'An unexpected error occurred.');
  },
};

function toEnvelope(err: ApiError): { error: { code: ErrorCode; message: string; details?: Record<string, unknown> } } {
  const body: { code: ErrorCode; message: string; details?: Record<string, unknown> } = {
    code: err.code,
    message: err.message,
  };
  if (err.details !== undefined) body.details = err.details;
  return { error: body };
}

/**
 * Terminal Express error-handling middleware. Maps a thrown ApiError to its
 * documented envelope/status; any other error is mapped to INTERNAL 500
 * without leaking internal details.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const apiError = err instanceof ApiError ? err : errors.internal();
  res.status(apiError.httpStatus).json(toEnvelope(apiError));
}

/** Handles unmatched routes with the NOT_FOUND envelope. */
export function notFoundHandler(_req: Request, res: Response): void {
  const err = errors.notFound();
  res.status(err.httpStatus).json(toEnvelope(err));
}
