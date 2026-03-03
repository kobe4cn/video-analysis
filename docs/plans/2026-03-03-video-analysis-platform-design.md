# 视频解析平台系统设计文档

## 1. 项目概述

基于 LLM（GLM-4.6V）的视频解析平台，支持视频上传到阿里云 OSS、批量视频解析任务、报告生成与版本管理、Skills 管理，以及多角色权限控制。

## 2. 技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 仓库结构 | Monorepo (Turborepo + pnpm) | 前后端共享类型定义，统一版本管理 |
| 前端框架 | Next.js 15 (App Router) | 现代 React 框架，SSR/CSR 灵活切换 |
| UI 组件库 | shadcn/ui + Tailwind CSS | 高度可定制，设计质量高 |
| 状态管理 | Zustand | 轻量级，API 简洁 |
| 前端请求 | TanStack Query + fetch | 缓存、重试、乐观更新 |
| 后端框架 | NestJS | 模块化架构，适合多模块管理系统 |
| ORM | Prisma | 类型安全，迁移工具优秀 |
| 数据库 | PostgreSQL | 可靠的关系型数据库 |
| 任务队列 | Bull + Redis | 支持重试、并发控制、进度跟踪 |
| 实时通信 | WebSocket (Socket.IO) | 任务进度实时推送 |
| 认证 | JWT (access + refresh token) | 无状态认证，前后端分离标配 |
| 文件存储 | 阿里云 OSS (ali-oss SDK) | 需求指定，支持断点续传 |
| 包管理 | pnpm + Turborepo | 高效的 Monorepo 管理 |

## 3. 项目结构

```
xiaohongshuvideo/
├── apps/
│   ├── web/                      # Next.js 15 前端
│   │   ├── src/
│   │   │   ├── app/              # App Router 页面
│   │   │   │   ├── (auth)/       # 登录/注册页面（无布局）
│   │   │   │   ├── (dashboard)/  # 主系统布局
│   │   │   │   │   ├── videos/        # 视频管理
│   │   │   │   │   ├── tasks/         # 解析任务
│   │   │   │   │   ├── skills/        # Skills 管理
│   │   │   │   │   ├── models/        # 模型管理
│   │   │   │   │   ├── storage/       # 对象存储管理
│   │   │   │   │   ├── reports/       # 报告查看
│   │   │   │   │   └── settings/      # 系统设置
│   │   │   ├── components/       # 通用组件
│   │   │   ├── hooks/            # 自定义 Hooks
│   │   │   ├── lib/              # 工具函数、API client
│   │   │   └── stores/           # Zustand 状态管理
│   │   └── package.json
│   │
│   └── server/                   # NestJS 后端
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/         # 认证模块（JWT）
│       │   │   ├── user/         # 用户管理
│       │   │   ├── model/        # 模型供应商 & 模型管理
│       │   │   ├── storage/      # OSS 对象存储管理
│       │   │   ├── video/        # 视频管理（上传/删除/查看）
│       │   │   ├── task/         # 解析任务管理
│       │   │   ├── skill/        # Skills 管理
│       │   │   ├── report/       # 报告管理（版本/归档）
│       │   │   └── notification/ # WebSocket 实时通知
│       │   ├── common/           # 通用装饰器、Guard、拦截器
│       │   ├── config/           # 配置模块
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   └── shared/                   # 共享包
│       ├── types/                # API 类型定义
│       ├── constants/            # 共享常量（角色、状态枚举）
│       └── utils/                # 通用工具函数
│
├── prisma/
│   ├── schema.prisma             # 数据库 Schema
│   └── migrations/               # 数据库迁移
│
├── docker-compose.yml            # PostgreSQL + Redis
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## 4. 数据库设计

### 4.1 ER 关系

```
User ──1:N──> Video
User ──1:N──> Task
Task ──N:M──> Video (通过 TaskVideo)
Task ──N:1──> Skill
Video ──1:N──> Report
Report ──1:N──> ReportVersion
ModelProvider ──1:N──> Model
OssConfig ──1:N──> OssBucket
Skill ──1:N──> SkillVersion
```

### 4.2 Prisma Schema

```prisma
// ========== 用户与权限 ==========

enum Role {
  ADMIN
  OPERATOR
  USER
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(USER)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  videos Video[]
  tasks  Task[]
  skills Skill[]
}

// ========== 模型管理 ==========

