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

  /** 抓取视频页面的互动数据 */
  async scrapeVideoData(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ScrapedVideoData> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
      return platform === 'XIAOHONGSHU'
        ? await this.scrapeXiaohongshu(page)
        : await this.scrapeDouyin(page);
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
      await page.close();
    }
  }

  /** 通过 kukutool 第三方解析服务提取视频 MP4 URL */
  async extractVideoFileUrl(
    url: string,
    platform: 'XIAOHONGSHU' | 'DOUYIN',
  ): Promise<ExtractedVideoUrl> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      const kukuUrl =
        platform === 'XIAOHONGSHU'
          ? 'https://dy.kukutool.com/xiaohongshu'
          : 'https://dy.kukutool.com';
      await page.goto(kukuUrl, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      const input = page
        .locator('input[type="text"], input[type="url"], input[placeholder]')
        .first();
      await input.fill(url);

      const submitBtn = page
        .locator('button')
        .filter({ hasText: /解析|开始|提取/ })
        .first();
      await submitBtn.click();

      // kukutool 解析需要一定时间，等待结果渲染
      await page.waitForTimeout(8000);

      const videoFileUrl = await this.extractUrlFromPage(page);
      const coverUrl = await this.extractCoverFromPage(page);
      return { videoFileUrl, coverUrl };
    } catch (error) {
      this.logger.error(
        `视频 URL 提取失败: ${(error as Error).message}`,
      );
      return { videoFileUrl: null, coverUrl: null };
    } finally {
      await page.close();
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

  /** 尝试从解析结果页面获取视频直链：先尝试剪贴板复制，再回退到 DOM 查找 */
  private async extractUrlFromPage(page: Page): Promise<string | null> {
    try {
      const copyBtn = page
        .locator('button')
        .filter({ hasText: /复制/ })
        .first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        const clipText = await page
          .evaluate(() => navigator.clipboard.readText())
          .catch(() => null);
        if (
          clipText &&
          (clipText.includes('.mp4') || /^https?:\/\//.test(clipText))
        )
          return clipText;
      }

      return page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('a[href], video source'),
        );
        for (const el of links) {
          const href = el.getAttribute('href') || el.getAttribute('src') || '';
          if (
            href.includes('.mp4') ||
            href.includes('douyinvod') ||
            href.includes('xhscdn')
          )
            return href;
        }
        return null;
      });
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
}
