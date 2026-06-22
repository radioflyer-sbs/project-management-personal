# ─── Stage 1: Compile TypeScript ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first so npm ci is cached when only source changes
COPY project-management-server/package*.json ./
RUN npm ci --prefer-offline

# Copy source and compile
COPY project-management-server/ ./
RUN npm run build

# ─── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Production dependencies only — keeps image small
COPY project-management-server/package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Compiled output from the builder
COPY --from=builder /app/dist ./dist

# Base config — specific keys overridden by environment variables in docker-compose.yml:
#   MONGO_CONNECTION_STRING, MONGO_DATABASE_NAME, JWT_SECRET, SERVER_PORT
COPY local-deploy/server/app-config.json ./app-config.json

EXPOSE 1089
CMD ["node", "dist/index.js"]
