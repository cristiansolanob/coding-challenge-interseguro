# matrix-qr-api

Servicio HTTP en Go/Fiber que recibe una matriz rectangular, la rota 90° en
sentido horario (paso interno obligatorio del pipeline), calcula su
factorización QR (la salida requerida), reenvía el resultado a una API Node
downstream y devuelve Q/R al llamador.

Esto resuelve la ambigüedad rotación-vs-QR del enunciado del desafío a favor
de QR como payload del endpoint: **la rotación es un paso interno del
pipeline, QR es el entregable real del endpoint.**

## Contrato

### `POST /api/v1/matrix/qr`

Request:

```json
{ "matrix": [[1, 2, 3], [4, 5, 6]] }
```

Respuesta exitosa (`200`):

```json
{
  "input":   { "rows": 2, "cols": 3 },
  "rotated": { "rows": 3, "cols": 2, "values": [[4,1],[5,2],[6,3]] },
  "q":       { "rows": 3, "cols": 3, "values": [[...],[...],[...]] },
  "r":       { "rows": 3, "cols": 2, "values": [[...],[...],[...]] },
  "downstream": { "status": "ok", "body": { } }
}
```

- Todos los valores numéricos son JSON numbers (`float64`) con precisión
  completa — sin redondeo en el transporte. Comparar con epsilon `1e-9` al
  testear.
- **La dirección de rotación es 90° en sentido horario**:
  `rotated[j][m-1-i] = input[i][j]` para una entrada `m×n`.
- `q` es el factor ortonormal `n×n` de la matriz rotada, `r` es su factor
  triangular superior `n×m` (aquí n/m se refieren a las filas/columnas de la
  *matriz rotada*, no de la original).
- `downstream.body` es la respuesta JSON de la segunda API, reenviada
  byte a byte (sin reestructurar ni reserializar).

**Ejemplo desarrollado** — una entrada `2×3` rota a una forma `3×2`
(filas ≥ columnas), que es elegible para QR y devuelve `200`:

- Entrada `[[1,2,3],[4,5,6]]` (2×3) → rotada `[[4,1],[5,2],[6,3]]` (3×2) →
  `200 OK`.

Una entrada `3×2` rota a `2×3` (filas < columnas), que **no** es elegible
para QR (gonum requiere `rows ≥ cols`) y es rechazada — sin transposición
automática:

- Entrada `[[1,2],[3,4],[5,6]]` (3×2) → rotada `[[5,3,1],[6,4,2]]` (2×3) →
  `422 QR_SHAPE_UNSUPPORTED`.

### Envoltorio de error (todo no-2xx)

```json
{ "error": { "code": "MATRIX_RAGGED", "message": "all rows must have the same length", "details": { "row": 2, "expected": 2, "got": 1 } } }
```

| Código | HTTP | Disparador |
|---|---|---|
| `MATRIX_REQUIRED` | 400 | `matrix` ausente o null |
| `MATRIX_EMPTY` | 400 | cero filas, o alguna fila con cero columnas |
| `MATRIX_RAGGED` | 400 | filas de longitud distinta |
| `MATRIX_NOT_NUMERIC` | 400 | elemento no numérico, `NaN`, o `±Inf` |
| `MATRIX_TOO_LARGE` | 400 | filas > 100, columnas > 100, o elementos > 10,000 |
| `QR_SHAPE_UNSUPPORTED` | 422 | tras la rotación, filas < columnas (gonum requiere rows ≥ cols) |
| `DOWNSTREAM_UNAVAILABLE` | 502 | API downstream inalcanzable, timeout, o respuesta no-2xx |
| `INTERNAL` | 500 | panic recuperado / falla inesperada |

Orden del pipeline (explícito y testeable): decode → validar input crudo →
rotar 90° CW → validar forma rotada para elegibilidad QR → factorizar →
llamar al downstream → responder. Un fallo de validación siempre corta el
flujo antes de que se llegue a invocar el downstream.

### `GET /health`

Devuelve `200 {"status": "ok"}` independientemente de la disponibilidad del
downstream.

## Por qué gonum para QR

