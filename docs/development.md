# 开发环境搭建指南

## 前置要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | >= 20 | 推荐 LTS 版本 |
| pnpm | >= 9.15 | 包管理器 |
| Docker / Podman | - | 运行 PostgreSQL 和 Redis |

## 1. 克隆项目并安装依赖

```bash
git clone <repo-url>
cd xiaohongshuvideo
pnpm install
```

## 2. 配置环境变量

复制 `.env.example` 到项目根目录并命名为 `.env`：

```bash
cp .env.example .env
```

根据实际环境修改配置（默认值可直接用于本地开发）：

```env
# 数据库连接
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/video_analysis?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 密钥（生产环境务必更换为随机字符串）
JWT_SECRET=your-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

## 3. 启动基础服务（PostgreSQL + Redis）

**使用 Docker Compose：**

```bash
docker compose up -d
```

**使用 Podman：**

```bash
# 创建 pod 统一管理端口映射
podman pod create --name video-analysis -p 5432:5432 -p 6379:6379

# 启动 PostgreSQL
podman run -d --pod video-analysis --name video-analysis-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=video_analysis \
  docker.io/library/postgres:16-alpine

# 启动 Redis
podman run -d --pod video-analysis --name video-analysis-redis \
  docker.io/library/redis:7-alpine
```

验证服务是否就绪：

```bash
# PostgreSQL
pg_isready -h localhost -p 5432

# Redis
redis-cli ping   # 应返回 PONG
```

## 4. 初始化数据库

```bash
# 将 Prisma Schema 同步到数据库（创建表结构）
npx prisma db push

# 生成 Prisma Client
npx prisma generate

# 写入种子数据（创建管理员账号）
npx prisma db seed
```

种子数据会创建一个管理员用户：

| 字段 | 值 |
|------|-----|
| 邮箱 | admin@example.com |
| 密码 | admin123 |
| 角色 | ADMIN |

## 5. 启动开发服务器

**方式一：同时启动前后端（推荐）**

```bash
pnpm dev
```

Turborepo 会并行启动后端和前端开发服务器。

**方式二：分别启动**

```bash
# 终端 1 — 后端 (NestJS, 端口 3001)
pnpm --filter server start:dev

# 终端 2 — 前端 (Next.js, 端口 3000)
pnpm --filter web dev
```

## 6. 访问应用

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端 API | http://localhost:3001/api |

打开 http://localhost:3000，使用 `admin@example.com` / `admin123` 登录。

## 项目结构

```
xiaohongshuvideo/
├── apps/
│   ├── server/          # NestJS 后端
│   │   └── src/
│   │       ├── modules/ # 业务模块 (auth, user, model, video, skill, report, task, ...)
│   │       ├── common/  # Prisma 服务、公共装饰器
│   │       └── main.ts  # 入口，端口 3001
│   └── web/             # Next.js 前端
│       └── src/
│           ├── app/     # App Router 页面
│           ├── components/  # UI 组件
│           ├── hooks/   # 自定义 Hooks
│           ├── lib/     # API 客户端、工具函数
│           └── stores/  # Zustand 状态管理
├── packages/
│   └── shared/          # 前后端共享的类型和常量
├── prisma/
│   ├── schema.prisma    # 数据库模型定义
│   └── seed.ts          # 种子数据
├── docker-compose.yml   # PostgreSQL + Redis
├── turbo.json           # Turborepo 配置
└── .env                 # 环境变量（不提交到 Git）
```

## 常用命令

```bash
# 开发
pnpm dev                          # 同时启动前后端开发服务器
pnpm --filter server start:dev    # 仅启动后端（热重载）
pnpm --filter web dev             # 仅启动前端

# 构建
pnpm build                        # 构建所有包
pnpm --filter server build        # 仅构建后端
pnpm --filter web build           # 仅构建前端

# 数据库
npx prisma db push                # 同步 Schema 到数据库
npx prisma generate               # 重新生成 Prisma Client
npx prisma db seed                # 执行种子数据
npx prisma studio                 # 打开数据库可视化管理界面

# 代码检查
pnpm lint                         # 全量 lint
```

## 技术栈速查

| 层 | 技术 |
|----|------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| UI 组件 | shadcn/ui (new-york) + Tailwind CSS v4 |
| 状态管理 | Zustand (auth) + TanStack React Query (数据) |
| 后端框架 | NestJS 11 |
| ORM | Prisma 6 |
| 数据库 | PostgreSQL 16 |
| 队列 | Bull + Redis 7 |
| 实时通信 | Socket.IO (WebSocket) |
| 认证 | JWT (access + refresh token) + Passport |
| 权限 | RBAC 三级角色：ADMIN > OPERATOR > USER |
