# 链接视频解析功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持用户通过粘贴小红书/抖音视频链接创建解析任务，系统自动抓取平台数据、提取 MP4 URL、AI 分析视频并生成报告。

**Architecture:** 新增 ScraperModule（Playwright 无头浏览器）负责平台数据抓取和视频 URL 提取；新增 LinkVideoModule 管理链接视频 CRUD；扩展 TaskModule 支持 LINK 类型任务并注册独立 Bull 队列 `link-video-analysis`；前端新增任务类型选择步骤和链接视频管理页面。

**Tech Stack:** NestJS 11, Playwright, Bull/Redis, Prisma 6, Next.js 16, React 19, Zustand, React Query, shadcn/ui

---

## Task 1: Prisma Schema 变更

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增枚举和模型**

在 `prisma/schema.prisma` 中新增：

```prisma
// ========== 链接视频管理 ==========

// 在 TaskVideoStatus 枚举后面添加

enum TaskType {
  VIDEO
  LINK
}

enum Platform {
  XIAOHONGSHU
  DOUYIN
}

enum LinkVideoStatus {
  PENDING
  SCRAPING
  ANALYZING
  COMPLETED
  FAILED
}

model LinkVideo {
  id            String          @id @default(cuid())
  url           String
  platform      Platform
  title         String?
  author        String?
  videoFileUrl  String?
  coverUrl      String?
  likes         Int?
  collects      Int?
  comments      Int?
  shares        Int?
  status        LinkVideoStatus @default(PENDING)
  error         String?
  createdBy     String
  user          User            @relation(fields: [createdBy], references: [id])
  taskLinkVideos TaskLinkVideo[]
  reports       Report[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

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

**Step 2: 修改现有模型**

在 `Task` 模型中添加：
```prisma
  type           TaskType        @default(VIDEO)
  taskLinkVideos TaskLinkVideo[]
```

在 `Report` 模型中添加：
```prisma
  linkVideoId    String?
  linkVideo      LinkVideo?      @relation(fields: [linkVideoId], references: [id])
  taskLinkVideo  TaskLinkVideo?
```

在 `User` 模型中添加：
```prisma
  linkVideos   LinkVideo[]
```

**Step 3: 同步数据库**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm db:generate && pnpm db:push`
Expected: Schema 同步成功，新表已创建

**Step 4: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过（Prisma Client 已更新）

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: 新增链接视频相关数据模型（LinkVideo、TaskLinkVideo、TaskType 枚举等）"
```

---

## Task 2: 安装 Playwright 依赖

**Files:**
- Modify: `apps/server/package.json`

**Step 1: 安装 playwright**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo/apps/server && pnpm add playwright`

**Step 2: 安装浏览器**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && npx playwright install chromium`
Expected: Chromium 下载安装成功

**Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore: 安装 playwright 依赖用于链接视频抓取"
```

---

## Task 3: ScraperService — 平台数据抓取

**Files:**
- Create: `apps/server/src/modules/scraper/scraper.service.ts`
- Create: `apps/server/src/modules/scraper/scraper.module.ts`

**Step 1: 创建 ScraperService**

