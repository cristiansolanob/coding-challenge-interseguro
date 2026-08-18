# matrix-qr-api

Go/Fiber HTTP service that accepts a rectangular matrix, rotates it 90° clockwise
(mandatory internal step), computes its QR factorization (the required output),
forwards the result to a downstream Node API, and returns Q/R to the caller.

This resolves the challenge statement's rotation-vs-QR ambiguity in favor of QR as
the endpoint payload: **rotation is an internal pipeline step, QR is the endpoint's
actual deliverable.**

## Contract

### `POST /api/v1/matrix/qr`

Request:

```json
{ "matrix": [[1, 2, 3], [4, 5, 6]] }
```

Success response (`200`):

```json
{
  "input":   { "rows": 2, "cols": 3 },
  "rotated": { "rows": 3, "cols": 2, "values": [[4,1],[5,2],[6,3]] },
  "q":       { "rows": 3, "cols": 3, "values": [[...],[...],[...]] },
  "r":       { "rows": 3, "cols": 2, "values": [[...],[...],[...]] },
  "downstream": { "status": "ok", "body": { } }
}
```

- All numeric values are JSON numbers (`float64`) at full precision — no rounding
  in transport. Compare with epsilon `1e-9` when testing.
- **Rotation direction is 90° clockwise**: `rotated[j][m-1-i] = input[i][j]` for an
  `m×n` input.
