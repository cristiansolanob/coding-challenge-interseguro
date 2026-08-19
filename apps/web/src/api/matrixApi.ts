/**
 * Typed client for apps/go-api's aggregated matrix endpoint.
 *
 * The frontend only ever calls go-api. go-api rotates the input matrix 90°
 * clockwise, factorizes the rotated matrix into Q/R, forwards Q/R (plus the
 * rotated matrix) to apps/node-api for statistics, and returns everything —
 * input, rotated, q, r, and the downstream statistics — in one response.
 */

export type Matrix = number[][];

export interface MatrixDimensions {
  rows: number;
  cols: number;
}

export interface MatrixBlock extends MatrixDimensions {
  values: Matrix;
}

export interface DiagonalReport {
  matrix: boolean;
  q: boolean;
  r: boolean;
}

/** Verbatim body of node-api's POST /api/v1/statistics response. */
export interface StatisticsBody {
  count: number;
  max: number;
  min: number;
  sum: number;
  average: number;
  isDiagonal: boolean;
  diagonal: DiagonalReport;
}

export interface DownstreamResult {
  status: string;
  body: StatisticsBody;
}

export interface MatrixQrResponse {
  input: MatrixDimensions;
  rotated: MatrixBlock;
  q: MatrixBlock;
  r: MatrixBlock;
  downstream: DownstreamResult;
}

export interface ApiErrorDetails {
  [key: string]: unknown;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetails;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

/** Thrown for both structured API errors and network/transport failures. */
export class MatrixApiError extends Error {
  readonly code: string;
  readonly details?: ApiErrorDetails;
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    code: string,
    details?: ApiErrorDetails,
    isNetworkError = false,
  ) {
    super(message);
    this.name = 'MatrixApiError';
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }
}

const DEFAULT_BASE_URL = 'http://localhost:3000';

export function getGoApiBaseUrl(): string {
  const configured = import.meta.env.VITE_GO_API_URL;
  return configured && configured.trim().length > 0
    ? configured.replace(/\/+$/, '')
    : DEFAULT_BASE_URL;
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const err = (value as { error?: unknown }).error;
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

/**
 * Submits a matrix to go-api's POST /api/v1/matrix/qr and returns the
 * aggregated rotation + QR + downstream-statistics response.
 *
 * Throws MatrixApiError for both structured API errors (non-2xx with the
 * { error: { code, message, details } } envelope) and network failures
 * (backend unreachable, timeout, malformed response).
 */
export async function submitMatrix(matrix: Matrix): Promise<MatrixQrResponse> {
  const baseUrl = getGoApiBaseUrl();
  const url = `${baseUrl}/api/v1/matrix/qr`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix }),
    });
  } catch {
    throw new MatrixApiError(
      `Cannot reach the API at ${baseUrl}. Make sure go-api is running and reachable.`,
      'NETWORK_ERROR',
      undefined,
      true,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MatrixApiError(
      `Received a non-JSON response from ${baseUrl}.`,
      'INVALID_RESPONSE',
      undefined,
      true,
    );
  }

  if (!response.ok) {
    if (isApiErrorEnvelope(payload)) {
      throw new MatrixApiError(
        payload.error.message,
        payload.error.code,
        payload.error.details,
      );
    }
    throw new MatrixApiError(
      `Request failed with status ${response.status}.`,
      'UNKNOWN_ERROR',
    );
  }

  return payload as MatrixQrResponse;
}
