export interface VideoItem {
  id: string;
  title: string;
  fileName: string;
  ossUrl: string;
  fileSize: number;
  duration: number | null;
  bucketId: string;
  uploadedBy: string;
  hasReport: boolean;
  latestReportId: string | null;
  createdAt: string;
}

export interface UploadTokenRequest {
  fileName: string;
  fileSize: number;
  bucketId?: string;
}

export interface UploadTokenResponse {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  region: string;
  bucket: string;
  key: string;
  expiration: string;
}

export interface UploadCompleteRequest {
  ossKey: string;
  fileName: string;
  title: string;
  fileSize: number;
  bucketId: string;
  duration?: number;
}
