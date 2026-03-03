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

  // 生成临时上传凭证，返回前端直传 OSS 所需的全部参数
  // 注意：完整的 STS 需要阿里云 RAM 角色配置，这里简化为直接返回 AK（生产环境应使用 STS）
  async generateUploadToken(bucketId: string, fileName: string) {
    const bucket = await this.prisma.ossBucket.findUniqueOrThrow({
      where: { id: bucketId },
      include: { ossConfig: true },
    });

    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const key = `videos/${uuidv4()}${ext}`;

    return {
      accessKeyId: bucket.ossConfig.accessKeyId,
      accessKeySecret: bucket.ossConfig.accessKeySecret,
      securityToken: '',
      region: bucket.ossConfig.region,
      bucket: bucket.name,
      key,
      expiration: new Date(Date.now() + 3600 * 1000).toISOString(),
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
}
