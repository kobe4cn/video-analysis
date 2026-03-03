'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Download, Trash2, Eye, FileText, Video } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { VideoUploadDialog } from '@/components/video/video-upload-dialog';
import { EmptyState } from '@/components/empty-state';
import { QueryError } from '@/components/query-error';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

interface VideoItem {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  hasReport: boolean;
  latestReportId?: string;
  createdAt: string;
}

interface VideosResponse {
  items: VideoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function VideosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((s) => s.hasRole);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['videos', page, search],
    queryFn: () =>
      apiClient.get<VideosResponse>(
        `/videos?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/videos/${id}`),
    onSuccess: () => {
      toast.success('视频已删除');
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDownload = async (id: string) => {
    try {
      const { url } = await apiClient.get<{ url: string }>(
        `/videos/${id}/download-url`
      );
      window.open(url, '_blank');
    } catch {
      toast.error('获取下载链接失败');
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">视频管理</h1>
        {hasRole('OPERATOR') && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            上传视频
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="搜索视频..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-sm"
        />
        <Button variant="secondary" onClick={handleSearch}>
          搜索
        </Button>
      </div>

      {isError ? (
        <QueryError error={error} retry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>上传者</TableHead>
                <TableHead>报告</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items?.map((video) => (
                <TableRow key={video.id}>
                  <TableCell className="font-medium">{video.title}</TableCell>
                  <TableCell>{formatFileSize(video.fileSize)}</TableCell>
                  <TableCell>{video.uploadedBy}</TableCell>
                  <TableCell>
                    {video.hasReport ? (
                      <Link
                        href={`/dashboard/reports/${video.latestReportId}`}
                      >
                        <Badge variant="default">
                          <FileText className="mr-1 h-3 w-3" />
                          已生成
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="secondary">暂无</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(video.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/videos/${video.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(video.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {hasRole('OPERATOR') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(video.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Video}
                      title="暂无视频"
                      description="上传视频后即可在此处管理和查看"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                第 {page} / {data.totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      {/* 上传对话框 */}
      <VideoUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后视频文件和关联数据将无法恢复，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
