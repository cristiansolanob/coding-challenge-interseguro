# node-api

Servicio HTTP en Express/TypeScript que calcula estadísticas descriptivas
agrupadas (`max`/`min`/`sum`/`average`/`count`) y detección de matriz
diagonal por matriz, sobre tres matrices de entrada — `matrix`, `q`, `r`.

Este es el servicio downstream al que `apps/go-api` reenvía su resultado de
rotación/QR; el contrato de este servicio está definido y testeado de forma
independiente de ese llamador.

## Contrato

### `POST /api/v1/statistics`

Request:

```json
{
  "matrix": [[1, 2]],
  "q": [[3, 4], [5, 6]],
  "r": [[7]]
}
```

Respuesta exitosa (`200`):

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

- **Estadísticas agrupadas, no por matriz**: `max`/`min`/`sum`/`average`/
  `count` se calculan sobre un único pool combinado con todos los elementos
  de `matrix`, `q` y `r` juntos — no como tres resultados separados.
  `count` se devuelve explícitamente para que la agrupación sea
  autodocumentada para el llamador.
- **Semántica de diagonal**: `diagonal.{matrix,q,r}` reporta si cada
  entrada, individualmente, es una matriz diagonal (cuadrada, con todo
  elemento fuera de la diagonal dentro de `EPSILON` de cero). `isDiagonal`
  a nivel superior es el OR lógico de esos tres — `true` si *al menos una*
  de las tres entradas es diagonal. Una matriz no cuadrada nunca es un
  error; simplemente reporta `false` para ese campo.
- Todos los valores numéricos son JSON numbers (`number`) con precisión
  completa — sin redondeo en el transporte.

### Envoltorio de error (todo no-2xx)

```json
{ "error": { "code": "MATRIX_RAGGED", "message": "Field \"matrix\" has ragged rows: row 1 expected 2 columns, got 1.", "details": { "field": "matrix", "row": 1, "expected": 2, "got": 1 } } }
```

| Código | HTTP | Disparador |
|---|---|---|
| `PAYLOAD_INVALID` | 400 | el body de la request no es JSON válido, o excede el límite de 1 MB |
| `MATRIX_REQUIRED` | 400 | `matrix`/`q`/`r` ausente, `null`, o no es un array de arrays |
| `MATRIX_EMPTY` | 400 | cero filas, o una fila con cero columnas |
| `MATRIX_RAGGED` | 400 | filas de longitud distinta dentro del mismo campo |
| `MATRIX_NOT_NUMERIC` | 400 | elemento no numérico, `NaN`, o `±Infinity` |
| `MATRIX_TOO_LARGE` | 400 | el campo tiene > 100 filas, > 100 columnas, o > 10,000 elementos |
| `NOT_FOUND` | 404 | ruta no encontrada |
| `INTERNAL` | 500 | falla inesperada |

`details.field` indica cuál de `"matrix" | "q" | "r"` falló en cada código
de error por matriz, así el input problemático siempre es identificable.

Orden del pipeline (explícito y testeable): parseo de `express.json` →
validar las *tres* matrices por completo → calcular estadísticas agrupadas
→ calcular el reporte de diagonal → responder `200`. La validación nunca
tiene éxito parcial — una `r` malformada se reporta incluso si `matrix` y
`q` son ambas válidas, y no corre ninguna aritmética hasta que la
validación de los tres campos haya terminado.

### `GET /health`

Devuelve `200 {"status": "ok"}`.

## Decisiones clave

- **Estadísticas agrupadas sobre `matrix + q + r` combinadas** (no por
  matriz): alcance confirmado — `max`/`min`/`sum`/`average`/`count` de la
  respuesta describen un único pool construido con todos los elementos de
  las tres entradas en un solo paso de acumulación, no tres resultados
  independientes.
