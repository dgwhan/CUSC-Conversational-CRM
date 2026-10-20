# Multi-stage Dockerfile for NestJS API in pnpm workspace
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@latest
WORKDIR /app

# Stage 1: Build application
FROM base AS builder
WORKDIR /app

# Copy pnpm workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies including devDependencies needed to build
RUN pnpm install --frozen-lockfile

# Copy API source code
COPY apps/api ./apps/api

# Generate Prisma Client and build NestJS API
RUN pnpm --filter api prisma generate
RUN pnpm --filter api build

# Stage 2: Deploy isolated production dependencies
FROM base AS prod-deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Deploy isolated production dependencies for api
RUN pnpm --filter api --prod deploy /prod/api

WORKDIR /prod/api
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./
RUN npx prisma generate

# Stage 3: Lightweight runner image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Switch to built-in non-root user
USER node

# Copy deployed app with production dependencies and compiled code
COPY --chown=node:node --from=prod-deps /prod/api/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /prod/api/package.json ./package.json
COPY --chown=node:node --from=builder /app/apps/api/dist ./dist
COPY --chown=node:node --from=builder /app/apps/api/prisma ./prisma
COPY --chown=node:node --from=builder /app/apps/api/prisma.config.ts ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
