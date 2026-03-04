# 链接视频解析功能设计文档

> 日期：2026-03-04
> 状态：已批准，待实施

## 1. 背景与目标

当前系统仅支持用户上传本地视频文件到 OSS 后进行 AI 分析。新增"链接视频"功能，允许用户直接粘贴小红书/抖音视频链接，系统自动完成：

1. **抓取平台数据** — 通过 Playwright 无头浏览器访问视频页面，提取互动数据（点赞、收藏、评论等）
2. **提取 MP4 URL** — 调用 kukutool.com 解析服务获取视频直链
3. **AI 视频分析** — 将 MP4 URL 传给 GLM 多模态模型进行内容分析
4. **生成报告** — 将平台数据 + AI 分析结果合并生成完整报告

## 2. Skills 实现逻辑分析

### 2.1 extract-video-url 技能

通过 Playwright 自动化操作 kukutool.com 网站提取视频直链：

- **步骤 1**：打开 `dy.kukutool.com`（小红书）或 `dy.kukutool.com`（抖音）
- **步骤 2**：在输入框填入视频 URL
- **步骤 3**：点击"开始解析"，等待 5-10 秒后通过剪贴板 API 读取 MP4 URL，同时从快照中提取封面图 URL

**关键约束**：MP4 URL 带签名和过期时间，通常有效期有限，需及时使用。

### 2.2 video-analysis 技能

6 阶段流程：初始化 → 抓取页面数据 → 调用 extract-video-url → AI 分析视频 → 生成报告 → 完成

**系统化改造方向**：将 Skill 中基于 MCP 工具的交互式流程改造为后端 Service，使用 Playwright 库（非 MCP）在服务端完成所有自动化操作。

## 3. 数据模型设计

### 3.1 新增枚举

```prisma
// 任务类型：区分本地视频任务和链接视频任务
enum TaskType {
  VIDEO    // 本地视频（默认，兼容现有逻辑）
  LINK     // 链接视频
}

// 链接视频来源平台
enum Platform {
  XIAOHONGSHU
  DOUYIN
}

// 链接视频处理状态（比 TaskVideoStatus 多一个 SCRAPING 阶段）
enum LinkVideoStatus {
  PENDING      // 等待处理
  SCRAPING     // 正在抓取平台数据 + 提取 MP4 URL
  ANALYZING    // 正在进行 AI 分析
  COMPLETED    // 完成
  FAILED       // 失败
}
```

### 3.2 新增 LinkVideo 模型

独立管理链接视频记录，不与现有 Video 表混合，避免字段冲突（Video 表强依赖 ossKey/bucketId 等存储字段）。

```prisma
model LinkVideo {
  id            String          @id @default(cuid())
  url           String          // 用户输入的原始链接
  platform      Platform        // 平台类型
  title         String?         // 从页面抓取的视频标题
  author        String?         // 博主名称
  videoFileUrl  String?         // 提取到的 MP4 直链（临时有效）
  coverUrl      String?         // 封面图 URL

  // 互动数据（从平台页面抓取）
  likes         Int?
  collects      Int?            // 收藏数（小红书）
  comments      Int?
  shares        Int?

  status        LinkVideoStatus @default(PENDING)
  error         String?         // 失败时的错误信息

  // 关联
  createdBy     String
  user          User            @relation(fields: [createdBy], references: [id])
  taskLinkVideos TaskLinkVideo[]
  reports       Report[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}
```

### 3.3 新增 TaskLinkVideo 关联表

类似 TaskVideo，但关联 LinkVideo 而非 Video。

```prisma
model TaskLinkVideo {
  id           String          @id @default(cuid())
  taskId       String
  task         Task            @relation(fields: [taskId], references: [id])
  linkVideoId  String
  linkVideo    LinkVideo       @relation(fields: [linkVideoId], references: [id])
  status       TaskVideoStatus @default(PENDING)
  reportId     String?         @unique
  report       Report?         @relation(fields: [reportId], references: [id])
  error        String?
  startedAt    DateTime?
  completedAt  DateTime?
}
```

### 3.4 现有模型变更

**Task 表** 新增 `type` 字段：

```prisma
model Task {
  // ...现有字段不变
  type           TaskType        @default(VIDEO)
  taskLinkVideos TaskLinkVideo[]
}
```

**Report 表** 新增 `linkVideoId` 可选关联：

```prisma
model Report {
  // ...现有字段不变
  linkVideoId    String?
  linkVideo      LinkVideo?  @relation(fields: [linkVideoId], references: [id])
  taskLinkVideo  TaskLinkVideo?
}
```

**User 表** 新增关联：

```prisma
model User {
  // ...现有字段不变
  linkVideos  LinkVideo[]
}
```

## 4. 后端处理流程

### 4.1 ScraperService（新建）

封装 Playwright 无头浏览器操作，负责平台数据抓取和 MP4 URL 提取。

```
ScraperService
├── scrapeVideoData(url, platform)     → { title, author, likes, collects, comments, shares }
├── extractVideoFileUrl(url, platform) → { videoFileUrl, coverUrl }
└── 内部方法
    ├── scrapeXiaohongshu(url)         → 打开小红书页面，提取数据
    ├── scrapeDouyin(url)              → 打开抖音页面，提取数据
    └── extractViaKukutool(url)        → 通过 kukutool 提取 MP4 URL
```

**关键设计决策**：
- 使用 `playwright` npm 包（非 MCP 工具），在 NestJS 进程内启动无头浏览器
- 浏览器实例池化管理，避免每次请求都启动新实例
- 超时控制：页面加载 30 秒超时，解析等待 15 秒超时

### 4.2 LinkTaskProcessor（新建）

注册独立的 Bull 队列 `link-video-analysis`，处理链接视频任务。

