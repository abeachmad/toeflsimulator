# Frontend Dockerfile — Task 28.2
# Multi-stage: Node build → Nginx serve

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Install all deps
RUN npm ci --workspace=frontend

# Copy source and build
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# ---------- Production stage ----------
FROM nginx:1.27-alpine AS production

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