- `q` is the rotated matrix's orthonormal `n×n` factor, `r` is its upper-triangular
  `n×m` factor (n/m here refer to the *rotated* matrix's own row/col counts).
- `downstream.body` is the second API's JSON response, passed through byte-for-byte
  (no reshaping, no re-serialization).

**Worked example** — a `2×3` input rotates to a `3×2` shape (rows ≥ cols), which is
QR-eligible and returns `200`:

- Input `[[1,2,3],[4,5,6]]` (2×3) → rotated `[[4,1],[5,2],[6,3]]` (3×2) → `200 OK`.

A `3×2` input rotates to `2×3` (rows < cols), which is **not** QR-eligible (gonum
requires `rows ≥ cols`) and is rejected — no auto-transpose:

- Input `[[1,2],[3,4],[5,6]]` (3×2) → rotated `[[5,3,1],[6,4,2]]` (2×3) → `422
  QR_SHAPE_UNSUPPORTED`.

### Error envelope (all non-2xx)

```json
{ "error": { "code": "MATRIX_RAGGED", "message": "all rows must have the same length", "details": { "row": 2, "expected": 2, "got": 1 } } }
```

| Code | HTTP | Trigger |
|---|---|---|
| `MATRIX_REQUIRED` | 400 | `matrix` missing or null |
| `MATRIX_EMPTY` | 400 | zero rows, or any row with zero columns |
| `MATRIX_RAGGED` | 400 | rows of differing length |
| `MATRIX_NOT_NUMERIC` | 400 | non-numeric, `NaN`, or `±Inf` element |
| `MATRIX_TOO_LARGE` | 400 | rows > 100, cols > 100, or elements > 10,000 |
| `QR_SHAPE_UNSUPPORTED` | 422 | after rotation, rows < cols (gonum requires rows ≥ cols) |
| `DOWNSTREAM_UNAVAILABLE` | 502 | downstream API unreachable, timed out, or non-2xx |
| `INTERNAL` | 500 | recovered panic / unexpected failure |

Pipeline order (explicit and testable): decode → validate raw input → rotate 90°
CW → validate rotated shape for QR eligibility → factorize → call downstream →
respond. A validation failure always short-circuits before the downstream call is
ever made.

### `GET /health`

Returns `200 {"status": "ok"}` independent of downstream availability.

## Why gonum for QR

QR factorization uses `gonum.org/v1/gonum/mat` (`mat.QR`), which implements
Householder reflections under the hood (LAPACK `GEQRF`/`ORGQR`) — the standard,
numerically stable algorithm. It avoids the loss of orthogonality naive
Gram-Schmidt exhibits on ill-conditioned input, and it is a battle-tested
implementation rather than a hand-rolled one.

`gonum` panics instead of returning an error when `rows < cols`. This service
guards against that in two layers:

1. An explicit `rows >= cols` shape check before calling `Factorize`, which
   returns `422 QR_SHAPE_UNSUPPORTED` without ever invoking gonum.
2. A `defer recover()` **inside** `internal/qr.Factorize` that converts any
   unexpected panic into a typed error, so the panic never crosses the package
   boundary. Fiber's `recover` middleware is kept only as a last-resort net for
   the rest of the request pipeline, never as the primary guard.

## Project structure

```
cmd/api/main.go            # Fiber bootstrap, config, routes, graceful shutdown
internal/config/           # env parsing: PORT, NODE_API_URL, NODE_API_TIMEOUT, NODE_API_PATH
internal/matrix/           # rotation.go — pure 90° CW rotation, no framework deps
internal/qr/                # qr.go — gonum mat.QR wrapper, returns domain types
internal/client/           # nodeapi.go — outbound client to the downstream Node API
internal/http/              # handler.go, dto.go, errors.go, health.go
internal/apierr/           # typed error taxonomy + HTTP status mapping
Dockerfile, .dockerignore
```

The downstream client is declared as an interface (`DownstreamClient`) in
`internal/http` (consumer-side), implemented by `internal/client.NodeAPI`. This
keeps the HTTP layer's tests free of any dependency on a live Node API — they use
a fake `DownstreamClient` instead.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the service listens on |
| `NODE_API_URL` | *(empty)* | Base URL of the downstream Node API |
| `NODE_API_TIMEOUT` | `5s` | Per-request timeout for the downstream call (Go duration string, e.g. `2s`) |
| `NODE_API_PATH` | *(empty)* | Path appended to `NODE_API_URL` for the downstream call |

## Running locally

This service lives at `apps/go-api` in the monorepo. Run all commands below
from inside this directory.

```bash
go run ./cmd/api
```

```bash
curl http://localhost:3000/health
# {"status":"ok"}

curl -X POST http://localhost:3000/api/v1/matrix/qr \
  -H "Content-Type: application/json" \
  -d '{"matrix": [[1,2,3],[4,5,6]]}'
```

## Testing

```bash
go test ./...
```

The test suite follows strict TDD (RED before GREEN) and covers:
- Pure unit tests for `internal/matrix` and `internal/qr` (table-driven, epsilon `1e-9`).
- `internal/config` env-var defaults/overrides/invalid-duration handling.
- `internal/client` outbound behavior via `httptest` (2xx passthrough, non-2xx, timeout, malformed URL).
- `internal/http` full pipeline integration tests via Fiber's `app.Test()` with a fake `DownstreamClient` — every documented error code, the happy path, downstream failure, and panic recovery.

## Container

Multi-stage build: `golang:1.24-alpine` compiles a static binary
(`CGO_ENABLED=0`, `-trimpath -ldflags="-s -w"`), then
`gcr.io/distroless/static-debian12:nonroot` runs it as a non-root user with no
shell or package manager in the final image.

```bash
docker build -t matrix-qr-api .
docker run --rm -p 3000:3000 matrix-qr-api
curl http://localhost:3000/health
# {"status":"ok"}
```

To point at a downstream Node API:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_API_URL=http://host.docker.internal:4000 \
  -e NODE_API_PATH=/api/v1/statistics \
  matrix-qr-api
```

## Scope notes

- No authentication (explicitly out of scope for this change).
- The Node/Express downstream API is a separate change; `downstream.body` is
  passed through verbatim and its contract is pinned by this service, not
  dictated by it.
- No automatic transpose is ever applied to make a wide matrix QR-eligible —
  `QR_SHAPE_UNSUPPORTED` is returned instead, by design.
