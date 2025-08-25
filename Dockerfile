# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mercurio -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=mercurio:nodejs /app/dist ./dist
COPY --from=builder --chown=mercurio:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mercurio:nodejs /app/prisma ./prisma
COPY --chown=mercurio:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown mercurio:nodejs logs

# Switch to non-root user
USER mercurio

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]