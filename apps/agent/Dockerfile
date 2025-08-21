# ───────────────────────────────────────────
# Weldr Agent Application
#   • Alpine base with Node.js + Bun
#   • Turborepo pruned build
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
    ripgrep

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
# Builder stage - prune workspace
# ───────────────────────────────────────────

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
RUN npm install -g turbo@2.5.0
COPY . .
RUN turbo prune @weldr/agent --docker

# ───────────────────────────────────────────
# Installer stage - install dependencies
# ───────────────────────────────────────────

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build

# ───────────────────────────────────────────
# Runner stage - production
# ───────────────────────────────────────────

FROM base AS runner
WORKDIR /app

# Copy flyctl
COPY --from=flyio /flyctl /usr/bin

# Copy scripts to standard Linux location
COPY ./apps/agent/scripts /usr/weldr/scripts
RUN chmod +x /usr/weldr/scripts/*

# Copy built application
COPY --from=installer /app .

EXPOSE 3000

CMD ["node", "dist/index.js"]
