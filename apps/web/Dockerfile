# syntax=docker/dockerfile:1

# --- Build stage -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_GO_API_URL is baked in at build time since Vite env vars are resolved
# statically; override with --build-arg VITE_GO_API_URL=<url> as needed.
ARG VITE_GO_API_URL=http://localhost:3000
ENV VITE_GO_API_URL=${VITE_GO_API_URL}

RUN npm run build

# --- Runtime stage -------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
