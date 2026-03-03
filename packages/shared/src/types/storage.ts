export interface OssConfigItem {
  id: string;
  name: string;
  provider: string;
  region: string;
  bucketCount: number;
  createdAt: string;
}

export interface CreateOssConfigRequest {
  name: string;
  provider?: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
}

export interface UpdateOssConfigRequest {
  name?: string;
  region?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
}

export interface OssBucketItem {
  id: string;
  name: string;
  ossConfigId: string;
  ossConfigName: string;
  isDefault: boolean;
  videoCount: number;
  createdAt: string;
}

export interface CreateOssBucketRequest {
  name: string;
  ossConfigId: string;
  isDefault?: boolean;
}
