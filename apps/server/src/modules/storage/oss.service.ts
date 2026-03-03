import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';

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
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const key = `videos/${uuidv4()}${ext}`;

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
    return `https://${bucket.name}.${region}.aliyuncs.com/${ossKey}`;
  }

  /** 将本地文件上传到 OSS，返回 ossKey 和公开访问 URL */
  async uploadFile(bucketId: string, fileName: string, filePath: string) {
    const { client } = await this.getClient(bucketId);
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const key = `videos/${uuidv4()}${ext}`;
    await client.put(key, filePath);
    this.logger.log(`文件已上传到 OSS: ${key}`);
    const ossUrl = await this.getPublicUrl(bucketId, key);
    return { key, ossUrl };
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
