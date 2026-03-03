# 视频解析平台实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于 GLM-4.6V 的视频解析 Web 平台，支持视频上传到阿里云 OSS、批量解析任务、报告版本管理、Skills 管理和多角色权限控制。

**Architecture:** Monorepo (Turborepo + pnpm)，前端 Next.js 15 App Router，后端 NestJS，数据库 PostgreSQL + Prisma ORM，任务队列 Bull + Redis，实时通信 Socket.IO，认证 JWT。

**Tech Stack:** Next.js 15, NestJS, Prisma, PostgreSQL, Redis, Bull, Socket.IO, shadcn/ui, Tailwind CSS, Zustand, TanStack Query, ali-oss, Zod

**设计文档:** `docs/plans/2026-03-03-video-analysis-platform-design.md`

---

## Phase 1: 基础设施搭建

### Task 1: Monorepo 脚手架初始化

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: 初始化 git 仓库**

```bash
cd /Users/kevin/dev/ai/xiaohongshuvideo
git init
```

**Step 2: 创建根 package.json**

```json
{
  "name": "xiaohongshuvideo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "db:generate": "cd prisma && npx prisma generate",
    "db:migrate": "cd prisma && npx prisma migrate dev",
    "db:push": "cd prisma && npx prisma db push",
    "db:seed": "cd prisma && npx tsx seed.ts"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@9.15.0"
}
```

**Step 3: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "prisma"
```

**Step 4: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 5: 创建 .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
*.log
.DS_Store
.turbo/
```

**Step 6: 创建 .env.example**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/video_analysis?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# 阿里云 OSS (在系统内通过 DB 管理，此处为后备/默认配置)
# OSS_REGION=oss-cn-hangzhou
# OSS_ACCESS_KEY_ID=
# OSS_ACCESS_KEY_SECRET=
# OSS_BUCKET=

# GLM API (在系统内通过 DB 管理模型供应商)
# GLM_API_KEY=
# GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

**Step 7: 安装根依赖并提交**

```bash
pnpm install
git add -A
git commit -m "chore: initialize monorepo with Turborepo + pnpm"
```

---

### Task 2: Docker Compose 配置 (PostgreSQL + Redis)

**Files:**
- Create: `docker-compose.yml`

**Step 1: 创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: video-analysis-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: video_analysis
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: video-analysis-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**Step 2: 启动服务验证**

```bash
docker compose up -d
docker compose ps
```

Expected: postgres 和 redis 两个容器均为 running 状态。

**Step 3: 提交**

```bash
git add docker-compose.yml
git commit -m "chore: add Docker Compose for PostgreSQL and Redis"
```

---

### Task 3: 共享包 (packages/shared)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants/roles.ts`
- Create: `packages/shared/src/constants/status.ts`
- Create: `packages/shared/src/types/api.ts`
- Create: `packages/shared/src/types/auth.ts`
- Create: `packages/shared/src/types/video.ts`
- Create: `packages/shared/src/types/task.ts`
- Create: `packages/shared/src/types/skill.ts`
- Create: `packages/shared/src/types/report.ts`
- Create: `packages/shared/src/types/model.ts`
- Create: `packages/shared/src/types/storage.ts`

**Step 1: 创建 package.json**

```json
{
  "name": "@repo/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Step 3: 创建常量文件 — roles.ts**

```typescript
// packages/shared/src/constants/roles.ts
export const Role = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// 权限层级：ADMIN > OPERATOR > USER
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  OPERATOR: 2,
  USER: 1,
};
```

**Step 4: 创建常量文件 — status.ts**

```typescript
// packages/shared/src/constants/status.ts
export const TaskStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskVideoStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type TaskVideoStatus = (typeof TaskVideoStatus)[keyof typeof TaskVideoStatus];
```

**Step 5: 创建类型文件 — api.ts（通用响应类型）**

```typescript
// packages/shared/src/types/api.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}
```

**Step 6: 创建类型文件 — auth.ts**

```typescript
// packages/shared/src/types/auth.ts
import type { Role } from '../constants/roles';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
}
```

**Step 7: 创建类型文件 — video.ts**

```typescript
// packages/shared/src/types/video.ts
export interface VideoItem {
  id: string;
  title: string;
  fileName: string;
  ossUrl: string;
  fileSize: number;
  duration: number | null;
  bucketId: string;
  uploadedBy: string;
  hasReport: boolean;
  latestReportId: string | null;
  createdAt: string;
}

export interface UploadTokenRequest {
  fileName: string;
  fileSize: number;
  bucketId?: string;
}

export interface UploadTokenResponse {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  region: string;
  bucket: string;
  key: string;
  expiration: string;
}

export interface UploadCompleteRequest {
  ossKey: string;
  fileName: string;
  title: string;
  fileSize: number;
  bucketId: string;
  duration?: number;
}
```

**Step 8: 创建类型文件 — task.ts**

```typescript
// packages/shared/src/types/task.ts
import type { TaskStatus, TaskVideoStatus } from '../constants/status';

