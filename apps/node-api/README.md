# node-api

Express/TypeScript HTTP service that computes pooled descriptive statistics
(`max`/`min`/`sum`/`average`/`count`) and per-matrix diagonal detection over
three input matrices — `matrix`, `q`, `r`.

This is the downstream service `apps/go-api` forwards its rotation/QR
result to; this service's own contract is defined and tested independently
of that caller.

## Contract

### `POST /api/v1/statistics`

Request:

```json
{
  "matrix": [[1, 2]],
  "q": [[3, 4], [5, 6]],
  "r": [[7]]
}
```

Success response (`200`):

```json
{
  "count": 7,
  "max": 7,
  "min": 1,
  "sum": 28,
  "average": 4,
  "isDiagonal": false,
  "diagonal": { "matrix": false, "q": false, "r": false }
}
```

- **Pooled statistics, not per-matrix**: `max`/`min`/`sum`/`average`/`count`
  are computed over one combined pool of every element of `matrix`, `q`,
  and `r` together — not three separate results. `count` is returned
  explicitly so the pooling is self-documenting to a caller.
- **Diagonal semantics**: `diagonal.{matrix,q,r}` reports whether each
  input, individually, is a diagonal matrix (square, with every
  off-diagonal element within `EPSILON` of zero). `isDiagonal` at the top
  level is the logical OR of those three — `true` if *at least one* of the
  three inputs is diagonal. A non-square matrix is never an error; it
  simply reports `false` for that field.
- All numeric values are JSON numbers (`number`) at full precision — no
  rounding in transport.

### Error envelope (all non-2xx)

```json
{ "error": { "code": "MATRIX_RAGGED", "message": "Field \"matrix\" has ragged rows: row 1 expected 2 columns, got 1.", "details": { "field": "matrix", "row": 1, "expected": 2, "got": 1 } } }
```

| Code | HTTP | Trigger |
|---|---|---|
| `PAYLOAD_INVALID` | 400 | request body is not valid JSON, or exceeds the 1 MB limit |
| `MATRIX_REQUIRED` | 400 | `matrix`/`q`/`r` missing, `null`, or not an array of arrays |
| `MATRIX_EMPTY` | 400 | zero rows, or a row with zero columns |
| `MATRIX_RAGGED` | 400 | rows of differing length within the same field |
| `MATRIX_NOT_NUMERIC` | 400 | non-numeric, `NaN`, or `±Infinity` element |
| `MATRIX_TOO_LARGE` | 400 | field has > 100 rows, > 100 columns, or > 10,000 elements |
| `NOT_FOUND` | 404 | unmatched route |
| `INTERNAL` | 500 | unexpected failure |

`details.field` carries which of `"matrix" | "q" | "r"` failed on every
per-matrix error code, so the offending input is always identifiable.

Pipeline order (explicit and testable): `express.json` parse → validate
*all three* matrices fully → compute pooled statistics → compute diagonal
report → respond `200`. Validation never partially succeeds — a malformed
`r` is reported even if `matrix` and `q` are both valid, and no arithmetic
runs until validation for all three fields has completed.

### `GET /health`

Returns `200 {"status": "ok"}`.

## Key decisions

- **Pooled statistics over `matrix + q + r` combined** (not per-matrix):
  confirmed scope — the response's `max`/`min`/`sum`/`average`/`count`
  describe one pool built from every element of all three inputs in a
  single accumulator pass, not three independent results.
- **`EPSILON = 1e-9`** for diagonal detection: an off-diagonal element is
  only treated as "effectively zero" when its absolute value is strictly
  below this tolerance. Strict `=== 0` would misclassify genuinely
  diagonal matrices, since a Householder QR factorization (as produced by
  `apps/go-api`) leaves float noise in `Q`/`R`'s off-diagonal cells. This
  matches the Go API's own diagonal test epsilon.
- **Diagonal semantics — per-matrix check, global OR**: `diagonal.matrix`,
  `diagonal.q`, `diagonal.r` are computed independently (each requires
  square shape); the top-level `isDiagonal` is `true` if *any one* of them
  is `true`. A non-square input reports `false` for that field without
  raising an error.

## Project structure

```
src/config/env.ts          # PORT parsing: default 3001, fail-fast on invalid value
src/stats/types.ts         # Matrix, PoolStatistics, DiagonalReport
src/stats/stats.ts         # poolStatistics() — single-pass pooled accumulator
src/stats/diagonal.ts      # EPSILON, isDiagonal(), diagonalReport()
src/http/dto.ts            # parseStatisticsRequest() — full request validation
src/http/errors.ts         # ApiError, error taxonomy, errorHandler, notFoundHandler
src/http/routes.ts         # POST /api/v1/statistics, GET /health
src/app.ts                 # createApp(cfg) factory — the test seam, no listen()
src/server.ts              # loadConfig() → createApp() → listen(), graceful shutdown
tests/unit/                # stats, diagonal, dto, env
tests/integration/         # Supertest against createApp()
Dockerfile, .dockerignore
```

`src/stats/` is pure and framework-free (no Express types), so it is unit
tested in isolation. `src/app.ts` exports `createApp(cfg): Express` as the
single test seam — Supertest drives it in-process with no port and no
network; only `src/server.ts` calls `.listen()`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port the service listens on. A non-numeric value throws at boot (fail fast) |

## Running locally

This service lives at `apps/node-api` in the monorepo. Run all commands
below from inside this directory.

```bash
npm install
npm run dev
```

```bash
curl http://localhost:3001/health
# {"status":"ok"}

curl -X POST http://localhost:3001/api/v1/statistics \
  -H "Content-Type: application/json" \
  -d '{"matrix": [[1,2]], "q": [[3,4],[5,6]], "r": [[7]]}'
```

## Testing

```bash
npm test
```

The suite follows strict TDD (RED before GREEN) and covers:
- Pure unit tests for `src/stats/stats.ts` and `src/stats/diagonal.ts`
  (table-driven `it.each`, epsilon boundary cases).
- `src/http/dto.ts` — one case per error code, per field (`matrix`/`q`/`r`).
- `src/config/env.ts` — default/override/invalid `PORT`.
- `src/app.ts` full-pipeline integration tests via Supertest — happy path,
  every documented error code, malformed JSON, unknown route, health check.

```bash
npm run build   # tsc — type-checks and emits dist/
npm run lint    # eslint flat config (typescript-eslint + prettier)
```

## Container

Multi-stage build: `deps` (npm ci, full devDependencies) → `build` (tsc →
`dist/`) → `prod-deps` (npm ci --omit=dev) → `runtime` (`node:22-alpine`,
non-root `USER node`). Splitting `prod-deps` from `deps` keeps the `npm ci`
layer cached across rebuilds and leaves zero devDependencies (`typescript`,
`jest`, …) in the final image.

```bash
docker build -t node-api .
docker run --rm -p 3001:3001 node-api
curl http://localhost:3001/health
# {"status":"ok"}
```

## Scope notes

- No authentication (explicitly out of scope for this change).
- This service is consumed by `apps/go-api`'s downstream client, but its
  contract is defined and tested independently — nothing here depends on
  the Go API.
