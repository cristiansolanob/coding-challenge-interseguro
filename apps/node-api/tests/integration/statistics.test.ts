import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp({ port: 3001 });

function validMatrix(): number[][] {
  return [
    [1, 2],
    [3, 4],
  ];
}

function validBody() {
  return { matrix: validMatrix(), q: validMatrix(), r: validMatrix() };
}

describe('POST /api/v1/statistics', () => {
  it('Valid payload returns full body with pooled stats and diagonal OR-logic', async () => {
    const res = await request(app)
      .post('/api/v1/statistics')
      .send({ matrix: [[1, 2]], q: [[3, 4], [5, 6]], r: [[7]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      count: 7,
      sum: 28,
      max: 7,
      min: 1,
      average: 4,
      // r=[[7]] is a 1x1 matrix, diagonal by definition, so isDiagonal is
      // true via the OR-logic even though matrix/q are non-square.
      isDiagonal: true,
      diagonal: { matrix: false, q: false, r: true },
    });
  });

  it('isDiagonal is true when at least one of matrix/q/r is diagonal', async () => {
    const res = await request(app)
      .post('/api/v1/statistics')
      .send({
        matrix: [
          [1, 0.5],
          [0, 3],
        ],
        q: [
          [5, 0],
          [0, 3],
        ],
        r: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.isDiagonal).toBe(true);
    expect(res.body.diagonal).toEqual({ matrix: false, q: true, r: false });
  });

  it('isDiagonal is false when none of matrix/q/r is diagonal', async () => {
    const res = await request(app)
      .post('/api/v1/statistics')
      .send(validBody())
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.isDiagonal).toBe(false);
    expect(res.body.diagonal).toEqual({ matrix: false, q: false, r: false });
  });

  it('top-level JSON array body returns 400 PAYLOAD_INVALID', async () => {
    const res = await request(app)
      .post('/api/v1/statistics')
      .set('Content-Type', 'application/json')
      .send('[1,2]');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYLOAD_INVALID');
  });

  it.each([
    ['matrix', 'MATRIX_REQUIRED', 400],
    ['q', 'MATRIX_REQUIRED', 400],
    ['r', 'MATRIX_REQUIRED', 400],
  ])('missing field "%s" returns %s with status %i', async (field, code, status) => {
    const body = validBody() as Record<string, unknown>;
    delete body[field];
    const res = await request(app).post('/api/v1/statistics').send(body).set('Content-Type', 'application/json');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('MATRIX_EMPTY when a matrix has zero rows', async () => {
    const body = { ...validBody(), matrix: [] };
    const res = await request(app).post('/api/v1/statistics').send(body).set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATRIX_EMPTY');
  });

  it('MATRIX_RAGGED when rows differ in length', async () => {
    const body = { ...validBody(), matrix: [[1, 2], [3]] };
    const res = await request(app).post('/api/v1/statistics').send(body).set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATRIX_RAGGED');
  });

  it('MATRIX_NOT_NUMERIC when a q element is not numeric', async () => {
    const body = { ...validBody(), q: [[1, 'x']] };
    const res = await request(app).post('/api/v1/statistics').send(body).set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATRIX_NOT_NUMERIC');
  });

  it('MATRIX_TOO_LARGE when matrix exceeds 100 rows', async () => {
    const bigMatrix = Array.from({ length: 101 }, () => [1]);
    const body = { ...validBody(), matrix: bigMatrix };
    const res = await request(app).post('/api/v1/statistics').send(body).set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATRIX_TOO_LARGE');
  });

  it('Malformed JSON body returns 400 PAYLOAD_INVALID', async () => {
    const res = await request(app)
      .post('/api/v1/statistics')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYLOAD_INVALID');
  });

  it('Unknown route returns 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/v1/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /health', () => {
  it('Health check succeeds with 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
