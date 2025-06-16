# ───────────────────────────────────────────
# Weldr development machine image
#   • Alpine base
#   • Node.js + Bun as package manager
# ───────────────────────────────────────────

FROM flyio/flyctl:latest AS flyio
FROM node:22-alpine AS base

# ───────────────────────────────────────────
# System dependencies
# ───────────────────────────────────────────

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    unzip \
    tree \
    git \
    ripgrep \
    aws-cli

# ───────────────────────────────────────────
# Install Bun system-wide
# ───────────────────────────────────────────

RUN curl https://bun.sh/install | bash -s -- bun-v1.2.2 && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun

# ───────────────────────────────────────────
# Set git config
# ───────────────────────────────────────────

RUN git config --global user.name "weldr" && \
    git config --global user.email "noreply@weldr.ai" && \
    git config --global --add safe.directory /workspace

# ───────────────────────────────────────────
# Build stage
# ───────────────────────────────────────────

FROM golang:1.24.1-alpine AS builder

WORKDIR /app

# Copy manager package
COPY packages/manager/ .

# Download dependencies
RUN go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# ───────────────────────────────────────────
# Production stage
# ───────────────────────────────────────────

FROM base AS runner

# Build argument for development mode
ARG ENV=production

# Copy flyctl
COPY --from=flyio /flyctl /usr/bin

# Copy entrypoint script
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

COPY --from=builder /app/main /.weldr/main
COPY ./data/boilerplates /.weldr/data/boilerplates

COPY ./scripts /.weldr/scripts
RUN chmod +x /.weldr/scripts/*

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
