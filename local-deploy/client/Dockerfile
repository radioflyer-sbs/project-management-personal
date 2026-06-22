# ─── Stage 1: Build the Angular application ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first so npm ci is cached when only source changes
COPY project-management-client/package*.json ./
RUN npm ci --prefer-offline

# Copy source, then override the production environment with the Docker config
COPY project-management-client/ ./
COPY local-deploy/client/environment.ts ./src/environments/environment.ts

# Production build (outputs to dist/project-management-client/browser)
RUN npm run build

# ─── Stage 2: Serve static files ──────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist/project-management-client/browser /usr/share/nginx/html
COPY local-deploy/client/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
