import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OssService {
  constructor(private prisma: PrismaService) {}

  // 每次操作动态构建 OSS Client，确保始终使用数据库中最新的配置
  private async getClient(
    bucketId: string,
  ): Promise<{ client: OSS; bucket: any; config: any }> {
    const bucket = await this.prisma.ossBucket.findUniqueOrThrow({
      where: { id: bucketId },
      include: { ossConfig: true },
    });

    const client = new OSS({
      region: bucket.ossConfig.region,
      accessKeyId: bucket.ossConfig.accessKeyId,
      accessKeySecret: bucket.ossConfig.accessKeySecret,
      bucket: bucket.name,
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
    return `https://${bucket.name}.${bucket.ossConfig.region}.aliyuncs.com/${ossKey}`;
  }

  async deleteObject(bucketId: string, ossKey: string): Promise<void> {
    const { client } = await this.getClient(bucketId);
    await client.delete(ossKey);
  }
}
