FROM node:24-alpine AS frontend
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY server ./server
ARG VITE_GO_BACKEND=true
RUN npm run build

FROM caddy:2-alpine
LABEL org.opencontainers.image.source="https://github.com/godev256/uliana-learning-platform"
COPY --from=frontend /src/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
