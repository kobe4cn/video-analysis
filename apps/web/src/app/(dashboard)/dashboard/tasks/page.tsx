'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Eye, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '等待中', variant: 'secondary' },
  PROCESSING: { label: '处理中', variant: 'default' },
  COMPLETED: { label: '已完成', variant: 'outline' },
  PARTIAL: { label: '部分完成', variant: 'outline' },
  FAILED: { label: '失败', variant: 'destructive' },
};

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page],
    queryFn: () => apiClient.get<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/tasks?page=${page}&pageSize=20`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success('任务已取消');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setCancelId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">解析任务</h1>
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />创建任务
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>进度</TableHead>
                <TableHead>视频数</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items?.map((task) => {
                const statusInfo = STATUS_MAP[task.status] || { label: task.status, variant: 'secondary' as const };
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="w-32">
                      <Progress value={task.progress} className="h-2" />
                    </TableCell>
                    <TableCell>{task.videoCount}</TableCell>
                    <TableCell>{task.skillName}</TableCell>
                    <TableCell>{task.modelName}</TableCell>
                    <TableCell>{new Date(task.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/tasks/${task.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {task.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelId(task.id)}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data?.items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暂无任务
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                第 {page} / {data.totalPages} 页
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认取消</DialogTitle>
            <DialogDescription>确定取消该任务？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>返回</Button>
            <Button variant="destructive" onClick={() => cancelId && cancelMutation.mutate(cancelId)}>
              取消任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
