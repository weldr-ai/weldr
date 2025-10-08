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
RUN apk update && \
  apk add --no-cache \
  bash \
  ca-certificates \
  curl \
  unzip \
  tree \
  git \
  ripgrep \
  libc6-compat

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
# Enable pnpm
# ───────────────────────────────────────────

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# ───────────────────────────────────────────
# Builder stage - prune workspace
# ───────────────────────────────────────────

FROM base AS builder
WORKDIR /app
RUN npm install -g turbo@2.5.0
COPY . .
RUN turbo prune @weldr/agent --docker

# ───────────────────────────────────────────
# Installer stage - install dependencies
# ───────────────────────────────────────────

FROM base AS installer
WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --prod=false

COPY --from=builder /app/out/full/ .

RUN pnpm turbo build --filter=@weldr/agent...

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ───────────────────────────────────────────
# Runner stage - production
# ───────────────────────────────────────────

FROM base AS runner
WORKDIR /app

COPY --from=flyio /flyctl /usr/bin

COPY --from=installer /app/apps/agent/scripts /usr/weldr/scripts
RUN chmod +x /usr/weldr/scripts/*

COPY --from=installer /app/apps/agent/dist ./apps/agent/dist
COPY --from=installer /app/apps/agent/package.json ./apps/agent/package.json
COPY --from=installer /app/packages ./packages
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/apps/agent

EXPOSE 3000

CMD ["node", "dist/index.js"]
