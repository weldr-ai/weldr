# Base image
FROM node:22-alpine AS base

FROM base AS bun

# Install linux dependencies
RUN apk update && apk add --no-cache ca-certificates bash curl unzip

# Install Bun
RUN curl https://bun.sh/install | bash -s -- bun-v1.2.2
ENV BUN_INSTALL="/root/.bun"
ENV PATH="/root/.bun/bin:${PATH}"

# Install dependencies
FROM bun AS deps
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM bun AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
