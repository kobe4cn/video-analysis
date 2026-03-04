import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';

@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 数据库中 region 可能存为 "cn-shanghai" 或 "oss-cn-shanghai"，
   * ali-oss SDK 要求 "oss-" 前缀才能正确拼接 endpoint。
   */
  private normalizeRegion(region: string): string {
    return region.startsWith('oss-') ? region : `oss-${region}`;
  }

  // 每次操作动态构建 OSS Client，确保始终使用数据库中最新的配置
  private async getClient(
    bucketId: string,
  ): Promise<{ client: OSS; bucket: any; config: any }> {
    const bucket = await this.prisma.ossBucket.findUniqueOrThrow({
      where: { id: bucketId },
      include: { ossConfig: true },
    });

    const client = new OSS({
      region: this.normalizeRegion(bucket.ossConfig.region),
      accessKeyId: bucket.ossConfig.accessKeyId,
      accessKeySecret: bucket.ossConfig.accessKeySecret,
      bucket: bucket.name,
      secure: true,
    });

    return { client, bucket, config: bucket.ossConfig };
  }

  /**
   * 生成签名 PUT URL 供前端直传 OSS。
   * 不再向前端暴露 AK/SK，而是返回已签名的一次性 URL。
   */
  async generateSignedUploadUrl(
    bucketId: string,
    fileName: string,
    contentType?: string,
  ) {
    const { client, bucket } = await this.getClient(bucketId);
    const safe = fileName.replace(/[?#&\\]/g, '_');
    const key = `videos/${uuidv4()}_${safe}`;

    const signedUrl = client.signatureUrl(key, {
      method: 'PUT',
      expires: 3600,
      'content-type': contentType || 'application/octet-stream',
    });

    return {
      signedUrl,
      key,
      bucketId: bucket.id,
      contentType: contentType || 'application/octet-stream',
    };
  }

  // 生成带签名的临时下载 URL，有效期 1 小时
  async getSignedUrl(bucketId: string, ossKey: string): Promise<string> {
    const { client } = await this.getClient(bucketId);
    const url = client.signatureUrl(ossKey, { expires: 3600 });
    return url;
  }

  // 拼接公开访问 URL，适用于 Bucket 已开放公共读权限的场景
  async getPublicUrl(bucketId: string, ossKey: string): Promise<string> {
    const bucket = await this.prisma.ossBucket.findUniqueOrThrow({
      where: { id: bucketId },
      include: { ossConfig: true },
    });
    const region = this.normalizeRegion(bucket.ossConfig.region);
    // 保持原始中文路径，浏览器和 OSS 均能正确处理未编码的 Unicode URL
    return `https://${bucket.name}.${region}.aliyuncs.com/${ossKey}`;
  }

  /** 将本地文件上传到 OSS，folderPath 用于在 videos/ 下创建子目录结构 */
  async uploadFile(bucketId: string, fileName: string, filePath: string, folderPath?: string) {
    const { client } = await this.getClient(bucketId);
    const key = folderPath
      ? `videos/${folderPath}/${fileName}`
      : `videos/${fileName}`;
    await client.put(key, filePath);
    this.logger.log(`文件已上传到 OSS: ${key}`);
    const ossUrl = await this.getPublicUrl(bucketId, key);
    return { key, ossUrl };
  }

  /**
   * 从远程 URL 下载视频文件并上传到 OSS。
   * 直接使用 curl 下载：CDN（365yg / xhscdn）通过 TLS 指纹识别 Node.js fetch 并返回 403，
   * 而 curl 使用系统 OpenSSL/LibreSSL，TLS 指纹不会被拦截。
   */
  async downloadAndUpload(
    bucketId: string,
    sourceUrl: string,
    fileName?: string,
  ): Promise<{ key: string; ossUrl: string }> {
    const tmpDir = path.join(os.tmpdir(), 'link-video-downloads');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const safeName = fileName || `${uuidv4()}.mp4`;
    const tmpPath = path.join(tmpDir, safeName);

    try {
      this.logger.log(`开始下载视频: ${sourceUrl.substring(0, 200)}`);

      await new Promise<void>((resolve, reject) => {
        execFile('curl', [
          '-L',               // 跟随重定向
          '-f',               // HTTP 错误时返回非零退出码
          '-s', '-S',         // 静默但出错时显示信息
          '--connect-timeout', '15',
          '--max-time', '180',
          '-o', tmpPath,
          sourceUrl,
        ], { maxBuffer: 10 * 1024 }, (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(`curl 下载失败: ${stderr || error.message}`));
          } else {
            resolve();
          }
        });
      });

      const fileSize = fs.statSync(tmpPath).size;
      if (fileSize === 0) {
        throw new Error('下载到的文件大小为 0，可能链接已失效');
      }
      this.logger.log(`视频已下载: ${tmpPath} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

      const result = await this.uploadFile(bucketId, safeName, tmpPath, 'link-videos');
      this.logger.log(`视频已上传到 OSS: ${result.key}, URL: ${result.ossUrl}`);
      return result;
    } catch (error) {
      this.logger.error(
        `视频下载上传失败: ${(error as Error).message}\n  源URL: ${sourceUrl.substring(0, 200)}`,
      );
      throw error;
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }

  /** 获取系统默认 Bucket，用于链接视频等无需用户指定 Bucket 的场景 */
  async getDefaultBucket(): Promise<{ id: string; name: string } | null> {
    const bucket = await this.prisma.ossBucket.findFirst({
      where: { isDefault: true },
    });
    return bucket ? { id: bucket.id, name: bucket.name } : null;
  }

  async deleteObject(bucketId: string, ossKey: string): Promise<void> {
    const { client } = await this.getClient(bucketId);
    await client.delete(ossKey);
  }

  // ─── Bucket 管理操作 ───

  /**
   * 根据 OssConfig ID 构建不绑定任何 Bucket 的 OSS Client。
   * 用于 Bucket 级别的管理操作（创建/删除），此时 Bucket 可能尚不存在。
   */
  async getClientByConfigId(configId: string): Promise<OSS> {
    const config = await this.prisma.ossConfig.findUniqueOrThrow({
      where: { id: configId },
    });

    return new OSS({
      region: this.normalizeRegion(config.region),
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      secure: true,
    });
  }

  /** 在阿里云上创建 Bucket（使用默认 ACL，即 private） */
  async createBucket(configId: string, bucketName: string): Promise<void> {
    const client = await this.getClientByConfigId(configId);
    await client.putBucket(bucketName);
    this.logger.log(`Bucket "${bucketName}" 已在阿里云上创建`);
  }

  /** 列出阿里云账号下所有 Bucket，用于展示已有远程 Bucket 供用户关联 */
  async listRemoteBuckets(
    configId: string,
  ): Promise<Array<{ name: string; region: string; creationDate: string }>> {
    const client = await this.getClientByConfigId(configId);
    const result = await client.listBuckets();
    return result.buckets ?? [];
  }

  /** 在阿里云上删除 Bucket（Bucket 必须为空，否则阿里云会拒绝） */
  async removeBucket(configId: string, bucketName: string): Promise<void> {
    const client = await this.getClientByConfigId(configId);
    await client.deleteBucket(bucketName);
    this.logger.log(`Bucket "${bucketName}" 已从阿里云删除`);
  }

  /** 为 Bucket 配置 CORS 规则，允许浏览器直传文件 */
  async configureBucketCors(bucketId: string): Promise<void> {
    const { client, bucket } = await this.getClient(bucketId);
    try {
      await client.putBucketCORS(bucket.name, [
        {
          allowedOrigin: '*',
          allowedMethod: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
          allowedHeader: '*',
          exposeHeader: ['ETag', 'x-oss-request-id'],
          maxAgeSeconds: 3600,
        },
      ]);
      this.logger.log(`Bucket "${bucket.name}" CORS 规则已配置`);
    } catch (error) {
      this.logger.warn(
        `Bucket "${bucket.name}" CORS 配置失败（可能需要手动配置）: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