**三阶段处理流程**（每个 LinkVideo 依次执行）：

```
阶段 1: 抓取平台数据
  └─ ScraperService.scrapeVideoData(url, platform)
  └─ 更新 LinkVideo 的 title, author, likes 等字段
  └─ 状态: PENDING → SCRAPING

阶段 2: 提取 MP4 URL
  └─ ScraperService.extractVideoFileUrl(url, platform)
  └─ 更新 LinkVideo.videoFileUrl, coverUrl
  └─ 如果提取失败 → 仅做文本分析（降级）

阶段 3: AI 分析
  └─ LlmService.analyzeVideo({ videoUrl: linkVideo.videoFileUrl, prompt })
  └─ 将平台数据注入 prompt 或追加到报告中
  └─ 创建 Report，关联 linkVideoId
  └─ 状态: SCRAPING → ANALYZING → COMPLETED
```

### 4.3 降级策略

| 失败场景 | 处理方式 |
|----------|----------|
| 平台数据抓取失败 | 仍尝试提取 MP4 URL 和 AI 分析，报告中标注"平台数据不可用" |
| MP4 URL 提取失败 | 仅生成基于平台数据的文字报告，跳过视频内容分析 |
| AI 分析失败 | 仅保存平台数据作为简化报告 |
| 全部失败 | TaskLinkVideo 标记 FAILED，记录 error 信息 |

## 5. 前端交互设计

### 5.1 创建任务页面改造

在现有 4 步流程前新增 **Step 0: 选择任务类型**：

```
Step 0: 选择来源        → 本地视频 / 链接视频
Step 1: (本地) 选择视频  / (链接) 粘贴链接
Step 2: 选择 Skill
Step 3: 选择模型 + 任务名称
Step 4: 确认提交
```

**链接视频模式的 Step 1**：
- 大文本域（textarea），支持粘贴多个链接
- 每行一个链接，或逗号/空格分隔
- 实时解析并显示识别到的链接列表（带平台图标）
- 自动识别平台类型（小红书 / 抖音）
- 支持完整链接和短链接格式

### 5.2 链接视频管理页面（新建）

路由：`/dashboard/link-videos`

| 功能 | 说明 |
|------|------|
| 链接视频列表 | 表格展示所有链接视频记录，含平台、标题、状态、互动数据 |
| 搜索与筛选 | 按平台、状态筛选，按标题/URL 搜索 |
| 查看详情 | 展示完整互动数据和关联报告 |
| 删除 | 支持删除链接视频记录 |
| 平台图标 | 小红书/抖音用不同图标/颜色区分 |

### 5.3 侧边栏导航

在"视频管理"下方新增"链接视频"入口。

## 6. API 设计

### 6.1 链接视频任务

```
POST /tasks/link
Body: {
  name: string,
  urls: string[],        // 视频链接列表
  skillId: string,
  modelId: string
}
Response: { id, status, linkVideoCount }
```

后端处理：
1. 解析每个 URL，识别平台类型
2. 创建 LinkVideo 记录（每个 URL 一条）
3. 创建 Task（type=LINK）和 TaskLinkVideo 关联
4. 入队 `link-video-analysis` Bull 队列

### 6.2 链接视频管理

```
GET    /link-videos              — 分页查询链接视频列表
GET    /link-videos/:id          — 获取单条链接视频详情
DELETE /link-videos/:id          — 删除链接视频记录
```

### 6.3 现有 API 兼容

- `GET /tasks` — 返回结果新增 `type` 字段，前端据此展示不同标识
- `GET /tasks/:id` — LINK 类型任务返回 `taskLinkVideos` 而非 `taskVideos`
- `GET /reports` — 支持通过 `linkVideoId` 筛选

## 7. 依赖与前置条件

| 依赖 | 说明 |
|------|------|
| Playwright | 服务端需安装 Playwright 及 Chromium，用于无头浏览器操作 |
| kukutool.com | 第三方视频解析服务，需保证网络可达 |
| Bull 队列 | 复用现有 Redis 实例，新增 `link-video-analysis` 队列 |
| GLM API | 复用现有 LlmService，MP4 URL 作为 video_url 传入 |

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | 新增枚举、LinkVideo、TaskLinkVideo 模型，修改 Task/Report/User |
| `apps/server/src/modules/scraper/scraper.service.ts` | **新建** | Playwright 抓取 + kukutool 提取 |
| `apps/server/src/modules/scraper/scraper.module.ts` | **新建** | ScraperModule |
| `apps/server/src/modules/task/link-task.processor.ts` | **新建** | 链接视频任务 Bull 处理器 |
| `apps/server/src/modules/task/task.service.ts` | 修改 | 新增 createLinkTask 方法 |
| `apps/server/src/modules/task/task.controller.ts` | 修改 | 新增 POST /tasks/link 端点 |
| `apps/server/src/modules/task/task.module.ts` | 修改 | 注册新队列和处理器，导入 ScraperModule |
| `apps/server/src/modules/link-video/link-video.service.ts` | **新建** | LinkVideo CRUD |
| `apps/server/src/modules/link-video/link-video.controller.ts` | **新建** | LinkVideo API 端点 |
| `apps/server/src/modules/link-video/link-video.module.ts` | **新建** | LinkVideoModule |
| `apps/server/src/app.module.ts` | 修改 | 注册 ScraperModule、LinkVideoModule |
| `apps/web/src/app/(dashboard)/dashboard/tasks/new/page.tsx` | 修改 | 增加任务类型选择和链接输入步骤 |
| `apps/web/src/app/(dashboard)/dashboard/link-videos/page.tsx` | **新建** | 链接视频管理页面 |
| `apps/web/src/components/sidebar-nav.tsx` | 修改 | 新增"链接视频"导航项 |
