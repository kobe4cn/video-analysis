'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle2, AlertCircle, FileVideo } from 'lucide-react';
import { toast } from 'sonner';

// ─── 类型 ───

interface BucketOption {
  id: string;
  name: string;
  ossConfigName: string;
  isDefault: boolean;
}

interface FileItem {
  id: string;
  file: File;
  title: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface UploadTokenResponse {
  signedUrl: string;
  key: string;
  bucketId: string;
  contentType: string;
}

interface VideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── 工具函数 ───

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ─── 组件 ───

export function VideoUploadDialog({ open, onOpenChange }: VideoUploadDialogProps) {
  const [bucketId, setBucketId] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef<Map<string, XMLHttpRequest>>(new Map());
  const queryClient = useQueryClient();

  const { data: buckets } = useQuery({
    queryKey: ['oss-buckets'],
    queryFn: () => apiClient.get<BucketOption[]>('/oss-buckets'),
    enabled: open,
  });

  // 打开时预选默认 Bucket，关闭时重置状态
  useEffect(() => {
    if (open && buckets) {
      const defaultBucket = buckets.find((b) => b.isDefault);
      if (defaultBucket && !bucketId) setBucketId(defaultBucket.id);
    }
    if (!open) {
      setFiles([]);
      setBucketId('');
    }
  }, [open, buckets]);

  // ─── 文件管理 ───

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newItems: FileItem[] = selected.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''),
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<FileItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // ─── 单文件上传 ───

  const uploadSingleFile = async (item: FileItem): Promise<boolean> => {
    updateFile(item.id, { status: 'uploading', progress: 0 });

    try {
      // 1. 向后端请求签名上传 URL
      const tokenData = await apiClient.post<UploadTokenResponse>(
        '/videos/upload-token',
        {
          fileName: item.file.name,
          fileSize: item.file.size,
          bucketId,
          contentType: item.file.type || 'application/octet-stream',
        },
      );

      // 2. 通过签名 URL 直传文件到 OSS
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        abortControllers.current.set(item.id, xhr);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            updateFile(item.id, { progress: Math.min(pct, 99) });
          }
        });
        xhr.addEventListener('load', () => {
          abortControllers.current.delete(item.id);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`OSS 返回 ${xhr.status}，请检查 Bucket 权限`));
          }
        });
        xhr.addEventListener('error', () => {
          abortControllers.current.delete(item.id);
          reject(new Error('网络错误，请检查 Bucket 的 CORS 配置是否允许浏览器上传'));
        });
        xhr.addEventListener('abort', () => {
          abortControllers.current.delete(item.id);
          reject(new Error('上传已取消'));
        });

        xhr.open('PUT', tokenData.signedUrl);
        xhr.setRequestHeader('Content-Type', tokenData.contentType);
        xhr.send(item.file);
      });

      // 3. 通知后端创建视频记录
      await apiClient.post('/videos/complete', {
        ossKey: tokenData.key,
        fileName: item.file.name,
        title: item.title || item.file.name,
        fileSize: item.file.size,
        bucketId: tokenData.bucketId,
      });

      updateFile(item.id, { status: 'done', progress: 100 });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '上传失败';
      updateFile(item.id, { status: 'error', error: errorMsg });
      return false;
    }
  };

  // ─── 批量上传 ───

  const handleUploadAll = async () => {
    if (!bucketId) {
      toast.error('请先选择目标 Bucket');
      return;
    }

    setUploading(true);
    const pending = files.filter((f) => f.status === 'pending' || f.status === 'error');
    let successCount = 0;

    for (const item of pending) {
      const ok = await uploadSingleFile(item);
      if (ok) successCount++;
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ['videos'] });

    if (successCount === pending.length) {
      toast.success(`${successCount} 个视频全部上传成功`);
      onOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(`${successCount}/${pending.length} 个视频上传成功，部分失败`);
    } else {
      toast.error('上传失败，请检查网络连接或 Bucket 配置');
    }
  };

  const handleClose = () => {
    if (uploading) return;
    onOpenChange(false);
  };

  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'error').length;

  // ─── 渲染 ───

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>上传视频</DialogTitle>
          <DialogDescription>
            选择目标 Bucket 并添加视频文件，支持同时上传多个视频
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Bucket 选择器 */}
          <div>
            <Label>目标 Bucket</Label>
            {buckets?.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                暂无可用 Bucket，请先在存储管理中配置
              </p>
            ) : (
              <Select value={bucketId} onValueChange={setBucketId} disabled={uploading}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="选择 Bucket" />
                </SelectTrigger>
                <SelectContent>
                  {buckets?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.isDefault && ' (默认)'}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {b.ossConfigName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 文件选择区域 */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleFilesSelect}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="outline"
              className="w-full h-20 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  点击选择视频文件（支持多选）
                </span>
              </div>
            </Button>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              {files.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <FileVideo className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {item.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    {/* 待上传：可编辑标题 */}
                    {item.status === 'pending' && (
                      <Input
                        value={item.title}
                        onChange={(e) => updateFile(item.id, { title: e.target.value })}
                        placeholder="视频标题"
                        className="h-7 text-sm"
                      />
                    )}

                    {/* 上传中：进度条 */}
                    {item.status === 'uploading' && (
                      <div className="space-y-1">
                        <Progress value={item.progress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          上传中 {item.progress}%
                        </p>
                      </div>
                    )}

                    {/* 完成 */}
                    {item.status === 'done' && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        上传成功
                      </div>
                    )}

                    {/* 失败 */}
                    {item.status === 'error' && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {item.error}
                      </div>
                    )}
                  </div>

                  {/* 移除按钮（上传完成或上传中不可移除） */}
                  {!uploading && item.status !== 'done' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 w-7 p-0"
                      onClick={() => removeFile(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              取消
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={uploading || !bucketId || pendingCount === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading
                ? '上传中...'
                : pendingCount > 0
                  ? `开始上传 (${pendingCount})`
                  : '开始上传'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
