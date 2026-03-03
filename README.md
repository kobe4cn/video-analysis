# 小红书视频分析平台

基于 AI 大模型的视频内容分析平台，支持批量上传视频至阿里云 OSS，通过 GLM 多模态模型自动分析视频内容，生成结构化的分析报告。

## 技术栈

| 层级 | 技术 |
|------|------|
| **Monorepo** | pnpm Workspace + Turborepo |
| **后端** | NestJS 11 · TypeScript · Prisma 6 |
| **前端** | Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui |
| **数据库** | PostgreSQL 16 |
| **队列** | Bull + Redis 7 |
| **存储** | 阿里云 OSS (ali-oss SDK) |
| **AI** | 智谱 GLM 系列多模态模型 |
| **实时通信** | Socket.io (WebSocket) |
| **认证** | JWT 双令牌 (Access + Refresh) |

## 项目结构

```
xiaohongshuvideo/
├── apps/
│   ├── server/              # NestJS 后端
│   │   └── src/modules/
│   │       ├── auth/        # 认证 & 授权（JWT、角色守卫）
│   │       ├── user/        # 用户管理
│   │       ├── video/       # 视频上传 & 管理
│   │       ├── storage/     # 阿里云 OSS 配置 & Bucket 管理
│   │       ├── model/       # AI 模型 & Provider 管理
│   │       ├── skill/       # 分析 Prompt 模板（版本管理）
│   │       ├── task/        # 解析任务调度（Bull 队列）
│   │       ├── llm/         # GLM API 调用
│   │       ├── report/      # 分析报告（版本管理）
│   │       ├── notification/# WebSocket 实时通知
│   │       └── dashboard/   # 仪表盘统计
│   └── web/                 # Next.js 前端
│       └── src/
│           ├── app/         # App Router 页面
│           ├── components/  # UI 组件（shadcn/ui）
│           ├── lib/         # API 客户端、工具函数
│           └── stores/      # Zustand 状态管理
├── packages/
│   └── shared/              # 共享类型 & 常量
├── prisma/                  # Schema、迁移、Seed
├── docker-compose.yml       # PostgreSQL + Redis
└── turbo.json               # Turborepo 配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- Docker / Podman（用于 PostgreSQL 和 Redis）

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd xiaohongshuvideo
pnpm install
```

### 2. 启动基础设施

```bash
docker compose up -d
```

这将启动 PostgreSQL（端口 5432）和 Redis（端口 6379）。

### 3. 配置环境变量

```bash
cp .env.example .env
```

根据实际情况修改 `.env`：

```env
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/video_analysis?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT（生产环境务必更换为随机字符串）
JWT_SECRET=your-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

### 4. 初始化数据库

```bash
pnpm db:generate    # 生成 Prisma Client
pnpm db:push        # 同步 Schema 到数据库
pnpm db:seed        # 创建默认管理员账户
```

Seed 会创建默认管理员：
- 邮箱：`admin@example.com`
- 密码：`admin123`

### 5. 启动开发服务

```bash
pnpm dev
```

- 后端：http://localhost:3001（API 前缀 `/api`）
- 前端：http://localhost:3000

## 核心功能

### 视频管理

- 支持多视频同时上传，通过后端中转写入阿里云 OSS
- 选择目标 Bucket，支持中文文件名
- 视频列表搜索、分页

### 解析任务

- 选择视频 + Skill + AI 模型，创建批量分析任务
- Bull 队列异步处理，逐视频分析，单个失败不阻塞其他
- WebSocket 实时推送任务进度
- 任务状态：PENDING → PROCESSING → COMPLETED / PARTIAL / FAILED

### AI 分析

- 通过 GLM 多模态模型理解视频内容
- Skill 模块管理分析 Prompt 模板，支持版本管理
- 分析结果生成 Markdown 格式的结构化报告

### 报告

- 报告支持版本管理，可查看历史版本对比
- Markdown 渲染展示，支持表格、引用、分区标题
- 支持提交修复要求重新分析

### 存储管理（Admin）

- 管理阿里云 OSS 配置（AK/SK、Region）
- 创建 / 关联 / 删除 Bucket，真实操作阿里云
- 支持查看阿里云远程 Bucket 并一键关联

### 模型管理（Admin）

- 管理 AI 模型 Provider（API 地址、密钥）
- 管理具体模型（名称、启用状态）

### 用户管理（Admin）

- 创建用户并分配角色
- 角色变更、账户启用/禁用、删除

## 角色权限

| 功能 | ADMIN | OPERATOR | USER |
|------|:-----:|:--------:|:----:|
| 仪表盘（全部指标） | ✅ | ✅ | - |
| 仪表盘（基础指标） | ✅ | ✅ | ✅ |
| 视频上传 & 管理 | ✅ | ✅ | ✅ |
| 创建解析任务 | ✅ | ✅ | - |
| Skills 管理 | ✅ | ✅ | - |
| 查看报告 | ✅ | ✅ | ✅ |
| 修复报告 | ✅ | ✅ | - |
| 模型管理 | ✅ | - | - |
| 存储管理 | ✅ | - | - |
| 用户管理 | ✅ | - | - |

## 常用脚本

```bash
# 开发
pnpm dev                      # 启动前后端开发服务
pnpm build                    # 构建所有应用

# 仅操作单个应用
pnpm --filter server dev      # 仅启动后端
pnpm --filter web dev         # 仅启动前端
pnpm --filter server build    # 仅构建后端
pnpm --filter web build       # 仅构建前端

# 数据库
pnpm db:generate              # 生成 Prisma Client
pnpm db:migrate               # 运行数据库迁移
pnpm db:push                  # 同步 Schema（开发用）
pnpm db:seed                  # 填充初始数据
```

## 任务处理流程

```
用户创建任务
    │
    ▼
┌─────────────────────────────┐
│  Prisma 事务                │
│  ① 创建 Task 记录           │
│  ② 创建 TaskVideo 关联记录  │
└─────────────────────────────┘
    │
    ▼
Bull Queue 入队 ──────────────── 控制器立即返回
    │
    ▼
TaskProcessor 消费
    │
    ├──▶ 视频 1 ──▶ LLM 分析 ──▶ 生成 Report ──▶ WebSocket 通知
    ├──▶ 视频 2 ──▶ LLM 分析 ──▶ 生成 Report ──▶ WebSocket 通知
    └──▶ 视频 N ──▶ ...
    │
    ▼
更新 Task 最终状态（COMPLETED / PARTIAL / FAILED）
```

## 数据模型

```
User ──────────┬──▶ Video ◀── OssBucket ◀── OssConfig
               │      │
               │      ├──▶ Report ──▶ ReportVersion
               │      │
               ├──▶ Task ──▶ TaskVideo ──┘
               │      │
               │      ├──▶ Model ◀── ModelProvider
               │      │
               └──▶ Skill ──▶ SkillVersion
```
