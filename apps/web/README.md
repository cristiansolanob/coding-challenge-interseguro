# web

React/TypeScript (Vite) single-page frontend that consumes `apps/go-api` and
displays the matrix rotation, QR factorization, and downstream statistics in
one view.

This is the optional frontend requirement of the challenge: "Implement a
frontend that consumes both APIs and shows the matrix rotation results plus
the additional statistics." Since `apps/go-api`'s single endpoint already
aggregates both services' results into one response, this app only calls
`apps/go-api` directly — it never calls `apps/node-api`.

## Contract it consumes

### `POST {VITE_GO_API_URL}/api/v1/matrix/qr`

Request:

```json
{ "matrix": [[1, 2, 3], [4, 5, 6]] }
```

Successful response (`200`):

```json
{
  "input": { "rows": 2, "cols": 3 },
  "rotated": { "rows": 3, "cols": 2, "values": [[4, 1], [5, 2], [6, 3]] },
  "q": { "rows": 3, "cols": 3, "values": [[...], [...], [...]] },
  "r": { "rows": 3, "cols": 2, "values": [[...], [...], [...]] },
  "downstream": {
    "status": "ok",
    "body": {
      "count": 15,
      "max": 6,
      "min": 0,
      "sum": 30,
      "average": 2,
      "isDiagonal": false,
      "diagonal": { "matrix": false, "q": false, "r": false }
    }
  }
}
```

Error envelope (any non-2xx):

```json
{ "error": { "code": "MATRIX_RAGGED", "message": "...", "details": { "row": 2, "expected": 2, "got": 1 } } }
```

The UI renders `error.code`, `error.message`, and `error.details` (when
present) directly, and shows a distinct message when the API is unreachable
(network error / timeout) rather than a raw fetch failure. See
`apps/go-api/README.md` for the full list of error codes and the pipeline
that produces them.

## Project structure

```
src/api/matrixApi.ts        # typed HTTP client for go-api's POST /api/v1/matrix/qr
src/components/MatrixInput.tsx    # editable matrix grid, rows/cols controls, presets
src/components/MatrixTable.tsx    # read-only matrix display table
src/components/ResultsPanel.tsx   # rotated/Q/R tables + statistics display
src/components/ErrorPanel.tsx     # renders the { error: { code, message, details } } envelope
src/App.tsx                 # page composition, client-side validation, request lifecycle
```

`src/api/matrixApi.ts` is the only module that talks to the network. It
exports typed request/response/error interfaces mirroring the go-api
contract above, so it can be tested or swapped independently of the UI.

Client-side validation (non-empty matrix, consistent row lengths, finite
numeric cells) runs before submit purely to avoid obviously-invalid
requests; the backend remains the source of truth for every other rule
(size limits, QR shape eligibility, etc.) and its error responses are
surfaced verbatim.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_GO_API_URL` | `http://localhost:3000` | Base URL of `apps/go-api`. Read at build/dev time via Vite's `import.meta.env`. |

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

## Running locally

This app lives in `apps/web` inside the monorepo. Run all commands below
from this directory.

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` by default.

This app depends on `apps/go-api` running and reachable at `VITE_GO_API_URL`
(default `http://localhost:3000`). For the statistics section of the results
to populate, `apps/go-api` in turn needs `apps/node-api` reachable via its
own `NODE_API_URL`/`NODE_API_PATH` configuration — see
`apps/go-api/README.md` and `apps/node-api/README.md` for how to run each
service.

## Build

```bash
npm run build   # tsc -b && vite build, emits dist/
npm run preview # serve the production build locally
npm run lint    # oxlint
```

## Container

Build multi-stage: `node:22-alpine` installs dependencies and runs
`npm run build`, then `nginx:1.27-alpine` serves the static `dist/` output.
Since Vite resolves `import.meta.env.VITE_GO_API_URL` at build time, pass it
as a build argument to point the built bundle at a specific go-api instance:

```bash
docker build -t matrix-qr-web --build-arg VITE_GO_API_URL=http://localhost:3000 .
docker run --rm -p 8080:80 matrix-qr-web
# open http://localhost:8080
```

## Scope notes

- No authentication (out of scope, matching both backend services).
- No client-side routing — this is intentionally a single page.
- No state management library — `useState` is sufficient for this scope.
