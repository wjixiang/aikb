# ==========================================
# Case Hub - Multi-stage Docker Build
# Medical case management NestJS service
# ==========================================

# ------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------
FROM node:22-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ------------------------------------------
# Stage 2: Builder
# ------------------------------------------
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# ------------------------------------------
# Stage 3: Production
# ------------------------------------------
FROM node:22-alpine AS production

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Create app directory
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3002

# Install production dependencies only
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Copy Prisma schema for migrations
COPY prisma ./prisma

# Create storage directory
RUN mkdir -p /app/storage/cases

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["node", "dist/main.js"]
