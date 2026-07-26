# syntax=docker/dockerfile:1
# Build from repo root: docker compose build api
FROM node:18-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile --filter @gx-portal/api...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api

ENV NODE_ENV=production
# Compile shared types to CJS so Nest can require('@gx-portal/types') at runtime
RUN pnpm --filter @gx-portal/types build \
  && pnpm --filter @gx-portal/api build

FROM node:18-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
