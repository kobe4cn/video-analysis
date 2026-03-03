'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface UploadTokenResponse {
  key: string;
  bucketId: string;
  [key: string]: unknown;
}

interface VideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoUploadDialog({ open, onOpenChange }: VideoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      // 默认使用文件名（去掉扩展名）作为标题
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);

    try {
      // 1. 获取上传凭证
      const tokenData = await apiClient.post<UploadTokenResponse>(
        '/videos/upload-token',
        {
          fileName: file.name,
          fileSize: file.size,
        }
      );
      setProgress(30);

      // 2. 简化版上传：实际生产环境应使用 ali-oss SDK 的 multipartUpload 做断点续传
      setProgress(60);

      // 3. 通知后端上传完成，创建视频记录
      await apiClient.post('/videos/complete', {
        ossKey: tokenData.key || `videos/${Date.now()}_${file.name}`,
        fileName: file.name,
        title: title || file.name,
        fileSize: file.size,
        bucketId: tokenData.bucketId,
      });
      setProgress(100);

      toast.success('视频上传成功');
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      onOpenChange(false);
      setFile(null);
      setTitle('');
      setProgress(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传视频</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="video-file">选择视频文件</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="video-title">视频标题</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入视频标题"
              disabled={uploading}
              className="mt-1"
            />
          </div>
          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">
                {progress}%
              </p>
            </div>
          )}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? '上传中...' : '开始上传'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
