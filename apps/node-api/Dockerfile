# syntax=docker/dockerfile:1

# --- deps: install every dependency (dev included) for build+test tooling ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile TypeScript to dist/ ------------------------------------
FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- prod-deps: production-only dependency set (no tsc/jest in final image) -
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime: minimal non-root image ----------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]