export interface CreateTaskRequest {
  name: string;
  videoIds: string[];
  skillId: string;
  modelId: string;
}

export interface TaskItem {
  id: string;
  name: string;
  status: TaskStatus;
  skillId: string;
  skillName: string;
  modelId: string;
  modelName: string;
  progress: number;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskDetail extends TaskItem {
  taskVideos: TaskVideoItem[];
}

export interface TaskVideoItem {
  id: string;
  videoId: string;
  videoTitle: string;
  status: TaskVideoStatus;
  reportId: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// WebSocket 事件载荷
export interface TaskProgressPayload {
  taskId: string;
  progress: number;
  currentVideoId: string;
  currentVideoTitle: string;
}

export interface TaskVideoCompletedPayload {
  taskId: string;
  taskVideoId: string;
  videoId: string;
  reportId: string;
}

export interface TaskVideoFailedPayload {
  taskId: string;
  taskVideoId: string;
  videoId: string;
  error: string;
}
```

**Step 9: 创建类型文件 — skill.ts**

```typescript
// packages/shared/src/types/skill.ts
export interface SkillItem {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetail extends SkillItem {
  content: string;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  content: string;
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  content?: string;
}

export interface SkillVersionItem {
  id: string;
  version: number;
  content: string;
  createdAt: string;
}
```

**Step 10: 创建类型文件 — report.ts**

```typescript
// packages/shared/src/types/report.ts
export interface ReportItem {
  id: string;
  videoId: string;
  videoTitle: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDetail extends ReportItem {
  content: string;
}

export interface ReportVersionItem {
  id: string;
  version: number;
  createdAt: string;
}

export interface ReportVersionDetail extends ReportVersionItem {
  content: string;
  skillId: string | null;
  modelId: string | null;
  prompt: string | null;
}

export interface ReviseReportRequest {
  additionalRequirements: string;
}
```

**Step 11: 创建类型文件 — model.ts**

```typescript
// packages/shared/src/types/model.ts
export interface ModelProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  modelCount: number;
  createdAt: string;
}

export interface CreateModelProviderRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface UpdateModelProviderRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  isActive?: boolean;
}

export interface ModelItem {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

export interface CreateModelRequest {
  name: string;
  displayName: string;
  providerId: string;
  config?: Record<string, unknown>;
}

export interface UpdateModelRequest {
  name?: string;
  displayName?: string;
  isActive?: boolean;
  config?: Record<string, unknown>;
}
```

**Step 12: 创建类型文件 — storage.ts**

```typescript
// packages/shared/src/types/storage.ts
export interface OssConfigItem {
  id: string;
  name: string;
  provider: string;
  region: string;
  bucketCount: number;
  createdAt: string;
}

export interface CreateOssConfigRequest {
  name: string;
  provider?: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
}

export interface UpdateOssConfigRequest {
  name?: string;
  region?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
}

export interface OssBucketItem {
  id: string;
  name: string;
  ossConfigId: string;
  ossConfigName: string;
  isDefault: boolean;
  videoCount: number;
  createdAt: string;
}

export interface CreateOssBucketRequest {
  name: string;
  ossConfigId: string;
  isDefault?: boolean;
}
```

**Step 13: 创建入口 index.ts（统一导出）**

```typescript
// packages/shared/src/index.ts
export * from './constants/roles';
export * from './constants/status';
export * from './types/api';
export * from './types/auth';
export * from './types/video';
export * from './types/task';
export * from './types/skill';
export * from './types/report';
export * from './types/model';
export * from './types/storage';
```

**Step 14: 安装依赖并验证**

```bash
cd packages/shared && pnpm install && pnpm lint
```

Expected: 无 TypeScript 编译错误。

**Step 15: 提交**

```bash
git add packages/shared/
git commit -m "feat: add shared package with types and constants"
```

---

### Task 4: Prisma Schema 与数据库迁移

**Files:**
- Create: `prisma/package.json`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

**Step 1: 创建 prisma/package.json**

```json
{
  "name": "@repo/prisma",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "push": "prisma db push",
    "seed": "tsx seed.ts",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6"
  },
  "devDependencies": {
    "prisma": "^6",
    "tsx": "^4",
    "typescript": "^5",
    "bcryptjs": "^2.4.3",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

**Step 2: 创建 prisma/schema.prisma**

完整内容参见设计文档 4.2 节中的 Prisma Schema。将其原样复制到 `prisma/schema.prisma`，并在顶部添加：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Step 3: 创建 prisma/seed.ts（种子数据 — 默认 Admin 用户）**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  console.log('Seed completed: admin user created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Step 4: 创建 .env 文件（从 .env.example 复制并填入本地值）**

```bash
cp .env.example .env
```

**Step 5: 安装依赖、生成 Prisma Client、运行迁移、执行种子**

```bash
cd prisma && pnpm install
pnpm generate
pnpm migrate --name init
pnpm seed
```

Expected: 数据库表已创建，admin 用户已插入。

**Step 6: 提交**

```bash
git add prisma/ .env.example
git commit -m "feat: add Prisma schema, initial migration, and seed data"
```

---

## Phase 2: 后端核心模块

### Task 5: NestJS 应用初始化

**Files:**
- Create: `apps/server/` (通过 @nestjs/cli 生成)
- Modify: `apps/server/package.json` (添加依赖)
- Create: `apps/server/src/app.module.ts`
- Create: `apps/server/src/main.ts`
- Create: `apps/server/src/config/` (配置模块)

**Step 1: 创建 NestJS 应用**

```bash
cd apps && npx @nestjs/cli new server --package-manager pnpm --skip-git
```

**Step 2: 安装核心依赖**

```bash
cd apps/server
pnpm add @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add @nestjs/bull bull ioredis
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
pnpm add @prisma/client bcryptjs class-validator class-transformer
pnpm add ali-oss
pnpm add -D @types/passport-jwt @types/bcryptjs @types/bull
```

**Step 3: 添加 @repo/shared 和 @repo/prisma 为依赖**

在 `apps/server/package.json` 中添加：

```json
{
  "dependencies": {
    "@repo/shared": "workspace:*",
    "@repo/prisma": "workspace:*"
  }
}
```

然后运行 `pnpm install`。

**Step 4: 创建配置模块 `apps/server/src/config/config.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../../../.env'),
    }),
  ],
})
export class AppConfigModule {}
```

**Step 5: 创建 Prisma 服务 `apps/server/src/common/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Step 6: 创建 PrismaModule `apps/server/src/common/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Step 7: 更新 AppModule `apps/server/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
  ],
})
export class AppModule {}
```

**Step 8: 更新 main.ts（启用 CORS、validation pipe）**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(3001);
  console.log('Server running on http://localhost:3001');
}
bootstrap();
```

**Step 9: 启动测试**

```bash
cd apps/server && pnpm start:dev
```

Expected: 服务启动无报错，监听 3001 端口。

**Step 10: 提交**

```bash
git add apps/server/
git commit -m "feat: initialize NestJS server with Prisma, config, and CORS"
```

---

### Task 6: 认证模块 (Auth)

**Files:**
- Create: `apps/server/src/modules/auth/auth.module.ts`
- Create: `apps/server/src/modules/auth/auth.controller.ts`
- Create: `apps/server/src/modules/auth/auth.service.ts`
- Create: `apps/server/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `apps/server/src/modules/auth/guards/jwt-auth.guard.ts`
- Create: `apps/server/src/modules/auth/guards/roles.guard.ts`
- Create: `apps/server/src/modules/auth/decorators/roles.decorator.ts`
- Create: `apps/server/src/modules/auth/decorators/current-user.decorator.ts`
- Create: `apps/server/src/modules/auth/dto/login.dto.ts`
- Create: `apps/server/src/modules/auth/dto/register.dto.ts`

**核心实现要点:**

1. **JWT Strategy**: 从 Bearer token 解析 userId + role，附到 request.user
2. **JwtAuthGuard**: 全局默认启用 JWT 认证
3. **RolesGuard**: 检查 `@Roles(Role.ADMIN)` 装饰器指定的角色要求
4. **@Public()**: 装饰器标记不需要认证的端点（如 login）
5. **AuthService**:
   - `login(email, password)`: 校验密码 → 生成 accessToken + refreshToken
   - `refresh(refreshToken)`: 验证 refreshToken → 生成新 token 对
   - `register(dto)`: 创建用户（仅 Admin 可调用）
   - `getMe(userId)`: 返回当前用户信息

**Step 1: 实现 DTO（login.dto.ts, register.dto.ts）**

使用 class-validator 装饰器校验 email/password/name/role。

**Step 2: 实现 JWT Strategy + Guards**

- `jwt.strategy.ts`: PassportStrategy(Strategy, 'jwt')，从 env 读取 JWT_SECRET
- `jwt-auth.guard.ts`: 继承 AuthGuard('jwt')，支持 @Public() 跳过
- `roles.guard.ts`: 读取 @Roles() 元数据，比较 ROLE_HIERARCHY

**Step 3: 实现 AuthService**

- 使用 bcryptjs 校验/加密密码
- 使用 @nestjs/jwt 签发 token

**Step 4: 实现 AuthController**

```
POST /api/auth/login    → @Public()
POST /api/auth/refresh  → @Public()
POST /api/auth/register → @Roles(Role.ADMIN)
GET  /api/auth/me       → 已登录即可
```

**Step 5: 在 AppModule 中注册 AuthModule，并全局启用 JwtAuthGuard 和 RolesGuard**

**Step 6: 测试登录流程**

```bash
# 使用种子数据中的 admin 账号登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Expected: 返回 accessToken 和 refreshToken。

**Step 7: 提交**

```bash
git add apps/server/src/modules/auth/
git commit -m "feat: add auth module with JWT login, register, roles guard"
```

---

### Task 7: 用户管理模块 (User)

**Files:**
- Create: `apps/server/src/modules/user/user.module.ts`
- Create: `apps/server/src/modules/user/user.controller.ts`
- Create: `apps/server/src/modules/user/user.service.ts`
- Create: `apps/server/src/modules/user/dto/update-user.dto.ts`

**核心实现要点:**

1. `GET /api/users`: 分页查询用户列表（Admin only）
2. `PATCH /api/users/:id`: 修改用户角色/启用状态（Admin only）
3. `DELETE /api/users/:id`: 删除用户，不允许删除自己（Admin only）

**Step 1: 实现 UserService**

查询用户列表时排除 password 字段，支持分页和搜索。

**Step 2: 实现 UserController**

所有端点添加 `@Roles('ADMIN')`。

**Step 3: 注册到 AppModule 并测试**

**Step 4: 提交**

```bash
git add apps/server/src/modules/user/
git commit -m "feat: add user management module (admin only)"
```

---

### Task 8: 模型供应商 & 模型管理模块 (Model)

**Files:**
- Create: `apps/server/src/modules/model/model.module.ts`
- Create: `apps/server/src/modules/model/model-provider.controller.ts`
- Create: `apps/server/src/modules/model/model-provider.service.ts`
- Create: `apps/server/src/modules/model/model.controller.ts`
- Create: `apps/server/src/modules/model/model.service.ts`
- Create: `apps/server/src/modules/model/dto/*.dto.ts`

**核心实现要点:**

1. ModelProvider CRUD — Admin only，API Key 存储时加密（或至少 GET 响应中脱敏显示）
2. Model CRUD — Admin only，创建时关联到 Provider
3. `GET /api/models` — Operator+ 可用，用于创建任务时选择模型
4. 返回 ModelProvider 列表时附带 modelCount

**Step 1-4: 实现 Service、Controller、DTO，注册模块并测试**

**Step 5: 提交**

```bash
git add apps/server/src/modules/model/
git commit -m "feat: add model provider and model management module"
```

---

### Task 9: OSS 存储管理模块 (Storage)

**Files:**
- Create: `apps/server/src/modules/storage/storage.module.ts`
- Create: `apps/server/src/modules/storage/oss-config.controller.ts`
- Create: `apps/server/src/modules/storage/oss-config.service.ts`
- Create: `apps/server/src/modules/storage/oss-bucket.controller.ts`
- Create: `apps/server/src/modules/storage/oss-bucket.service.ts`
- Create: `apps/server/src/modules/storage/oss.service.ts` (阿里云 OSS SDK 封装)
- Create: `apps/server/src/modules/storage/dto/*.dto.ts`

**核心实现要点:**

1. OssConfig CRUD — Admin only，accessKeyId/accessKeySecret 脱敏
2. OssBucket CRUD — Admin only，设置默认 Bucket
3. `OssService` 封装：
   - `generateStsToken(configId, bucketName)`: 生成临时上传凭证
   - `getSignedUrl(configId, bucketName, key)`: 生成签名下载 URL
   - `deleteObject(configId, bucketName, key)`: 删除 OSS 对象
   - 内部通过 configId 从数据库读取 accessKey 配置，创建 OSS Client

**Step 1-4: 实现各 Service/Controller/DTO**

**Step 5: 提交**

```bash
git add apps/server/src/modules/storage/
git commit -m "feat: add OSS storage management module with STS token generation"
```

---

### Task 10: 视频管理模块 (Video)

**Files:**
- Create: `apps/server/src/modules/video/video.module.ts`
- Create: `apps/server/src/modules/video/video.controller.ts`
- Create: `apps/server/src/modules/video/video.service.ts`
- Create: `apps/server/src/modules/video/dto/*.dto.ts`

**核心实现要点:**

1. `GET /api/videos` — 所有角色可访问，分页+搜索，返回每个视频是否已有报告（left join reports）
2. `POST /api/videos/upload-token` — Operator+，调用 OssService.generateStsToken()
3. `POST /api/videos/complete` — Operator+，前端上传完成后回调，创建 Video 记录
4. `GET /api/videos/:id` — 详情，包含关联的报告列表
5. `DELETE /api/videos/:id` — Operator+，同时删除 OSS 对象和数据库记录
6. `GET /api/videos/:id/download-url` — 调用 OssService.getSignedUrl() 返回临时下载 URL

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/server/src/modules/video/
git commit -m "feat: add video management module with OSS upload/download"
```

---

### Task 11: Skills 管理模块 (Skill)

**Files:**
- Create: `apps/server/src/modules/skill/skill.module.ts`
- Create: `apps/server/src/modules/skill/skill.controller.ts`
- Create: `apps/server/src/modules/skill/skill.service.ts`
- Create: `apps/server/src/modules/skill/dto/*.dto.ts`

**核心实现要点:**

1. CRUD — Operator+（删除仅 Admin）
2. **版本管理**: `PATCH /api/skills/:id` 更新时：
   - 读取当前 skill
   - 将当前 content 存入 SkillVersion（版本号 = 当前 version）
   - 更新 skill 的 content 和 version（+1）
3. `GET /api/skills/:id/versions` — 返回历史版本列表
4. `GET /api/skills/:id/versions/:versionId` — 返回某一历史版本详情

**Step 1-4: 实现各组件，特别注意版本归档的事务操作**

使用 Prisma `$transaction` 确保归档和更新的原子性：

```typescript
async updateSkill(id: string, dto: UpdateSkillDto) {
  return this.prisma.$transaction(async (tx) => {
    const current = await tx.skill.findUniqueOrThrow({ where: { id } });

    // 归档当前版本
    if (dto.content && dto.content !== current.content) {
      await tx.skillVersion.create({
        data: {
          skillId: id,
          version: current.version,
          content: current.content,
        },
      });
    }

    return tx.skill.update({
      where: { id },
      data: {
        ...dto,
        version: dto.content ? current.version + 1 : current.version,
      },
    });
  });
}
```

**Step 5: 提交**

```bash
git add apps/server/src/modules/skill/
git commit -m "feat: add skills management module with version archiving"
```

---

### Task 12: 报告管理模块 (Report)

**Files:**
- Create: `apps/server/src/modules/report/report.module.ts`
- Create: `apps/server/src/modules/report/report.controller.ts`
- Create: `apps/server/src/modules/report/report.service.ts`
- Create: `apps/server/src/modules/report/dto/*.dto.ts`

**核心实现要点:**

1. `GET /api/videos/:videoId/reports` — 返回该视频的最新报告
2. `GET /api/reports/:id` — 报告详情
3. `GET /api/reports/:id/versions` — 历史版本列表
4. `GET /api/reports/:id/versions/:versionId` — 某一历史版本详情
5. `POST /api/reports/:id/revise` — 修复报告（Operator+）
   - 接收 `{ additionalRequirements: string }`
   - 入 Bull 队列处理（复用 Task 12 的处理器逻辑）
6. **内部方法** `createOrUpdateReport(videoId, content, skillId, modelId, prompt?)`:
   - 供任务处理器和报告修复共用
   - 实现版本归档逻辑（同 Skill 的模式）

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/server/src/modules/report/
git commit -m "feat: add report management module with version history"
```

---

### Task 13: GLM API 客户端

**Files:**
- Create: `apps/server/src/modules/llm/llm.module.ts`
- Create: `apps/server/src/modules/llm/llm.service.ts`

**核心实现要点:**

```typescript
// llm.service.ts
@Injectable()
export class LlmService {
  constructor(private prisma: PrismaService) {}

  async analyzeVideo(params: {
    modelId: string;
    videoUrl: string;
    prompt: string;
  }): Promise<string> {
    // 1. 从数据库读取 Model + Provider 配置
    const model = await this.prisma.model.findUniqueOrThrow({
      where: { id: params.modelId },
      include: { provider: true },
    });

    // 2. 构造请求体
    const body = {
      model: model.name,
      messages: [{
        role: 'user',
        content: [
          { type: 'video_url', video_url: { url: params.videoUrl } },
          { type: 'text', text: params.prompt },
        ],
      }],
      thinking: { type: 'enabled' },
    };

    // 3. 调用 API
    const response = await fetch(
      `${model.provider.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${model.provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

**Step 1-2: 实现 LlmService 和 LlmModule**

**Step 3: 提交**

```bash
git add apps/server/src/modules/llm/
git commit -m "feat: add LLM service for GLM API video analysis"
```

---

### Task 14: 任务队列与处理器 (Task + Bull)

**Files:**
- Create: `apps/server/src/modules/task/task.module.ts`
- Create: `apps/server/src/modules/task/task.controller.ts`
- Create: `apps/server/src/modules/task/task.service.ts`
- Create: `apps/server/src/modules/task/task.processor.ts`
- Create: `apps/server/src/modules/task/dto/*.dto.ts`

**核心实现要点:**

1. **TaskController**:
   - `POST /api/tasks`: 创建任务 → 创建 Task + TaskVideo 记录 → 入 Bull 队列
   - `GET /api/tasks`: 任务列表
   - `GET /api/tasks/:id`: 任务详情（含各视频状态）
   - `DELETE /api/tasks/:id`: 取消任务

2. **TaskProcessor** (Bull Processor):

```typescript
@Processor('video-analysis')
export class TaskProcessor {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private reportService: ReportService,
    private notificationGateway: NotificationGateway,
  ) {}

  @Process('analyze')
  async handleAnalysis(job: Job<{ taskId: string }>) {
    const { taskId } = job.data;

    // 更新任务状态为 PROCESSING
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        taskVideos: { include: { video: true } },
        skill: true,
      },
    });

    let completed = 0;
    let failed = 0;
    const total = task.taskVideos.length;

    for (const taskVideo of task.taskVideos) {
      try {
        // 更新单视频状态
        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: { status: 'PROCESSING', startedAt: new Date() },
        });

        // 推送进度
        this.notificationGateway.emitTaskProgress({
          taskId,
          progress: Math.round((completed / total) * 100),
          currentVideoId: taskVideo.videoId,
          currentVideoTitle: taskVideo.video.title,
        });

        // 调用 LLM 分析
        const content = await this.llmService.analyzeVideo({
          modelId: task.modelId,
          videoUrl: taskVideo.video.ossUrl,
          prompt: task.skill.content,
        });

        // 创建/更新报告
        const report = await this.reportService.createOrUpdateReport({
          videoId: taskVideo.videoId,
          content,
          skillId: task.skillId,
          modelId: task.modelId,
        });

        // 更新 TaskVideo
        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: {
            status: 'COMPLETED',
            reportId: report.id,
            completedAt: new Date(),
          },
        });

        completed++;
        this.notificationGateway.emitTaskVideoCompleted({
          taskId,
          taskVideoId: taskVideo.id,
          videoId: taskVideo.videoId,
          reportId: report.id,
        });

      } catch (error) {
        failed++;
        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: {
            status: 'FAILED',
            error: error.message,
            completedAt: new Date(),
          },
        });

        this.notificationGateway.emitTaskVideoFailed({
          taskId,
          taskVideoId: taskVideo.id,
          videoId: taskVideo.videoId,
          error: error.message,
        });
      }
    }

    // 更新任务最终状态
    const finalStatus = failed === total ? 'FAILED'
      : failed > 0 ? 'PARTIAL'
      : 'COMPLETED';

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        progress: 100,
        completedAt: new Date(),
      },
    });

    this.notificationGateway.emitTaskCompleted(taskId);
  }
}
```

3. **Bull 模块注册**:

```typescript
BullModule.forRoot({
  redis: { host: 'localhost', port: 6379 },
}),
BullModule.registerQueue({ name: 'video-analysis' }),
```

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/server/src/modules/task/
git commit -m "feat: add task management with Bull queue processor"
```

---

### Task 15: WebSocket 通知模块 (Notification)

**Files:**
- Create: `apps/server/src/modules/notification/notification.module.ts`
- Create: `apps/server/src/modules/notification/notification.gateway.ts`

**核心实现要点:**

```typescript
@WebSocketGateway({ cors: { origin: 'http://localhost:3000' } })
export class NotificationGateway {
  @WebSocketServer() server: Server;

  // 客户端连接时加入以 userId 命名的 room，便于精准推送
  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    if (userId) client.join(`user:${userId}`);
  }

  emitTaskProgress(payload: TaskProgressPayload) {
    this.server.emit(`task:progress:${payload.taskId}`, payload);
  }

  emitTaskVideoCompleted(payload: TaskVideoCompletedPayload) {
    this.server.emit(`task:video:completed:${payload.taskId}`, payload);
  }

  emitTaskVideoFailed(payload: TaskVideoFailedPayload) {
    this.server.emit(`task:video:failed:${payload.taskId}`, payload);
  }

  emitTaskCompleted(taskId: string) {
    this.server.emit(`task:completed:${taskId}`, { taskId });
  }
}
```

**Step 1-2: 实现 Gateway 和 Module**

**Step 3: 在 AppModule 注册，启动测试 WebSocket 连接**

**Step 4: 提交**

```bash
git add apps/server/src/modules/notification/
git commit -m "feat: add WebSocket notification gateway for task progress"
```

---

### Task 16: 后端集成测试与完善

**Step 1: 在 AppModule 中注册所有模块**

确保 AppModule imports 包含：
- AppConfigModule
- PrismaModule
- BullModule.forRoot(...)
- AuthModule
- UserModule
- ModelModule
- StorageModule
- VideoModule
- SkillModule
- ReportModule
- TaskModule (含 BullModule.registerQueue)
- LlmModule
- NotificationModule

**Step 2: 完整启动测试**

```bash
cd apps/server && pnpm start:dev
```

**Step 3: 用 curl 测试核心流程**

1. 登录获取 token
2. 创建 ModelProvider + Model
3. 创建 OssConfig + Bucket
4. 创建 Skill
5. 获取上传 token（模拟视频上传完成）
6. 创建解析任务

**Step 4: 提交**

```bash
git commit -am "feat: integrate all backend modules"
```

---

## Phase 3: 前端实现

### Task 17: Next.js 应用初始化

**Files:**
- Create: `apps/web/` (通过 create-next-app 生成)

**Step 1: 创建 Next.js 应用**

```bash
cd apps && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

**Step 2: 安装依赖**

```bash
cd apps/web
pnpm add @tanstack/react-query zustand socket.io-client ali-oss
pnpm add react-hook-form @hookform/resolvers zod
pnpm add react-markdown remark-gfm
pnpm add lucide-react
pnpm add -D @types/ali-oss
```

**Step 3: 添加共享包依赖**

```json
"dependencies": {
  "@repo/shared": "workspace:*"
}
```

**Step 4: 初始化 shadcn/ui**

```bash
npx shadcn@latest init
```

选择: New York 风格, Zinc 颜色, CSS variables: yes

**Step 5: 安装常用 shadcn 组件**

```bash
npx shadcn@latest add button card input label select table dialog sheet
npx shadcn@latest add dropdown-menu avatar badge separator tabs textarea
npx shadcn@latest add toast form command popover progress
npx shadcn@latest add sidebar breadcrumb
```

**Step 6: 提交**

```bash
git add apps/web/
git commit -m "feat: initialize Next.js app with shadcn/ui and dependencies"
```

---

### Task 18: 前端基础架构（API Client、Auth、Layout）

**Files:**
- Create: `apps/web/src/lib/api-client.ts` (封装 fetch + JWT 拦截)
- Create: `apps/web/src/lib/socket.ts` (Socket.IO client)
- Create: `apps/web/src/stores/auth-store.ts` (Zustand auth 状态)
- Create: `apps/web/src/hooks/use-auth.ts`
- Create: `apps/web/src/app/providers.tsx` (TanStack Query + Auth Provider)
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx` (侧边栏+面包屑)
- Create: `apps/web/src/components/sidebar-nav.tsx`

**核心实现要点:**

1. **api-client.ts**: 封装 fetch，自动附加 JWT header，401 时自动刷新 token 或跳转登录
2. **auth-store.ts**: Zustand store 管理 accessToken、refreshToken、user 信息，持久化到 localStorage
3. **Login 页面**: 邮箱+密码表单，登录后跳转 /dashboard
4. **Dashboard Layout**: 左侧 sidebar（根据角色动态显示菜单项）+ 顶部 header + 面包屑
5. **sidebar 菜单项**:
   - 仪表盘 (全部角色)
   - 视频管理 (全部角色)
   - 解析任务 (Operator+)
   - Skills 管理 (Operator+)
   - 报告 (全部角色)
   - 设置 → 模型管理 / 存储管理 / 用户管理 (Admin)

**Step 1-5: 逐个实现上述组件**

**Step 6: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add frontend auth, API client, and dashboard layout"
```

---

### Task 19: 视频管理页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/videos/page.tsx` (视频列表)
- Create: `apps/web/src/app/(dashboard)/videos/[id]/page.tsx` (视频详情)
- Create: `apps/web/src/components/video/video-table.tsx`
- Create: `apps/web/src/components/video/video-upload-dialog.tsx`
- Create: `apps/web/src/components/video/video-upload-progress.tsx`
- Create: `apps/web/src/hooks/use-oss-upload.ts` (ali-oss 断点续传 hook)

**核心实现要点:**

1. **视频列表页**: DataTable（TanStack Table）展示视频，支持搜索、分页、批量选择
2. **上传对话框**: 拖拽上传区域 → 调用 upload-token API → 使用 ali-oss SDK multipartUpload 直传 → 进度条 → complete 回调
3. **断点续传 Hook**: 保存 checkpoint 到 localStorage，网络恢复后自动续传
4. **视频详情页**: 显示视频信息 + 关联报告列表（最新+历史）
5. **操作按钮**: 下载（调用 download-url API）、删除（确认对话框）、查看报告

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add video management pages with OSS multipart upload"
```

---

### Task 20: Skills 管理页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/skills/page.tsx`
- Create: `apps/web/src/app/(dashboard)/skills/[id]/page.tsx`
- Create: `apps/web/src/components/skill/skill-table.tsx`
- Create: `apps/web/src/components/skill/skill-editor.tsx`
- Create: `apps/web/src/components/skill/skill-version-list.tsx`

**核心实现要点:**

1. **Skill 列表页**: 名称、描述、版本号、状态、操作
2. **Skill 编辑页**: 大文本区域编辑 content（Markdown），保存时自动版本归档
3. **版本历史**: 侧边面板显示历史版本列表，点击查看某版本内容
4. **创建 Skill**: Dialog 表单 — name、description、content

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add skills management pages with version history"
```

---

### Task 21: 解析任务页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/tasks/page.tsx`
- Create: `apps/web/src/app/(dashboard)/tasks/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/tasks/[id]/page.tsx`
- Create: `apps/web/src/components/task/task-table.tsx`
- Create: `apps/web/src/components/task/create-task-stepper.tsx`
- Create: `apps/web/src/components/task/task-progress.tsx`
- Create: `apps/web/src/hooks/use-task-socket.ts`

**核心实现要点:**

1. **任务列表页**: 名称、状态 Badge、进度条、视频数量、创建时间
2. **创建任务页 (Stepper)**:
   - Step 1: 从视频列表中勾选视频（可搜索、分页、全选）
   - Step 2: 选择 Skill（下拉 / 列表选择）
   - Step 3: 选择模型（默认 GLM-4.6V）
   - Step 4: 确认摘要并提交
3. **任务详情页**:
   - 整体进度条
   - 各视频状态表格（等待/进行中动画/成功✓/失败✗）
   - WebSocket 实时更新进度和状态
   - 完成的视频显示"查看报告"链接
4. **use-task-socket.ts**: 连接 Socket.IO，监听 `task:progress:${taskId}` 等事件

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add task management pages with real-time progress"
```

---

### Task 22: 报告查看与修复页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/reports/[id]/page.tsx`
- Create: `apps/web/src/app/(dashboard)/reports/[id]/revise/page.tsx`
- Create: `apps/web/src/components/report/report-viewer.tsx`
- Create: `apps/web/src/components/report/report-version-selector.tsx`
- Create: `apps/web/src/components/report/revise-dialog.tsx`

**核心实现要点:**

1. **报告查看页**:
   - react-markdown 渲染 Markdown 报告（支持 GFM 表格等）
   - 版本切换下拉（v1, v2, ...），切换时加载对应版本内容
   - "修复报告"按钮
2. **报告修复**:
   - Dialog 或独立页面，包含一个大文本区域输入"额外的分析和要求"
   - 提交后调用 `POST /api/reports/:id/revise`
   - 提交后跳转到任务详情（复用任务进度显示）或弹出"处理中"提示
3. **视频详情页集成**: 在视频详情页直接嵌入最新报告查看

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add report viewing and revision pages"
```

---

### Task 23: Settings 管理页面 (Admin)

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/models/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/storage/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/users/page.tsx`
- Create: `apps/web/src/components/settings/model-provider-table.tsx`
- Create: `apps/web/src/components/settings/model-table.tsx`
- Create: `apps/web/src/components/settings/oss-config-table.tsx`
- Create: `apps/web/src/components/settings/oss-bucket-table.tsx`
- Create: `apps/web/src/components/settings/user-table.tsx`

**核心实现要点:**

1. **模型管理页**: 供应商列表 + 展开查看其下模型，CRUD Dialog，API Key 脱敏显示
2. **存储管理页**: OSS 配置列表 + Bucket 管理，设置默认 Bucket
3. **用户管理页**: 用户列表，修改角色下拉，启用/禁用开关，创建用户 Dialog
4. 所有页面添加 Admin 角色守卫（前端路由级别 + 后端 API 级别双重保护）

**Step 1-4: 实现各组件**

**Step 5: 提交**

```bash
git add apps/web/src/
git commit -m "feat: add admin settings pages (models, storage, users)"
```

---

### Task 24: Dashboard 仪表盘

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/stats-cards.tsx`
- Create: `apps/web/src/components/dashboard/recent-tasks.tsx`
- Create: `apps/web/src/components/dashboard/recent-reports.tsx`

**核心实现要点:**

1. **统计卡片**: 视频总数、任务总数、报告总数、活跃 Skills 数
2. **最近任务**: 最近 5 个任务的状态和进度
3. **最近报告**: 最近生成/更新的 5 个报告
4. 后端添加 `GET /api/dashboard/stats` 聚合查询接口

**Step 1-3: 实现组件和后端接口**

**Step 4: 提交**

```bash
git add .
git commit -m "feat: add dashboard page with stats and recent activity"
```

---

## Phase 4: UI 打磨与收尾

### Task 25: UI/UX 打磨

使用 `@ui-ux-pro-max` skill 对整体 UI 进行打磨：

1. 调整色彩方案和主题
2. 深色/浅色模式切换
3. 响应式布局适配
4. Loading 状态和 skeleton
5. 空状态占位
6. 错误状态处理
7. 过渡动画

**Step 1: 调用 ui-ux-pro-max skill 获取设计指导**

**Step 2: 逐页面应用设计改进**

**Step 3: 提交**

```bash
git commit -am "style: polish UI with ui-ux-pro-max design system"
```

---

### Task 26: 端到端集成测试

**Step 1: 确保 Docker 服务运行**

```bash
docker compose up -d
```

**Step 2: 启动后端**

```bash
cd apps/server && pnpm start:dev
```

**Step 3: 启动前端**

```bash
cd apps/web && pnpm dev
```

**Step 4: 完整流程测试**

1. 登录 admin 账号
2. 设置 → 创建模型供应商（智谱AI）+ 创建模型（glm-4.6v）
3. 设置 → 创建 OSS 配置 + 创建 Bucket
4. Skills → 创建一个视频分析 Skill
5. 视频 → 上传测试视频 → 验证断点续传
6. 任务 → 创建解析任务 → 验证实时进度
7. 报告 → 查看生成的报告 → 测试报告修复
8. 验证角色权限（创建 Operator 和 User 账号分别测试）

**Step 5: 修复发现的问题并提交**

```bash
git commit -am "fix: resolve integration issues found during E2E testing"
```
