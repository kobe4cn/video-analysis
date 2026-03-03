# ─── Stage 1: Base ───
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ─── Stage 2: Dependencies ───
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY prisma/package.json ./prisma/

RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build ───
FROM deps AS build

# Next.js 在构建时内联 NEXT_PUBLIC_ 前缀的环境变量，必须通过 ARG 在构建时注入
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN pnpm --filter web build

# ─── Stage 4: Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone 模式输出包含内置的 server.js，无需完整 node_modules
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
