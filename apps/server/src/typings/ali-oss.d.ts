declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket?: string;
    stsToken?: string;
    secure?: boolean;
    timeout?: number;
  }

  interface SignatureUrlOptions {
    expires?: number;
    method?: string;
    process?: string;
    response?: Record<string, string>;
  }

  class OSS {
    constructor(options: OSSOptions);
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
    delete(name: string): Promise<{ res: any }>;
    put(name: string, file: any, options?: any): Promise<any>;
    get(name: string, file?: any, options?: any): Promise<any>;

    // Bucket 级别操作
    putBucket(
      name: string,
      options?: { StorageClass?: string; timeout?: number },
    ): Promise<{ bucket: string; res: any }>;
    deleteBucket(name: string): Promise<{ res: any }>;
    putBucketACL(
      name: string,
      acl: 'private' | 'public-read' | 'public-read-write',
    ): Promise<any>;
    getBucketInfo(name: string): Promise<{ bucket: any; res: any }>;
    listBuckets(
      query?: { prefix?: string; marker?: string; 'max-keys'?: number },
    ): Promise<{ buckets: Array<{ name: string; region: string; creationDate: string }> | null; res: any }>;
  }

  export default OSS;
}
