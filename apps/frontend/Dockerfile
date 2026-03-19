# Build stage (Bun)
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_API_URL=http://localhost:7777
ARG VITE_APP_NAME="SaaS Admin"
ARG VITE_UPLOAD_SHOW_UPDATED_DATATABLE=false

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_UPLOAD_SHOW_UPDATED_DATATABLE=$VITE_UPLOAD_SHOW_UPDATED_DATATABLE

# Copy package.json only (fresh install without lock file)
COPY package.json ./

# Install dependencies with Bun
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Runtime stage - Nginx to serve static files
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
