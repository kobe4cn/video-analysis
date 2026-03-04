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

  /** 懒初始化浏览器实例，断开后自动重建 */
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
    if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return 'XIAOHONGSHU';
    if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'DOUYIN';
    return null;
  }

  /**
   * 创建伪装过的浏览器上下文，绕过小红书/抖音反爬检测。
   * 关键：隐藏 navigator.webdriver、设置真实 UA 和 viewport。
   */
  private async createStealthContext() {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });
    // 在每个页面加载前注入脚本，隐藏自动化标识
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    return context;
  }

  /** 抓取视频页面的互动数据 */
  async scrapeVideoData(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ScrapedVideoData> {
    const context = await this.createStealthContext();
    const page = await context.newPage();
    try {
      this.logger.log(`开始抓取平台数据 [${platform}]: ${url}`);
      await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
      // 等待页面动态内容加载
      await page.waitForTimeout(5000);

      const data = platform === 'XIAOHONGSHU'
        ? await this.scrapeXiaohongshu(page)
        : await this.scrapeDouyin(page);

      this.logger.log(
        `平台数据抓取结果 [${platform}]:\n` +
        `  标题: ${data.title ?? '未获取'}\n` +
        `  博主: ${data.author ?? '未获取'}\n` +
        `  点赞: ${data.likes ?? '未获取'}\n` +
        `  收藏: ${data.collects ?? '未获取'}\n` +
        `  评论: ${data.comments ?? '未获取'}\n` +
        `  分享: ${data.shares ?? '未获取'}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `抓取失败 [${platform}] ${url}: ${(error as Error).message}`,
      );
      return {
        title: null,
        author: null,
        likes: null,
        collects: null,
        comments: null,
        shares: null,
      };
    } finally {
      await context.close();
    }
  }

  /** 通过 kukutool 第三方解析服务提取视频 MP4 URL（仅提取，不下载） */
  async extractVideoFileUrl(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ExtractedVideoUrl> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    try {
      const kukuUrl =
        platform === 'XIAOHONGSHU'
          ? 'https://dy.kukutool.com/xiaohongshu'
          : 'https://dy.kukutool.com';
      this.logger.log(`打开 kukutool 页面: ${kukuUrl}`);
      await page.goto(kukuUrl, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      // kukutool 会弹出广告解锁弹窗，必须先关闭才能操作
      await this.dismissKukutoolAdDialog(page);

      // 等待输入框可交互后填入链接
      const input = page.locator('input[type="text"], input[type="url"], input[placeholder]').first();
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.fill(url);
      this.logger.log(`已填入链接: ${url}`);

      // 确保"开始解析"按钮可见并点击
      const submitBtn = page.locator('button').filter({ hasText: /解析|开始|提取/ }).first();
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
      await submitBtn.click();
      this.logger.log('已点击解析按钮，等待结果...');

      // kukutool 解析需要较长时间，先等待结果区域出现
      await page
        .waitForSelector('video, a[href*=".mp4"], a[href*="xhscdn"], a[href*="douyinvod"], a[href*="365yg"]', {
          timeout: 20000,
        })
        .catch(() => {
          this.logger.warn('kukutool 未在 20s 内出现视频元素，继续尝试提取');
        });
      // 额外等待确保视频 source 标签加载完毕
      await page.waitForTimeout(3000);

      const videoFileUrl = await this.extractUrlFromPage(page);
      const coverUrl = await this.extractCoverFromPage(page);

      this.logger.log(
        `视频 URL 提取结果:\n` +
        `  视频URL: ${videoFileUrl ? videoFileUrl.substring(0, 200) : '未提取到'}\n` +
        `  封面URL: ${coverUrl ? coverUrl.substring(0, 200) : '未提取到'}`,
      );

      // 提取失败时截图留档以便排查
      if (!videoFileUrl) {
        const debugPath = `/tmp/kukutool-debug-${Date.now()}.png`;
        await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {});
        this.logger.warn(`视频 URL 提取失败，调试截图已保存: ${debugPath}`);
      }

      return { videoFileUrl, coverUrl };
    } catch (error) {
      this.logger.error(
        `视频 URL 提取失败: ${(error as Error).message}`,
      );
      return { videoFileUrl: null, coverUrl: null };
    } finally {
      await context.close().catch(() => {});
    }
  }

  // ─── 小红书页面数据抓取 ───

  private async scrapeXiaohongshu(page: Page): Promise<ScrapedVideoData> {
    await page
      .waitForSelector('[class*="note"]', { timeout: 10000 })
      .catch(() => {});

    return page.evaluate(() => {
      const getText = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || null;

      const parseCount = (text: string | null): number | null => {
        if (!text) return null;
        const cleaned = text.replace(/[^\d.万亿kKwWmM]/g, '');
        if (!cleaned) return null;
        let num = parseFloat(cleaned);
        if (/[万wW]/i.test(text)) num *= 10000;
        if (/[亿]/.test(text)) num *= 100000000;
        if (/[kK]/.test(text)) num *= 1000;
        if (/[mM]/.test(text) && !/万/.test(text)) num *= 1000000;
        return Math.round(num);
      };

      const title =
        getText('[class*="title"]') ||
        getText('#detail-title') ||
        getText('.note-content .title');

      const author =
        getText('[class*="author"] [class*="name"]') ||
        getText('.author-wrapper .username') ||
        getText('[class*="user-name"]');

      // 小红书互动数据通常按 点赞/收藏/评论/分享 顺序排列
      const interactionItems = document.querySelectorAll(
        '[class*="interact"] span, [class*="engage"] span, [class*="count"]',
      );
      const counts: number[] = [];
      interactionItems.forEach((el) => {
        const c = parseCount(el.textContent);
        if (c !== null) counts.push(c);
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

  // ─── 抖音页面数据抓取 ───

  private async scrapeDouyin(page: Page): Promise<ScrapedVideoData> {
    await page
      .waitForSelector('[class*="video"]', { timeout: 10000 })
      .catch(() => {});

    return page.evaluate(() => {
      const getText = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || null;

      const parseCount = (text: string | null): number | null => {
        if (!text) return null;
        const cleaned = text.replace(/[^\d.万亿kKwWmM]/g, '');
        if (!cleaned) return null;
        let num = parseFloat(cleaned);
        if (/[万wW]/i.test(text)) num *= 10000;
        if (/[亿]/.test(text)) num *= 100000000;
        if (/[kK]/.test(text)) num *= 1000;
        if (/[mM]/.test(text) && !/万/.test(text)) num *= 1000000;
        return Math.round(num);
      };

      const title =
        getText('[class*="title"]') || getText('[data-e2e="video-desc"]');
      const author =
        getText('[data-e2e="video-author"]') ||
        getText('[class*="author-name"]');

      return {
        title,
        author,
        likes: parseCount(
          document.querySelector('[data-e2e="digg-count"]')?.textContent ??
            null,
        ),
        collects: parseCount(
          document.querySelector('[data-e2e="collect-count"]')?.textContent ??
            null,
        ),
        comments: parseCount(
          document.querySelector('[data-e2e="comment-count"]')?.textContent ??
            null,
        ),
        shares: parseCount(
          document.querySelector('[data-e2e="share-count"]')?.textContent ??
            null,
        ),
      };
    });
  }

  // ─── kukutool 结果提取 ───

  /**
   * 从解析结果页面获取视频直链。
   * 优先尝试 <video> 标签的 src，其次查找含视频 CDN 域名的链接，
   * 最后回退到剪贴板和按钮交互。
   */
  private async extractUrlFromPage(page: Page): Promise<string | null> {
    try {
      // 策略 1: 从 <video> 或 <source> 标签直接获取
      // kukutool 通过 <source> 子元素加载视频，此时 video.src 为空但 currentSrc 有值
      const videoSrc = await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          if (video.currentSrc?.startsWith('http')) return video.currentSrc;
          if (video.src?.startsWith('http')) return video.src;
        }
        const source = document.querySelector('video source');
        if (source) {
          const src = source.getAttribute('src') || '';
          if (src.startsWith('http')) return src;
        }
        return null;
      });
      if (videoSrc) {
        this.logger.log(`从 <video> 标签提取到 URL`);
        return videoSrc;
      }

      // 策略 2: 扫描所有链接，匹配视频 CDN 域名或文件格式
      const linkUrl = await page.evaluate(() => {
        const videoDomainPatterns = [
          'douyinvod', 'xhscdn', 'snssdk', 'amemv', 'pstatp',
          'bytecdn', 'tiktokcdn', 'bytedance', 'feishu', '365yg',
        ];
        const links = Array.from(document.querySelectorAll('a[href]'));
        for (const el of links) {
          const href = el.getAttribute('href') || '';
          if (!href.startsWith('http')) continue;
          const isVideoUrl = href.includes('.mp4') || href.includes('.m3u8') ||
            videoDomainPatterns.some((d) => href.includes(d));
          if (isVideoUrl) return href;
        }
        return null;
      });
      if (linkUrl) {
        this.logger.log(`从页面链接提取到视频 URL`);
        return linkUrl;
      }

      // 策略 3: 点击"复制"按钮获取剪贴板内容
      const copyBtn = page
        .locator('button')
        .filter({ hasText: /复制/ })
        .first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        const clipText = await page
          .evaluate(() => navigator.clipboard.readText())
          .catch(() => null);
        if (clipText && /^https?:\/\//.test(clipText)) {
          this.logger.log(`从剪贴板提取到 URL`);
          return clipText;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /** 尝试从解析结果页面提取封面图 URL */
  private async extractCoverFromPage(page: Page): Promise<string | null> {
    try {
      return page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const src = img.src || '';
          if (
            src.includes('xhscdn') ||
            src.includes('douyinpic') ||
            src.includes('cover')
          )
            return src;
        }
        return null;
      });
    } catch {
      return null;
    }
  }

  /**
   * kukutool 会在页面加载后弹出"观看广告解锁"弹窗，
   * 遮挡输入框和解析按钮，必须先关闭才能正常操作。
   */
  private async dismissKukutoolAdDialog(page: Page): Promise<void> {
    try {
      // 弹窗通常在 JS 加载后延迟弹出，需要等待其出现
      const dialogLocator = page.locator('dialog, [role="dialog"]');
      await dialogLocator.waitFor({ state: 'visible', timeout: 5000 });
      this.logger.log('检测到 kukutool 弹窗，尝试关闭');

      // 弹窗内第一个按钮通常是"关闭"
      const closeBtn = dialogLocator.locator('button').first();
      await closeBtn.click();
      this.logger.log('已关闭 kukutool 广告弹窗');

      // 等待弹窗完全消失
      await dialogLocator.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    } catch {
      this.logger.log('未检测到 kukutool 广告弹窗，继续');
    }
  }
}