```typescript
// apps/server/src/modules/scraper/scraper.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

export interface ScrapedVideoData {
  title: string | null;
  author: string | null;
  likes: number | null;
  collects: number | null;
  comments: number | null;
  shares: number | null;
}

export interface ExtractedVideoUrl {
  videoFileUrl: string | null;
  coverUrl: string | null;
}

@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true });
      this.logger.log('Playwright 浏览器实例已启动');
    }
    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Playwright 浏览器实例已关闭');
    }
  }

  /** 根据 URL 自动识别平台 */
  detectPlatform(url: string): 'XIAOHONGSHU' | 'DOUYIN' | null {
    if (/xiaohongshu\.com|xhslink\.com/.test(url)) return 'XIAOHONGSHU';
    if (/douyin\.com|iesdouyin\.com/.test(url)) return 'DOUYIN';
    return null;
  }

  /** 抓取视频页面的互动数据 */
  async scrapeVideoData(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ScrapedVideoData> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

      if (platform === 'XIAOHONGSHU') {
        return await this.scrapeXiaohongshu(page);
      } else {
        return await this.scrapeDouyin(page);
      }
    } catch (error) {
      this.logger.error(`抓取失败 [${platform}] ${url}: ${(error as Error).message}`);
      return { title: null, author: null, likes: null, collects: null, comments: null, shares: null };
    } finally {
      await page.close();
    }
  }

  /** 通过 kukutool 提取视频 MP4 URL */
  async extractVideoFileUrl(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ExtractedVideoUrl> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      const kukuUrl = platform === 'XIAOHONGSHU'
        ? 'https://dy.kukutool.com/xiaohongshu'
        : 'https://dy.kukutool.com';

      await page.goto(kukuUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

      // 找到输入框并填入 URL
      const input = page.locator('input[type="text"], input[type="url"], input[placeholder]').first();
      await input.fill(url);

      // 点击解析按钮
      const submitBtn = page.locator('button').filter({ hasText: /解析|开始|提取/ }).first();
      await submitBtn.click();

      // 等待解析结果（最多 15 秒）
      await page.waitForTimeout(8000);

      // 尝试从页面元素中提取视频 URL
      const videoFileUrl = await this.extractUrlFromPage(page);
      const coverUrl = await this.extractCoverFromPage(page);

      return { videoFileUrl, coverUrl };
    } catch (error) {
      this.logger.error(`视频 URL 提取失败: ${(error as Error).message}`);
      return { videoFileUrl: null, coverUrl: null };
    } finally {
      await page.close();
    }
  }

  // ─── 内部方法 ───

  private async scrapeXiaohongshu(page: Page): Promise<ScrapedVideoData> {
    // 等待页面关键内容加载
    await page.waitForSelector('[class*="note"]', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const getText = (selector: string) =>
        document.querySelector(selector)?.textContent?.trim() || null;

      // 将 "1.2万" → 12000 等格式转为数字
      const parseCount = (text: string | null): number | null => {
        if (!text) return null;
        const cleaned = text.replace(/[^\d.万亿kKwWmM]/g, '');
        if (!cleaned) return null;
        let num = parseFloat(cleaned);
        if (/[万wW]/i.test(text)) num *= 10000;
        if (/[亿]/i.test(text)) num *= 100000000;
        if (/[kK]/.test(text)) num *= 1000;
        if (/[mM]/.test(text) && !/万/.test(text)) num *= 1000000;
        return Math.round(num);
      };

      // 小红书页面结构选择器
      const title =
        getText('[class*="title"]') ||
        getText('#detail-title') ||
        getText('.note-content .title');

      const author =
        getText('[class*="author"] [class*="name"]') ||
        getText('.author-wrapper .username') ||
        getText('[class*="user-name"]');

      // 互动数据通常在底部交互栏
      const interactionItems = document.querySelectorAll('[class*="interact"] span, [class*="engage"] span, [class*="count"]');
      const counts: number[] = [];
      interactionItems.forEach((el) => {
        const count = parseCount(el.textContent);
        if (count !== null) counts.push(count);
      });

      return {
        title,
        author,
        likes: counts[0] ?? null,
        collects: counts[1] ?? null,
        comments: counts[2] ?? null,
        shares: counts[3] ?? null,
      };
    });
  }

  private async scrapeDouyin(page: Page): Promise<ScrapedVideoData> {
    await page.waitForSelector('[class*="video"]', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const getText = (selector: string) =>
        document.querySelector(selector)?.textContent?.trim() || null;

      const parseCount = (text: string | null): number | null => {
        if (!text) return null;
        const cleaned = text.replace(/[^\d.万亿kKwWmM]/g, '');
        if (!cleaned) return null;
        let num = parseFloat(cleaned);
        if (/[万wW]/i.test(text)) num *= 10000;
        if (/[亿]/i.test(text)) num *= 100000000;
        if (/[kK]/.test(text)) num *= 1000;
        if (/[mM]/.test(text) && !/万/.test(text)) num *= 1000000;
        return Math.round(num);
      };

      const title =
        getText('[class*="title"]') ||
        getText('[data-e2e="video-desc"]');

      const author =
        getText('[data-e2e="video-author"]') ||
        getText('[class*="author-name"]');

      // 抖音互动数据
      const likesEl = document.querySelector('[data-e2e="digg-count"]');
      const commentsEl = document.querySelector('[data-e2e="comment-count"]');
      const collectsEl = document.querySelector('[data-e2e="collect-count"]');
      const sharesEl = document.querySelector('[data-e2e="share-count"]');

      return {
        title,
        author,
        likes: parseCount(likesEl?.textContent ?? null),
        collects: parseCount(collectsEl?.textContent ?? null),
        comments: parseCount(commentsEl?.textContent ?? null),
        shares: parseCount(sharesEl?.textContent ?? null),
      };
    });
  }

  /** 从 kukutool 解析结果页面提取视频下载链接 */
  private async extractUrlFromPage(page: Page): Promise<string | null> {
    try {
      // 优先从 "复制" 按钮获取关联链接
      const copyBtn = page.locator('button').filter({ hasText: /复制/ }).first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        // 通过 clipboard API 读取
        const clipText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
        if (clipText && clipText.includes('.mp4')) return clipText;
        if (clipText && /^https?:\/\//.test(clipText)) return clipText;
      }

      // 降级：从页面中查找视频链接
      const videoUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href], video source'));
        for (const el of links) {
          const href = el.getAttribute('href') || el.getAttribute('src') || '';
          if (href.includes('.mp4') || href.includes('douyinvod') || href.includes('xhscdn')) {
            return href;
          }
        }
        return null;
      });

      return videoUrl;
    } catch {
      return null;
    }
  }

  /** 从 kukutool 页面提取封面图 URL */
  private async extractCoverFromPage(page: Page): Promise<string | null> {
    try {
      return page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const src = img.src || '';
          // 排除网站自身 logo/icon，寻找视频封面
          if (src.includes('xhscdn') || src.includes('douyinpic') || src.includes('cover')) {
            return src;
          }
        }
        return null;
      });
    } catch {
      return null;
    }
  }
}
```

