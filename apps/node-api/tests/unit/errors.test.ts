import { ApiError, errors, errorHandler, notFoundHandler } from '../../src/http/errors';

describe('ApiError factories', () => {
  it.each([
    ['payloadInvalid', errors.payloadInvalid(), 'PAYLOAD_INVALID', 400],
    ['matrixRequired', errors.matrixRequired('matrix'), 'MATRIX_REQUIRED', 400],
    ['matrixEmpty', errors.matrixEmpty('q'), 'MATRIX_EMPTY', 400],
    ['matrixRagged', errors.matrixRagged('r', 1, 2, 1), 'MATRIX_RAGGED', 400],
    ['matrixNotNumeric', errors.matrixNotNumeric('matrix'), 'MATRIX_NOT_NUMERIC', 400],
    ['matrixTooLarge', errors.matrixTooLarge('q'), 'MATRIX_TOO_LARGE', 400],
    ['notFound', errors.notFound(), 'NOT_FOUND', 404],
    ['internal', errors.internal(), 'INTERNAL', 500],
  ])('%s produces correct code and httpStatus', (_name, err, code, status) => {
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('matrixRagged carries field/row/expected/got in details', () => {
    const err = errors.matrixRagged('matrix', 1, 2, 1);
    expect(err.details).toEqual({ field: 'matrix', row: 1, expected: 2, got: 1 });
  });

  it('matrixRequired carries field in details', () => {
    const err = errors.matrixRequired('r');
    expect(err.details).toEqual({ field: 'r' });
  });
});

describe('errorHandler', () => {
  function mockRes() {
    const res: { statusCode?: number; body?: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
      status(n) {
        res.statusCode = n;
        return res;
      },
      json(b) {
        res.body = b;
        return res;
      },
    };
    return res;
  }

  it('maps a thrown ApiError to the correct envelope and status', () => {
    const res = mockRes();
    const err = errors.matrixRequired('matrix');
    errorHandler(err, {} as never, res as never, (() => {}) as never);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'MATRIX_REQUIRED', message: err.message, details: { field: 'matrix' } },
    });
  });

  it('maps an unknown Error to INTERNAL 500 without leaking internals', () => {
    const res = mockRes();
    const err = new Error('some raw stack trace leak');
    errorHandler(err, {} as never, res as never, (() => {}) as never);
    expect(res.statusCode).toBe(500);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).not.toContain('some raw stack trace leak');
  });
});

describe('notFoundHandler', () => {
  it('produces a NOT_FOUND 404 envelope', () => {
    const res: { statusCode?: number; body?: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
      status(n) {
        res.statusCode = n;
        return res;
      },
      json(b) {
        res.body = b;
        return res;
      },
    };
    notFoundHandler({} as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});
