# ─── Stage 1: Base ───
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ─── Stage 2: Dependencies ───
FROM base AS deps

# 先拷贝 workspace 配置和各包的 package.json，利用 Docker 缓存层减少重复安装
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY prisma/package.json ./prisma/

RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build ───
FROM deps AS build

COPY . .
RUN pnpm db:generate && pnpm --filter server build

# 构建完成后裁剪为生产依赖，大幅减小最终镜像体积
RUN pnpm prune --prod

# ─── Stage 4: Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 仅拷贝运行时必需的文件
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/prisma ./prisma

WORKDIR /app/apps/server

EXPOSE 3001
CMD ["node", "dist/main"]
