FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Copy package files and install production dependencies only
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g node -g 1000 && \
    adduser -S node -u 1000 -G node

USER node

EXPOSE 9400

CMD ["node", "dist/server.js"]
