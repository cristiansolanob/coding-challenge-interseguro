# Coding Challenge - Interseguro

Monorepo con dos APIs (Go y Node.js) y un frontend (React) que resuelven el
desafío técnico descrito en [`Coding-Challenge-Interseguro.md`](Coding-Challenge-Interseguro.md):
rotación + factorización QR de una matriz, seguida de estadísticas sobre el
resultado.

## Arquitectura

```
web (React/Vite) ──HTTP──▶ go-api (Go/Fiber) ──HTTP──▶ node-api (Node/Express)
     :5173                      :3000                       :3001
```

El frontend solo llama a `go-api`. `go-api` rota la matriz de entrada 90°
en sentido horario, calcula su factorización QR, reenvía Q/R a `node-api`
para las estadísticas, y devuelve todo agregado en una sola respuesta.

No hay autenticación entre servicios (fuera de alcance, ver notas de cada
README).

## Servicios

### `apps/go-api` — API en Go (Fiber)

Recibe la matriz original, la rota 90° CW (paso interno) y calcula su
factorización **QR** (entregable real del endpoint) vía `gonum`. Reenvía
Q/R al downstream Node y responde con matriz rotada + Q + R + estadísticas.

- `POST /api/v1/matrix/qr`
- `GET /health`
- Detalle completo (contrato, códigos de error, decisiones de diseño):
  [`apps/go-api/README.md`](apps/go-api/README.md)

### `apps/node-api` — API en Node.js (Express/TypeScript)

Recibe `matrix`, `q` y `r` desde `go-api` y calcula estadísticas agrupadas
(`max`, `min`, `sum`, `average`, `count`) sobre el pool combinado de las
tres matrices, más detección de matriz diagonal por matriz.

- `POST /api/v1/statistics`
- `GET /health`
- Detalle completo: [`apps/node-api/README.md`](apps/node-api/README.md)

### `apps/web` — Frontend (React + Vite)

SPA que consume únicamente `go-api` (que ya agrega el resultado de
`node-api`), permite editar la matriz de entrada y muestra matriz rotada,
Q, R y las estadísticas.

- Detalle completo: [`apps/web/README.md`](apps/web/README.md)

## Levantar el proyecto con Docker

Requiere Docker y Docker Compose. Desde la raíz del repo:

```bash
docker compose up --build
```

Esto construye y levanta los tres servicios en red:

| Servicio | URL |
|---|---|
| Frontend (web) | http://localhost:5173 |
| API Go | http://localhost:3000 |
| API Node | http://localhost:3001 |

El puerto del front se mapeó a `5173` (en vez del `80`/`8080` por defecto
de nginx) para evitar choques con otros servicios locales comunes en ese
rango (p. ej. Postgres/pgAdmin suelen ocupar `8080`).

`go-api` se conecta a `node-api` por nombre de servicio dentro de la red
que crea Compose (`http://node-api:3001`), no por `localhost`.

Para bajar todo:

```bash
docker compose down
```

Para reconstruir una imagen puntual tras cambios de código:

```bash
docker compose up --build go-api
```

### Levantar cada servicio por separado (sin Compose)

Ver la sección **Contenedor** de cada README individual
([go-api](apps/go-api/README.md#contenedor),
[node-api](apps/node-api/README.md#contenedor),
[web](apps/web/README.md#container)) para el `docker build`/`docker run`
manual de cada uno.

## Desarrollo local (sin Docker)

Cada servicio documenta su propio flujo de ejecución/tests en su README:

```bash
# go-api
cd apps/go-api && go run ./cmd/api

# node-api
cd apps/node-api && npm install && npm run dev

# web
cd apps/web && npm install && npm run dev
```

## Nota sobre los archivos `.env`

Los archivos `.env` (y sus `.env.example`) de este repo se dejan versionados
a propósito, únicamente para que el challenge sea fácil de levantar y
evaluar sin pasos adicionales de configuración. En un entorno real esto
**no debería hacerse**: los `.env` no van al control de versiones (se
excluyen vía `.gitignore`) porque suelen terminar conteniendo secretos,
credenciales o configuración sensible por entorno, y cada ambiente
(local/staging/prod) gestiona los suyos por fuera del repo — por ejemplo
con un secret manager, variables de entorno inyectadas por el orquestador,
o un vault.
