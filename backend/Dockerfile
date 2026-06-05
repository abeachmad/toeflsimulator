# Backend Dockerfile — Task 28.1
# Multi-stage build: build TypeScript then run compiled JS

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files (needed for npm workspaces)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install all deps (including devDeps for TypeScript compile)
RUN npm ci --workspace=backend

# Copy source and compile
COPY backend/ ./backend/
RUN npm run build --workspace=backend

# ---------- Production stage ----------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install production deps only
RUN npm ci --workspace=backend --omit=dev

# Copy compiled output
COPY --from=builder /app/backend/dist ./backend/dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