**Step 2: 创建 ScraperModule**

```typescript
// apps/server/src/modules/scraper/scraper.module.ts
import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Module({
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
```

**Step 3: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add apps/server/src/modules/scraper/
git commit -m "feat: 新增 ScraperService，封装 Playwright 抓取和 kukutool 视频 URL 提取"
```

---

## Task 4: LinkVideo CRUD 模块

**Files:**
- Create: `apps/server/src/modules/link-video/link-video.service.ts`
- Create: `apps/server/src/modules/link-video/link-video.controller.ts`
- Create: `apps/server/src/modules/link-video/link-video.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Step 1: 创建 LinkVideoService**

```typescript
// apps/server/src/modules/link-video/link-video.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class LinkVideoService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    platform?: string;
    status?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.platform) where.platform = params.platform;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { url: { contains: params.search, mode: 'insensitive' } },
        { author: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.linkVideo.findMany({
        where,
        include: {
          user: { select: { name: true } },
          _count: { select: { reports: true } },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.linkVideo.count({ where }),
    ]);

    return {
      items: items.map((lv) => ({
        id: lv.id,
        url: lv.url,
        platform: lv.platform,
        title: lv.title,
        author: lv.author,
        likes: lv.likes,
        collects: lv.collects,
        comments: lv.comments,
        shares: lv.shares,
        status: lv.status,
        error: lv.error,
        reportCount: lv._count.reports,
        createdBy: lv.user.name,
        createdAt: lv.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const lv = await this.prisma.linkVideo.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        reports: {
          select: { id: true, version: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lv) throw new NotFoundException('链接视频不存在');

    return {
      id: lv.id,
      url: lv.url,
      platform: lv.platform,
      title: lv.title,
      author: lv.author,
      videoFileUrl: lv.videoFileUrl,
      coverUrl: lv.coverUrl,
      likes: lv.likes,
      collects: lv.collects,
      comments: lv.comments,
      shares: lv.shares,
      status: lv.status,
      error: lv.error,
      createdBy: lv.user.name,
      reports: lv.reports,
      createdAt: lv.createdAt.toISOString(),
      updatedAt: lv.updatedAt.toISOString(),
    };
  }

  async remove(id: string) {
    const lv = await this.prisma.linkVideo.findUnique({ where: { id } });
    if (!lv) throw new NotFoundException('链接视频不存在');

    await this.prisma.linkVideo.delete({ where: { id } });
    return { success: true };
  }
}
```

**Step 2: 创建 LinkVideoController**

```typescript
// apps/server/src/modules/link-video/link-video.controller.ts
import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import { LinkVideoService } from './link-video.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('link-videos')
@Roles('OPERATOR')
export class LinkVideoController {
  constructor(private linkVideoService: LinkVideoService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.linkVideoService.findAll({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      platform,
      status,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linkVideoService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linkVideoService.remove(id);
  }
}
```

**Step 3: 创建 LinkVideoModule**

```typescript
// apps/server/src/modules/link-video/link-video.module.ts
import { Module } from '@nestjs/common';
import { LinkVideoController } from './link-video.controller';
import { LinkVideoService } from './link-video.service';

@Module({
  controllers: [LinkVideoController],
  providers: [LinkVideoService],
  exports: [LinkVideoService],
})
export class LinkVideoModule {}
```

**Step 4: 注册到 AppModule**

在 `apps/server/src/app.module.ts` 中：

- 添加 import: `import { LinkVideoModule } from './modules/link-video/link-video.module';`
- 添加 import: `import { ScraperModule } from './modules/scraper/scraper.module';`
- 在 `imports` 数组中添加: `ScraperModule, LinkVideoModule`

**Step 5: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 6: Commit**

```bash
git add apps/server/src/modules/link-video/ apps/server/src/app.module.ts
git commit -m "feat: 新增 LinkVideoModule 管理链接视频 CRUD"
```

---

## Task 5: 扩展 TaskModule 支持链接任务

**Files:**
- Create: `apps/server/src/modules/task/dto/create-link-task.dto.ts`
- Create: `apps/server/src/modules/task/link-task.processor.ts`
- Modify: `apps/server/src/modules/task/task.service.ts`
- Modify: `apps/server/src/modules/task/task.controller.ts`
- Modify: `apps/server/src/modules/task/task.module.ts`
- Modify: `apps/server/src/modules/report/report.service.ts`

**Step 1: 创建 CreateLinkTaskDto**

```typescript
// apps/server/src/modules/task/dto/create-link-task.dto.ts
import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateLinkTaskDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  skillId: string;

  @IsString()
  @IsNotEmpty()
  modelId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  urls: string[];
}
```

**Step 2: 修改 TaskService 新增 createLinkTask**

在 `apps/server/src/modules/task/task.service.ts` 中：