- **`EPSILON = 1e-9`** para la detección de diagonal: un elemento fuera de
  la diagonal solo se trata como "efectivamente cero" cuando su valor
  absoluto está estrictamente por debajo de esta tolerancia. Un `=== 0`
  estricto clasificaría mal matrices genuinamente diagonales, ya que una
  factorización QR de Householder (como la que produce `apps/go-api`) deja
  ruido de punto flotante en las celdas fuera de la diagonal de `Q`/`R`.
  Esto coincide con el epsilon del propio test de diagonal de la API Go.
- **Semántica de diagonal — chequeo por matriz, OR global**:
  `diagonal.matrix`, `diagonal.q`, `diagonal.r` se calculan de forma
  independiente (cada uno requiere forma cuadrada); el `isDiagonal` de
  nivel superior es `true` si *cualquiera* de ellos es `true`. Una entrada
  no cuadrada reporta `false` para ese campo sin lanzar un error.

## Estructura del proyecto

```
src/config/env.ts          # parsing de PORT: default 3001, fail-fast ante valor inválido
src/stats/types.ts         # Matrix, PoolStatistics, DiagonalReport
src/stats/stats.ts         # poolStatistics() — acumulador agrupado de una sola pasada
src/stats/diagonal.ts      # EPSILON, isDiagonal(), diagonalReport()
src/http/dto.ts            # parseStatisticsRequest() — validación completa de la request
src/http/errors.ts         # ApiError, taxonomía de errores, errorHandler, notFoundHandler
src/http/routes.ts         # POST /api/v1/statistics, GET /health
src/app.ts                 # factory createApp(cfg) — el seam de testing, sin listen()
src/server.ts              # loadConfig() → createApp() → listen(), graceful shutdown
tests/unit/                # stats, diagonal, dto, env
tests/integration/         # Supertest contra createApp()
Dockerfile, .dockerignore
```

`src/stats/` es puro y libre de framework (sin tipos de Express), por lo
que se testea de forma unitaria y aislada. `src/app.ts` exporta
`createApp(cfg): Express` como el único seam de testing — Supertest lo
maneja in-process, sin puerto y sin red; solo `src/server.ts` llama a
`.listen()`.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto HTTP en el que escucha el servicio. Un valor no numérico lanza un error al arrancar (fail fast) |

## Ejecución local

Este servicio vive en `apps/node-api` dentro del monorepo. Ejecutar todos
los comandos de abajo desde este directorio.

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

La suite sigue TDD estricto (RED antes de GREEN) y cubre:
- Tests unitarios puros para `src/stats/stats.ts` y `src/stats/diagonal.ts`
  (`it.each` table-driven, casos límite de epsilon).
- `src/http/dto.ts` — un caso por código de error, por campo
  (`matrix`/`q`/`r`).
- `src/config/env.ts` — default/override/`PORT` inválido.
- Tests de integración del pipeline completo de `src/app.ts` vía
  Supertest — happy path, cada código de error documentado, JSON
  malformado, ruta desconocida, health check.

```bash
npm run build   # tsc — type-checks y emite dist/
npm run lint    # eslint flat config (typescript-eslint + prettier)
```

## Contenedor

Build multi-stage: `deps` (npm ci, devDependencies completas) → `build`
(tsc → `dist/`) → `prod-deps` (npm ci --omit=dev) → `runtime`
(`node:22-alpine`, `USER node` no-root). Separar `prod-deps` de `deps`
mantiene la capa de `npm ci` cacheada entre rebuilds y deja cero
devDependencies (`typescript`, `jest`, …) en la imagen final.

```bash
docker build -t node-api .
docker run --rm -p 3001:3001 node-api
curl http://localhost:3001/health
# {"status":"ok"}
```

## Notas de alcance

- Sin autenticación (explícitamente fuera de alcance para este cambio).
- Este servicio es consumido por el cliente downstream de `apps/go-api`,
  pero su contrato está definido y testeado de forma independiente — nada
  aquí depende de la API Go.