model ModelProvider {
  id        String   @id @default(cuid())
  name      String
  baseUrl   String
  apiKey    String
  isActive  Boolean  @default(true)
  models    Model[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Model {
  id          String        @id @default(cuid())
  name        String
  displayName String
  providerId  String
  provider    ModelProvider  @relation(fields: [providerId], references: [id])
  isActive    Boolean       @default(true)
  config      Json?
  tasks       Task[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

// ========== OSS 存储管理 ==========

model OssConfig {
  id              String      @id @default(cuid())
  name            String
  provider        String      @default("aliyun")
  region          String
  accessKeyId     String
  accessKeySecret String
  buckets         OssBucket[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model OssBucket {
  id          String    @id @default(cuid())
  name        String
  ossConfigId String
  ossConfig   OssConfig @relation(fields: [ossConfigId], references: [id])
  isDefault   Boolean   @default(false)
  videos      Video[]
  createdAt   DateTime  @default(now())
}

// ========== 视频管理 ==========

model Video {
  id         String      @id @default(cuid())
  title      String
  fileName   String
  ossKey     String
  ossUrl     String
  fileSize   BigInt
  duration   Int?
  bucketId   String
  bucket     OssBucket   @relation(fields: [bucketId], references: [id])
  uploadedBy String
  user       User        @relation(fields: [uploadedBy], references: [id])
  taskVideos TaskVideo[]
  reports    Report[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

// ========== 解析任务管理 ==========

enum TaskStatus {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
}

enum TaskVideoStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Task {
  id          String     @id @default(cuid())
  name        String
  status      TaskStatus @default(PENDING)
  skillId     String
  skill       Skill      @relation(fields: [skillId], references: [id])
  modelId     String
  model       Model      @relation(fields: [modelId], references: [id])
  createdBy   String
  user        User       @relation(fields: [createdBy], references: [id])
  taskVideos  TaskVideo[]
  progress    Int        @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model TaskVideo {
  id          String          @id @default(cuid())
  taskId      String
  task        Task            @relation(fields: [taskId], references: [id])
  videoId     String
  video       Video           @relation(fields: [videoId], references: [id])
  status      TaskVideoStatus @default(PENDING)
  reportId    String?         @unique
  report      Report?         @relation(fields: [reportId], references: [id])
  error       String?
  startedAt   DateTime?
  completedAt DateTime?
}

// ========== 报告与版本管理 ==========

model Report {
  id         String          @id @default(cuid())
  videoId    String
  video      Video           @relation(fields: [videoId], references: [id])
  content    String
  version    Int             @default(1)
  versions   ReportVersion[]
  taskVideo  TaskVideo?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
}

model ReportVersion {
  id        String   @id @default(cuid())
  reportId  String
  report    Report   @relation(fields: [reportId], references: [id])
  version   Int
  content   String
  skillId   String?
  modelId   String?
  prompt    String?
  createdAt DateTime @default(now())
}

// ========== Skills 管理 ==========

model Skill {
  id          String         @id @default(cuid())
  name        String
  description String?
  content     String
  version     Int            @default(1)
  versions    SkillVersion[]
  isActive    Boolean        @default(true)
  createdBy   String
  user        User           @relation(fields: [createdBy], references: [id])
  tasks       Task[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model SkillVersion {
  id        String   @id @default(cuid())
  skillId   String
  skill     Skill    @relation(fields: [skillId], references: [id])
  version   Int
  content   String
  createdAt DateTime @default(now())
}
```

### 4.3 权限矩阵

| 功能 | Admin | Operator | User |
|------|-------|----------|------|
| 模型管理（CRUD） | ✅ | ❌ | ❌ |
| OSS 存储管理 | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ |
| 视频上传/删除 | ✅ | ✅ | ❌ |
| 视频查看/下载 | ✅ | ✅ | ✅ |
| 创建解析任务 | ✅ | ✅ | ❌ |
| 报告生成/修复 | ✅ | ✅ | ❌ |
| Skills 管理 | ✅ | ✅ | ❌ |
| 查看报告 | ✅ | ✅ | ✅ |

## 5. 核心业务流程

### 5.1 视频上传流程（断点续传到阿里云 OSS）

```
前端                          后端 (NestJS)                  阿里云 OSS
 │                              │                              │
 ├─ 选择文件 ─────────────────►│                              │
 │                              │                              │
 ├─ POST /api/videos/upload     │                              │
 │   -token ───────────────────►├─ 生成 STS 临时凭证 ─────────►│
 │                              │                              │
 │◄─ 返回上传凭证 + uploadId ──┤                              │
 │                              │                              │
 ├─ 分片上传（前端直传 OSS）───────────────────────────────────►│
 │  使用 ali-oss SDK            │                              │
 │  multipartUpload             │                              │
 │                              │                              │
 │  [网络中断 → 保存 checkpoint 到 localStorage]               │
 │  [恢复后继续上传]                                           │
 │                              │                              │
 ├─ POST /api/videos/complete   │                              │
 │   (ossKey, fileSize) ───────►├─ 验证文件 → 创建 Video 记录  │
 │◄─ 返回 Video 信息 ──────────┤                              │
```

关键设计点：
- 前端使用阿里云 OSS JS SDK 的 multipartUpload 直传，不经过后端中转
- 后端通过 STS 生成临时上传凭证，控制权限范围
- 断点续传：前端保存 checkpoint 到 localStorage

### 5.2 视频解析任务流程

```
前端                   后端 API               Bull 队列              GLM API
 │                       │                       │                      │
 ├─ 选择视频+Skill+模型 ►│                       │                      │
 ├─ POST /api/tasks ────►│                       │                      │
 │                       ├─ 创建 Task+TaskVideo  │                      │
 │                       ├─ 入队列 ─────────────►│                      │
 │◄─ 返回 taskId ───────┤                       │                      │
 │                       │                       │                      │
 │  [WebSocket 连接]     │                       ├── 消费任务           │
 │                       │                       │  遍历每个 TaskVideo: │
 │                       │                       │   ├─ 获取视频 URL    │
 │                       │                       │   ├─ 获取 Skill 内容 │
 │                       │                       │   ├─ 调用 GLM API ──►│
 │◄─ WS: 进度更新 ──────┤◄──── 更新进度 ────────┤   │◄─ 分析结果 ──────┤
 │                       │                       │   ├─ 保存 Report     │
 │                       │                       │   └─ 下一个视频      │
 │◄─ WS: 任务完成 ──────┤◄──── 任务结束 ────────┤                      │
```

GLM API 调用构造：

```typescript
// 正常解析任务
{
  model: "glm-4.6v",
  messages: [{
    role: "user",
    content: [
      { type: "video_url", video_url: { url: video.ossUrl } },
      { type: "text", text: skill.content }
    ]
  }],
  thinking: { type: "enabled" }
}

// 报告修复任务
{
  model: "glm-4.6v",
  messages: [{
    role: "user",
    content: [
      { type: "video_url", video_url: { url: video.ossUrl } },
      {
        type: "text",
        text: `请基于当前的报告内容：\n${existingReport.content}\n\n结合新的要求${userAdditionalRequirements}\n\n和报告生成要求：\n${latestSkill.content}\n\n对于视频的内容重新进行分析和修正报告。`
      }
    ]
  }],
  thinking: { type: "enabled" }
}
```

### 5.3 报告版本管理流程

```
生成新报告 / 修复报告
    │
    ├─ 查找该视频是否已有 Report
    │   ├─ 没有 → 创建 Report (version=1) + ReportVersion (version=1)
    │   └─ 有   → 归档当前内容到 ReportVersion
    │            → 更新 Report.content 为新内容
    │            → Report.version += 1
    │            → 创建新 ReportVersion 记录
```

### 5.4 Skills 版本管理

与报告版本管理逻辑一致：编辑 Skill 时旧版本存入 SkillVersion，Skill 表始终保持最新。

## 6. API 设计

### 6.1 认证 `/api/auth`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /auth/login | 登录 | 公开 |
| POST | /auth/refresh | 刷新 token | 已登录 |
| POST | /auth/register | 注册用户 | Admin |
| GET | /auth/me | 当前用户信息 | 已登录 |

### 6.2 用户管理 `/api/users`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /users | 用户列表 | Admin |
| PATCH | /users/:id | 修改用户 | Admin |
| DELETE | /users/:id | 删除用户 | Admin |

### 6.3 模型管理 `/api/model-providers` & `/api/models`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /model-providers | 供应商列表 | Admin |
| POST | /model-providers | 创建供应商 | Admin |
| PATCH | /model-providers/:id | 更新供应商 | Admin |
| DELETE | /model-providers/:id | 删除供应商 | Admin |
| GET | /model-providers/:id/models | 供应商的模型列表 | Admin |
| POST | /models | 创建模型 | Admin |
| PATCH | /models/:id | 更新模型 | Admin |
| DELETE | /models/:id | 删除模型 | Admin |
| GET | /models | 所有可用模型 | Operator+ |

### 6.4 OSS 存储管理 `/api/oss-configs` & `/api/oss-buckets`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /oss-configs | 配置列表 | Admin |
| POST | /oss-configs | 创建配置 | Admin |
| PATCH | /oss-configs/:id | 更新配置 | Admin |
| DELETE | /oss-configs/:id | 删除配置 | Admin |
| POST | /oss-buckets | 创建 Bucket | Admin |
| DELETE | /oss-buckets/:id | 删除 Bucket | Admin |
| GET | /oss-buckets | Bucket 列表 | Admin |

### 6.5 视频管理 `/api/videos`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /videos | 视频列表 | 全部 |
| POST | /videos/upload-token | 获取上传凭证 | Operator+ |
| POST | /videos/complete | 上传完成回调 | Operator+ |
| GET | /videos/:id | 视频详情 | 全部 |
| DELETE | /videos/:id | 删除视频 | Operator+ |
| GET | /videos/:id/download-url | 获取下载 URL | 全部 |

### 6.6 解析任务 `/api/tasks`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /tasks | 创建任务 | Operator+ |
| GET | /tasks | 任务列表 | Operator+ |
| GET | /tasks/:id | 任务详情 | Operator+ |
| DELETE | /tasks/:id | 取消/删除任务 | Operator+ |

### 6.7 Skills 管理 `/api/skills`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /skills | Skill 列表 | Operator+ |
| POST | /skills | 创建 Skill | Operator+ |
| GET | /skills/:id | Skill 详情 | Operator+ |
| PATCH | /skills/:id | 更新 Skill | Operator+ |
| DELETE | /skills/:id | 删除 Skill | Admin |
| GET | /skills/:id/versions | 历史版本列表 | Operator+ |
| GET | /skills/:id/versions/:vid | 查看历史版本 | Operator+ |

### 6.8 报告管理 `/api/reports`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /videos/:id/reports | 视频的最新报告 | 全部 |
| GET | /reports/:id | 报告详情 | 全部 |
| GET | /reports/:id/versions | 历史版本列表 | 全部 |
| GET | /reports/:id/versions/:vid | 查看历史版本 | 全部 |
| POST | /reports/:id/revise | 修复报告 | Operator+ |

### 6.9 WebSocket 事件

| 事件 | 方向 | 描述 |
|------|------|------|
| task:progress | Server→Client | 任务进度更新 |
| task:video:completed | Server→Client | 单视频解析完成 |
| task:video:failed | Server→Client | 单视频解析失败 |
| task:completed | Server→Client | 整个任务完成 |

## 7. 前端页面设计

### 7.1 页面路由

```
/login                     # 登录页
/dashboard                 # 仪表盘概览
/videos                    # 视频管理列表
/videos/:id                # 视频详情
/tasks                     # 解析任务列表
/tasks/new                 # 创建新任务
/tasks/:id                 # 任务详情（实时进度）
/skills                    # Skills 管理列表
/skills/:id                # Skill 编辑/版本查看
/reports/:id               # 报告详情查看
/reports/:id/revise        # 报告修复
/settings/models           # 模型管理（Admin）
/settings/storage          # OSS 存储管理（Admin）
/settings/users            # 用户管理（Admin）
```

### 7.2 核心页面交互

**视频管理页**：表格展示视频列表，支持上传（拖拽+断点续传进度条）、删除、下载、查看。已有报告的视频显示"查看报告"按钮。支持批量选择用于创建解析任务。

**创建解析任务页**：Stepper 步骤引导 — 选视频 → 选 Skill → 选模型 → 确认提交。

**任务详情页**：整体进度条 + 各视频状态列表，通过 WebSocket 实时更新，完成的视频可跳转查看报告。

**报告查看页**：Markdown 渲染报告正文，版本切换下拉，"修复报告"按钮弹出输入框。

**Settings 页面（Admin）**：模型供应商/模型 CRUD、OSS 配置/Bucket 管理、用户角色管理。

### 7.3 UI 风格

- 组件库：shadcn/ui + Tailwind CSS
- 布局：左侧导航栏 + 顶部面包屑
- 数据表格：TanStack Table
- 表单：React Hook Form + Zod 校验
- 深色/浅色模式切换
- 实施阶段使用 ui-ux-pro-max skill 打磨 UI 细节