- 添加 import: `import { CreateLinkTaskDto } from './dto/create-link-task.dto';`
- 添加注入: `@InjectQueue('link-video-analysis') private linkAnalysisQueue: Queue`
- 新增方法 `createLinkTask`：

```typescript
/** 创建链接视频解析任务：自动识别平台、创建 LinkVideo 记录并入队 */
async createLinkTask(dto: CreateLinkTaskDto, userId: string) {
  const { ScraperService } = await import('../scraper/scraper.service');
  // detectPlatform 是纯函数，直接 new 即可调用（不依赖 DI）
  // 但更好的做法是注入 ScraperService，在 constructor 中添加

  const task = await this.prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        name: dto.name,
        type: 'LINK',
        skillId: dto.skillId,
        modelId: dto.modelId,
        createdBy: userId,
      },
    });

    // 为每个 URL 创建 LinkVideo 记录并关联 TaskLinkVideo
    for (const url of dto.urls) {
      const platform = this.detectPlatform(url);
      const linkVideo = await tx.linkVideo.create({
        data: {
          url,
          platform: platform || 'XIAOHONGSHU',
          createdBy: userId,
        },
      });

      await tx.taskLinkVideo.create({
        data: {
          taskId: t.id,
          linkVideoId: linkVideo.id,
        },
      });
    }

    return t;
  });

  await this.linkAnalysisQueue.add('analyze-links', { taskId: task.id });

  return { id: task.id, status: task.status, linkVideoCount: dto.urls.length };
}

/** URL 平台识别（纯函数） */
private detectPlatform(url: string): 'XIAOHONGSHU' | 'DOUYIN' | null {
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return 'XIAOHONGSHU';
  if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'DOUYIN';
  return null;
}
```

**Step 3: 修改 TaskService.findAll 返回 type 字段**

在 `findAll` 方法的返回 items map 中添加 `type: t.type`。

同时修改 `_count` 以兼容两种任务类型：
```typescript
_count: { select: { taskVideos: true, taskLinkVideos: true } },
```

返回中添加：
```typescript
type: t.type,
videoCount: t._count.taskVideos + t._count.taskLinkVideos,
```

**Step 4: 修改 TaskService.findOne 支持 LINK 类型**

在 `findOne` 方法中，同时 include `taskLinkVideos`：

```typescript
include: {
  // ...现有 include
  taskLinkVideos: {
    include: {
      linkVideo: { select: { title: true, url: true, platform: true, status: true, likes: true, collects: true, comments: true, shares: true } },
      report: { select: { id: true, version: true } },
    },
  },
},
```

返回中添加：
```typescript
type: task.type,
linkVideos: task.taskLinkVideos.map((tlv) => ({
  id: tlv.id,
  linkVideoId: tlv.linkVideoId,
  url: tlv.linkVideo.url,
  platform: tlv.linkVideo.platform,
  title: tlv.linkVideo.title,
  status: tlv.status,
  reportId: tlv.report?.id || null,
  reportVersion: tlv.report?.version || null,
  error: tlv.error,
  likes: tlv.linkVideo.likes,
  collects: tlv.linkVideo.collects,
  comments: tlv.linkVideo.comments,
  shares: tlv.linkVideo.shares,
  startedAt: tlv.startedAt?.toISOString() || null,
  completedAt: tlv.completedAt?.toISOString() || null,
})),
```

**Step 5: 修改 TaskController 新增链接任务端点**

在 `apps/server/src/modules/task/task.controller.ts` 中：

```typescript
import { CreateLinkTaskDto } from './dto/create-link-task.dto';

// 在 @Post() create 方法之后添加
@Post('link')
createLink(@Body() dto: CreateLinkTaskDto, @CurrentUser('id') userId: string) {
  return this.taskService.createLinkTask(dto, userId);
}
```

**注意**：`@Post('link')` 必须放在 `@Get(':id')` 之前，否则 "link" 会被匹配为 `:id` 参数。

**Step 6: 创建 LinkTaskProcessor**

