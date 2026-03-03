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
  }

  export default OSS;
}
