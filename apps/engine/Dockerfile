# Base image with pnpm globally installed
FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Stage 1: Install dependencies
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy the package files
COPY pnpm-lock.yaml ./
COPY package.json ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the application sources into the build stage
COPY . .

# Build the application
RUN pnpm build

# Remove the existing node_modules
RUN rm -rf node_modules

# Reinstall only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Stage 2: Create the production image
FROM base AS runner
WORKDIR /app

# Install tired-proxy
COPY --from=tiesv/tired-proxy:latest /tired-proxy /tired-proxy

# Copy application build artifacts.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/start.sh ./start.sh

RUN chmod +x start.sh

EXPOSE 3000/tcp

CMD ["./start.sh"]