```typescript
// apps/server/src/modules/task/link-task.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { LlmService } from '../llm/llm.service';
import { ReportService } from '../report/report.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { ScraperService } from '../scraper/scraper.service';

@Processor('link-video-analysis')
export class LinkTaskProcessor {
  private readonly logger = new Logger(LinkTaskProcessor.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private reportService: ReportService,
    private notificationGateway: NotificationGateway,
    private scraperService: ScraperService,
  ) {}

  /** 逐个处理链接视频：抓取数据 → 提取 MP4 URL → AI 分析 → 生成报告 */
  @Process('analyze-links')
  async handleLinkAnalysis(job: Job<{ taskId: string }>) {
    const { taskId } = job.data;
    this.logger.log(`Processing link task: ${taskId}`);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        taskLinkVideos: { include: { linkVideo: true } },
        skill: true,
      },
    });

    let completed = 0;
    let failed = 0;
    const total = task.taskLinkVideos.length;

    for (const tlv of task.taskLinkVideos) {
      const linkVideo = tlv.linkVideo;

      try {
        // 标记子任务为处理中
        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'PROCESSING', startedAt: new Date() },
        });

        this.notificationGateway.emitTaskProgress({
          taskId,
          progress: Math.round((completed / total) * 100),
          currentVideoId: linkVideo.id,
          currentVideoTitle: linkVideo.url,
        });

        // 阶段 1: 抓取平台互动数据
        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'SCRAPING' },
        });

        const scrapedData = await this.scraperService.scrapeVideoData(
          linkVideo.url,
          linkVideo.platform,
        );

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: {
            title: scrapedData.title,
            author: scrapedData.author,
            likes: scrapedData.likes,
            collects: scrapedData.collects,
            comments: scrapedData.comments,
            shares: scrapedData.shares,
          },
        });

        this.logger.log(`已抓取平台数据: ${linkVideo.url}`);

        // 阶段 2: 提取 MP4 URL
        const extracted = await this.scraperService.extractVideoFileUrl(
          linkVideo.url,
          linkVideo.platform,
        );

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: {
            videoFileUrl: extracted.videoFileUrl,
            coverUrl: extracted.coverUrl,
            status: 'ANALYZING',
          },
        });

        // 阶段 3: AI 分析
        let reportContent: string;

        // 构建包含平台数据上下文的 prompt
        const platformContext = this.buildPlatformContext(scrapedData, linkVideo.platform);

        if (extracted.videoFileUrl) {
          // 有视频 URL → 完整分析（视频内容 + 平台数据）
          reportContent = await this.llmService.analyzeVideo({
            modelId: task.modelId,
            videoUrl: extracted.videoFileUrl,
            prompt: `${task.skill.content}\n\n## 平台数据参考\n${platformContext}`,
          });
        } else {
          // 无视频 URL → 降级为纯文本分析（基于平台数据）
          reportContent = await this.llmService.analyzeVideo({
            modelId: task.modelId,
            videoUrl: linkVideo.url,
            prompt: `${task.skill.content}\n\n## 平台数据参考\n${platformContext}\n\n注意：视频直链提取失败，请基于视频页面 URL 和平台数据进行分析。`,
          });
        }

        // 创建报告，关联 linkVideoId
        const report = await this.reportService.createOrUpdateLinkVideoReport({
          linkVideoId: linkVideo.id,
          content: reportContent,
          skillId: task.skillId,
          modelId: task.modelId,
        });

        // 解除旧关联，建立新关联
        await this.prisma.taskLinkVideo.updateMany({
          where: { reportId: report.id },
          data: { reportId: null },
        });

        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'COMPLETED', reportId: report.id, completedAt: new Date() },
        });

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'COMPLETED' },
        });

        completed++;
        this.notificationGateway.emitTaskVideoCompleted({
          taskId,
          taskVideoId: tlv.id,
          videoId: linkVideo.id,
          reportId: report.id,
        });
      } catch (err) {
        failed++;
        const errorMessage = (err as Error).message;
        this.logger.error(`链接视频分析失败 ${linkVideo.url}: ${errorMessage}`);

        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'FAILED', error: errorMessage, completedAt: new Date() },
        });

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'FAILED', error: errorMessage },
        });

        this.notificationGateway.emitTaskVideoFailed({
          taskId,
          taskVideoId: tlv.id,
          videoId: linkVideo.id,
          error: errorMessage,
        });
      }

      await this.prisma.task.update({
        where: { id: taskId },
        data: { progress: Math.round(((completed + failed) / total) * 100) },
      });
    }

    const finalStatus = failed === total ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: finalStatus, progress: 100, completedAt: new Date() },
    });

    this.notificationGateway.emitTaskCompleted(taskId);
    this.logger.log(`Link task ${taskId} completed: ${completed} success, ${failed} failed`);
  }

  /** 将平台互动数据格式化为 prompt 上下文 */
  private buildPlatformContext(
    data: { title: string | null; author: string | null; likes: number | null; collects: number | null; comments: number | null; shares: number | null },
    platform: string,
  ): string {
    const lines: string[] = [];
    lines.push(`平台: ${platform === 'XIAOHONGSHU' ? '小红书' : '抖音'}`);
    if (data.title) lines.push(`标题: ${data.title}`);
    if (data.author) lines.push(`博主: ${data.author}`);
    if (data.likes !== null) lines.push(`点赞: ${data.likes}`);
    if (data.collects !== null) lines.push(`收藏: ${data.collects}`);
    if (data.comments !== null) lines.push(`评论: ${data.comments}`);
    if (data.shares !== null) lines.push(`分享: ${data.shares}`);
    return lines.join('\n');
  }
}
```

**Step 7: 修改 ReportService 支持 linkVideoId**

在 `apps/server/src/modules/report/report.service.ts` 中新增方法：

```typescript
/** 为链接视频创建或更新报告，逻辑与 createOrUpdateReport 类似但关联 linkVideoId */
async createOrUpdateLinkVideoReport(params: {
  linkVideoId: string;
  content: string;
  skillId?: string;
  modelId?: string;
}): Promise<{ id: string; version: number }> {
  const existing = await this.prisma.report.findFirst({
    where: { linkVideoId: params.linkVideoId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!existing) {
    const report = await this.prisma.$transaction(async (tx) => {
      const newReport = await tx.report.create({
        data: {
          linkVideoId: params.linkVideoId,
          content: params.content,
          version: 1,
        },
      });

      await tx.reportVersion.create({
        data: {
          reportId: newReport.id,
          version: 1,
          content: params.content,
          skillId: params.skillId,
          modelId: params.modelId,
        },
      });

      return newReport;
    });

    return { id: report.id, version: report.version };
  }

  const updated = await this.prisma.$transaction(async (tx) => {
    await tx.reportVersion.create({
      data: {
        reportId: existing.id,
        version: existing.version,
        content: existing.content,
        skillId: params.skillId,
        modelId: params.modelId,
      },
    });

    const updatedReport = await tx.report.update({
      where: { id: existing.id },
      data: {
        content: params.content,
        version: existing.version + 1,
      },
    });

    return updatedReport;
  });

  return { id: updated.id, version: updated.version };
}
```

**注意**: `Report` 模型中 `videoId` 字段现在需要改为可选（`String?`），因为链接视频报告没有对应的 `Video` 记录。回到 Step 1（Task 1），确保 `Report.videoId` 改为 `String?`。

**Step 8: 修改 TaskModule 注册新队列和处理器**

```typescript
// apps/server/src/modules/task/task.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskProcessor } from './task.processor';
import { LinkTaskProcessor } from './link-task.processor';
import { LlmModule } from '../llm/llm.module';
import { ReportModule } from '../report/report.module';
import { NotificationModule } from '../notification/notification.module';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-analysis' }),
    BullModule.registerQueue({ name: 'link-video-analysis' }),
    LlmModule,
    ReportModule,
    NotificationModule,
    ScraperModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskProcessor, LinkTaskProcessor],
})
export class TaskModule {}
```

**Step 9: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 10: Commit**

```bash
git add apps/server/src/modules/task/ apps/server/src/modules/report/report.service.ts
git commit -m "feat: TaskModule 支持链接视频任务，新增 LinkTaskProcessor 和 createLinkTask"
```

---

## Task 6: Report.videoId 改为可选 + Schema 最终调整

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `apps/server/src/modules/report/report.service.ts`

**Step 1: 修改 Report.videoId 为可选**

在 `prisma/schema.prisma` 的 `Report` 模型中：

```prisma
model Report {
  id             String          @id @default(cuid())
  videoId        String?         // 改为可选，链接视频报告无对应 Video
  video          Video?          @relation(fields: [videoId], references: [id])
  linkVideoId    String?
  linkVideo      LinkVideo?      @relation(fields: [linkVideoId], references: [id])
  content        String
  version        Int             @default(1)
  versions       ReportVersion[]
  taskVideo      TaskVideo?
  taskLinkVideo  TaskLinkVideo?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```

**Step 2: 同步数据库**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm db:generate && pnpm db:push`
Expected: 成功（videoId 改为 nullable，已有数据不受影响）

**Step 3: 修改 ReportService.findOne 兼容链接视频**

在 `findOne` 和 `findByVideoId` 方法中，添加 `linkVideo` include 和条件判断：

```typescript
// findOne 方法中，include 添加：
include: { video: { select: { title: true } }, linkVideo: { select: { title: true, url: true } } },

// 返回中添加：
videoTitle: report.video?.title || report.linkVideo?.title || '未知',
linkVideoUrl: report.linkVideo?.url || null,
```

**Step 4: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 5: Commit**

```bash
git add prisma/schema.prisma apps/server/src/modules/report/
git commit -m "feat: Report.videoId 改为可选以支持链接视频报告"
```

---

## Task 7: 前端 — 侧边栏新增链接视频导航

**Files:**
- Modify: `apps/web/src/components/sidebar-nav.tsx`

**Step 1: 新增导航项**

在 `sidebar-nav.tsx` 中：

- 添加 import: `import { Link2 } from 'lucide-react';`
- 在 `mainNav` 数组的 `视频管理` 之后添加：

```typescript
{ title: '链接视频', href: '/dashboard/link-videos', icon: Link2, minRole: 'OPERATOR' },
```

**Step 2: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 3: Commit**

```bash
git add apps/web/src/components/sidebar-nav.tsx
git commit -m "feat: 侧边栏新增链接视频导航入口"
```

---

## Task 8: 前端 — 链接视频管理页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/link-videos/page.tsx`

**Step 1: 创建链接视频列表页**

```tsx
// apps/web/src/app/(dashboard)/dashboard/link-videos/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ExternalLink, FileText, Link2, Search } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { QueryError } from '@/components/query-error';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '等待中', variant: 'secondary' },
  SCRAPING: { label: '抓取中', variant: 'default' },
  ANALYZING: { label: '分析中', variant: 'default' },
  COMPLETED: { label: '已完成', variant: 'outline' },
  FAILED: { label: '失败', variant: 'destructive' },
};

const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  XIAOHONGSHU: { label: '小红书', color: 'text-red-500' },
  DOUYIN: { label: '抖音', color: 'text-blue-500' },
};

export default function LinkVideosPage() {
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['link-videos', page, platform, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (platform) params.set('platform', platform);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get<any>(`/link-videos?${params.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/link-videos/${id}`),
    onSuccess: () => {
      toast.success('链接视频已删除');
      queryClient.invalidateQueries({ queryKey: ['link-videos'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatCount = (count: number | null) => {
    if (count === null || count === undefined) return '-';
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    return String(count);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">链接视频</h1>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索标题、URL 或博主..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={platform} onValueChange={(v) => { setPlatform(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            <SelectItem value="XIAOHONGSHU">小红书</SelectItem>
            <SelectItem value="DOUYIN">抖音</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="PENDING">等待中</SelectItem>
            <SelectItem value="SCRAPING">抓取中</SelectItem>
            <SelectItem value="ANALYZING">分析中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <QueryError error={error} retry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台</TableHead>
                  <TableHead>标题 / URL</TableHead>
                  <TableHead>博主</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">点赞</TableHead>
                  <TableHead className="text-right">收藏</TableHead>
                  <TableHead className="text-right">评论</TableHead>
                  <TableHead>报告</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items?.map((lv: any) => {
                  const statusInfo = STATUS_MAP[lv.status] || { label: lv.status, variant: 'secondary' as const };
                  const platformInfo = PLATFORM_MAP[lv.platform] || { label: lv.platform, color: '' };
                  return (
                    <TableRow key={lv.id}>
                      <TableCell>
                        <span className={`font-medium ${platformInfo.color}`}>{platformInfo.label}</span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{lv.title || '未获取'}</div>
                        <a
                          href={lv.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline truncate block"
                        >
                          {lv.url}
                        </a>
                      </TableCell>
                      <TableCell>{lv.author || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCount(lv.likes)}</TableCell>
                      <TableCell className="text-right">{formatCount(lv.collects)}</TableCell>
                      <TableCell className="text-right">{formatCount(lv.comments)}</TableCell>
                      <TableCell>
                        {lv.reportCount > 0 ? (
                          <Badge variant="outline" className="text-green-600">
                            {lv.reportCount} 份
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">暂无</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(lv.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data?.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        icon={Link2}
                        title="暂无链接视频"
                        description="通过创建链接任务来添加视频链接"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                第 {page} / {data.totalPages} 页
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定删除该链接视频记录？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/link-videos/
git commit -m "feat: 新增链接视频管理页面"
```

---

## Task 9: 前端 — 任务创建页面支持链接模式

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/tasks/new/page.tsx`

**Step 1: 改造创建任务页面**

完整重写 `page.tsx`，新增 Step 0 选择任务类型，Step 1 分为本地视频和链接视频两种模式：

关键变更点：

1. **新增 state**: `taskType` ('VIDEO' | 'LINK')，`linkUrls`（textarea 原始文本），`parsedLinks`（解析后的链接列表）
2. **Step 0**: 两张卡片选择"本地视频"或"链接视频"
3. **Step 1 链接模式**: textarea 粘贴链接 + 实时解析展示
4. **步骤指示器**: 从 4 步变为 5 步（0-4）
5. **提交逻辑**: `taskType === 'LINK'` 时调用 `POST /tasks/link`，否则调用 `POST /tasks`

**链接解析逻辑**（在 textarea onChange 中）：

```typescript
// 支持逗号、换行、空格分隔
const parseUrls = (text: string): Array<{ url: string; platform: string }> => {
  const urls = text
    .split(/[,\n\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));

  return urls.map((url) => ({
    url,
    platform: /xiaohongshu\.com|xhslink\.com/i.test(url)
      ? 'XIAOHONGSHU'
      : /douyin\.com|iesdouyin\.com/i.test(url)
        ? 'DOUYIN'
        : 'UNKNOWN',
  }));
};
```

**提交逻辑**：

```typescript
// 链接任务
const createLinkMutation = useMutation({
  mutationFn: (body: { name: string; urls: string[]; skillId: string; modelId: string }) =>
    apiClient.post<{ id: string }>('/tasks/link', body),
  onSuccess: (data) => {
    toast.success('链接任务已创建');
    router.push(`/dashboard/tasks/${data.id}`);
  },
  onError: (err: Error) => toast.error(err.message),
});

const handleSubmit = () => {
  if (taskType === 'LINK') {
    createLinkMutation.mutate({
      name: taskName,
      urls: parsedLinks.map((l) => l.url),
      skillId: selectedSkill,
      modelId: selectedModel,
    });
  } else {
    createMutation.mutate({
      name: taskName,
      videoIds: Array.from(selectedVideos),
      skillId: selectedSkill,
      modelId: selectedModel,
    });
  }
};
```

**Step 2: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/tasks/new/page.tsx
git commit -m "feat: 任务创建页面支持链接视频模式"
```

---

## Task 10: 前端 — 任务列表和详情页兼容 LINK 类型

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/tasks/[id]/page.tsx`

**Step 1: 修改任务列表页**

在 `tasks/page.tsx` 表格中：

- 名称列后面添加任务类型标识（Badge）
- `videoCount` 列标题改为更通用的"视频/链接数"

```tsx
// 在名称 TableCell 中添加类型标识
<TableCell className="font-medium">
  {task.name}
  {task.type === 'LINK' && (
    <Badge variant="outline" className="ml-2 text-xs">链接</Badge>
  )}
</TableCell>
```

**Step 2: 修改任务详情页**

在 `tasks/[id]/page.tsx` 中：

- 根据 `task.type` 显示不同的视频处理状态表格
- `type === 'LINK'` 时显示 `task.linkVideos` 列表
- 链接视频表格列：链接/标题、平台、状态、互动数据、报告、错误

```tsx
{/* 根据任务类型展示不同表格 */}
{task.type === 'LINK' ? (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>链接</TableHead>
        <TableHead>平台</TableHead>
        <TableHead>状态</TableHead>
        <TableHead className="text-right">点赞</TableHead>
        <TableHead>报告</TableHead>
        <TableHead>错误</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {task.linkVideos?.map((lv: any) => {
        const statusInfo = VIDEO_STATUS[lv.status] || VIDEO_STATUS.PENDING;
        return (
          <TableRow key={lv.id}>
            <TableCell className="max-w-xs">
              <div className="truncate font-medium">{lv.title || '未获取'}</div>
              <div className="text-xs text-muted-foreground truncate">{lv.url}</div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {lv.platform === 'XIAOHONGSHU' ? '小红书' : '抖音'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {statusInfo.icon}
                <span>{statusInfo.label}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">{lv.likes ?? '-'}</TableCell>
            <TableCell>
              {lv.reportId ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/reports/${lv.reportId}`}>
                    <FileText className="mr-1 h-4 w-4" />查看报告
                  </Link>
                </Button>
              ) : '-'}
            </TableCell>
            <TableCell className="text-sm text-destructive max-w-xs truncate">
              {lv.error || '-'}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
) : (
  /* 原有的 task.videos 表格保持不变 */
)}
```

**Step 3: 验证编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 编译通过

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/tasks/
git commit -m "feat: 任务列表和详情页兼容 LINK 类型任务"
```

---

## Task 11: 全量编译验证与集成测试

**Step 1: 全量编译**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm build`
Expected: 前后端全部编译通过

**Step 2: 数据库同步验证**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm db:generate && pnpm db:push`
Expected: Schema 与数据库同步，无错误

**Step 3: 启动服务验证**

Run: `cd /Users/kevin/dev/ai/xiaohongshuvideo && pnpm dev`
Expected: 前后端正常启动，无报错

**Step 4: 手动验证清单**

1. 打开 `/dashboard/link-videos` → 页面正常渲染，显示空状态
2. 打开 `/dashboard/tasks/new` → 显示任务类型选择步骤
3. 选择"链接视频" → 显示 textarea 输入区域
4. 粘贴多个小红书/抖音链接 → 链接被正确解析并显示平台标识
5. 完成后续步骤（Skill、模型、确认）→ 提交成功
6. 任务列表页 → 新任务显示"链接"标识
7. 任务详情页 → 显示链接视频处理状态

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: 链接视频解析功能完成"
```

---

## 文件变更总览

| # | 文件 | 操作 |
|---|------|------|
| 1 | `prisma/schema.prisma` | 修改 |
| 2 | `apps/server/package.json` | 修改（+playwright） |
| 3 | `apps/server/src/modules/scraper/scraper.service.ts` | **新建** |
| 4 | `apps/server/src/modules/scraper/scraper.module.ts` | **新建** |
| 5 | `apps/server/src/modules/link-video/link-video.service.ts` | **新建** |
| 6 | `apps/server/src/modules/link-video/link-video.controller.ts` | **新建** |
| 7 | `apps/server/src/modules/link-video/link-video.module.ts` | **新建** |
| 8 | `apps/server/src/modules/task/dto/create-link-task.dto.ts` | **新建** |
| 9 | `apps/server/src/modules/task/link-task.processor.ts` | **新建** |
| 10 | `apps/server/src/modules/task/task.service.ts` | 修改 |
| 11 | `apps/server/src/modules/task/task.controller.ts` | 修改 |
| 12 | `apps/server/src/modules/task/task.module.ts` | 修改 |
| 13 | `apps/server/src/modules/report/report.service.ts` | 修改 |
| 14 | `apps/server/src/app.module.ts` | 修改 |
| 15 | `apps/web/src/components/sidebar-nav.tsx` | 修改 |
| 16 | `apps/web/src/app/(dashboard)/dashboard/link-videos/page.tsx` | **新建** |
| 17 | `apps/web/src/app/(dashboard)/dashboard/tasks/new/page.tsx` | 修改 |
| 18 | `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx` | 修改 |
| 19 | `apps/web/src/app/(dashboard)/dashboard/tasks/[id]/page.tsx` | 修改 |