La factorización QR usa `gonum.org/v1/gonum/mat` (`mat.QR`), que implementa
reflexiones de Householder por debajo (LAPACK `GEQRF`/`ORGQR`) — el
algoritmo estándar y numéricamente estable. Evita la pérdida de
ortogonalidad que exhibe Gram-Schmidt ingenuo sobre entradas mal
condicionadas, y es una implementación probada en batalla en lugar de una
hecha a mano.

`gonum` hace panic en lugar de devolver un error cuando `rows < cols`. Este
servicio se protege contra eso en dos capas:

1. Un chequeo explícito de forma `rows >= cols` antes de llamar a
   `Factorize`, que devuelve `422 QR_SHAPE_UNSUPPORTED` sin invocar gonum en
   ningún momento.
2. Un `defer recover()` **dentro de** `internal/qr.Factorize` que convierte
   cualquier panic inesperado en un error tipado, de modo que el panic nunca
   cruza el límite del paquete. El middleware `recover` de Fiber se mantiene
   solo como red de último recurso para el resto del pipeline de la
   request, nunca como la protección principal.

## Estructura del proyecto

```
cmd/api/main.go            # bootstrap de Fiber, config, rutas, graceful shutdown
internal/config/           # parsing de env: PORT, NODE_API_URL, NODE_API_TIMEOUT, NODE_API_PATH
internal/matrix/           # rotation.go — rotación pura 90° CW, sin dependencias de framework
internal/qr/                # qr.go — wrapper de gonum mat.QR, devuelve tipos de dominio
internal/client/           # nodeapi.go — cliente saliente hacia la API Node downstream
internal/http/              # handler.go, dto.go, errors.go, health.go
internal/apierr/           # taxonomía de errores tipados + mapeo a status HTTP
Dockerfile, .dockerignore
```

El cliente downstream se declara como una interfaz (`DownstreamClient`) en
`internal/http` (lado consumidor), implementada por `internal/client.NodeAPI`.
Esto mantiene los tests de la capa HTTP libres de cualquier dependencia de
una API Node real — usan un `DownstreamClient` falso en su lugar.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP en el que escucha el servicio |
| `NODE_API_URL` | *(vacío)* | URL base de la API Node downstream |
| `NODE_API_TIMEOUT` | `5s` | Timeout por request para la llamada downstream (string de duración de Go, ej. `2s`) |
| `NODE_API_PATH` | *(vacío)* | Path que se agrega a `NODE_API_URL` para la llamada downstream |

## Ejecución local

Este servicio vive en `apps/go-api` dentro del monorepo. Ejecutar todos los
comandos de abajo desde este directorio.

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

La suite de tests sigue TDD estricto (RED antes de GREEN) y cubre:
- Tests unitarios puros para `internal/matrix` e `internal/qr`
  (table-driven, epsilon `1e-9`).
- Defaults/overrides/manejo de duraciones inválidas en `internal/config`.
- Comportamiento saliente de `internal/client` vía `httptest` (passthrough
  2xx, no-2xx, timeout, URL malformada).
- Tests de integración del pipeline completo de `internal/http` vía
  `app.Test()` de Fiber con un `DownstreamClient` falso — cada código de
  error documentado, el happy path, falla del downstream y recuperación de
  panic.

## Contenedor

Build multi-stage: `golang:1.24-alpine` compila un binario estático
(`CGO_ENABLED=0`, `-trimpath -ldflags="-s -w"`), luego
`gcr.io/distroless/static-debian12:nonroot` lo ejecuta como usuario no-root
sin shell ni package manager en la imagen final.

```bash
docker build -t matrix-qr-api .
docker run --rm -p 3000:3000 matrix-qr-api
curl http://localhost:3000/health
# {"status":"ok"}
```

Para apuntar a una API Node downstream:

```bash
docker run --rm -p 3000:3000 \
  -e NODE_API_URL=http://host.docker.internal:4000 \
  -e NODE_API_PATH=/api/v1/statistics \
  matrix-qr-api
```

## Notas de alcance

- Sin autenticación (explícitamente fuera de alcance para este cambio).
- La API Node/Express downstream es un cambio separado; `downstream.body`
  se reenvía verbatim y su contrato está fijado por este servicio, no
  dictado por él.
- Nunca se aplica una transposición automática para hacer elegible una
  matriz ancha para QR — se devuelve `QR_SHAPE_UNSUPPORTED` en su lugar,
  por diseño.
