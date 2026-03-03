'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

interface VideoReport {
  id: string;
  version: number;
  updatedAt: string;
}

interface VideoDetail {
  id: string;
  title: string;
  fileName: string;
  ossUrl: string;
  fileSize: number;
  duration: number | null;
  bucketName: string;
  uploadedBy: string;
  reports: VideoReport[];
  createdAt: string;
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: video, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: () => apiClient.get<VideoDetail>(`/videos/${id}`),
  });

  const handleDownload = async () => {
    try {
      const { url } = await apiClient.get<{ url: string }>(
        `/videos/${id}/download-url`
      );
      window.open(url, '_blank');
    } catch {
      toast.error('获取下载链接失败');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!video) return <p>视频不存在</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/videos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回列表
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{video.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>视频信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">文件名</span>
            <p>{video.fileName}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">大小</span>
            <p>{formatFileSize(video.fileSize)}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">存储桶</span>
            <p>{video.bucketName}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">上传者</span>
            <p>{video.uploadedBy}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">时长</span>
            <p>{video.duration ? `${video.duration}s` : '未知'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">上传时间</span>
            <p>{new Date(video.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div className="col-span-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              下载视频
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h2 className="text-xl font-semibold mb-4">分析报告</h2>
        {video.reports && video.reports.length > 0 ? (
          <div className="space-y-2">
            {video.reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">版本 {report.version}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/reports/${report.id}`}>
                      查看报告
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            暂无分析报告。请在"解析任务"中创建任务来生成报告。
          </p>
        )}
      </div>
    </div>
  );
}
