'use client';

import { use, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useTaskSocket } from '@/hooks/use-task-socket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Clock, FileText, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const VIDEO_STATUS: Record<string, { label: string; icon: React.ReactNode }> = {
  PENDING: { label: '等待中', icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
  PROCESSING: { label: '处理中', icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> },
  COMPLETED: { label: '已完成', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
  FAILED: { label: '失败', icon: <XCircle className="h-4 w-4 text-destructive" /> },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [liveProgress, setLiveProgress] = useState<number | null>(null);
  const [currentVideo, setCurrentVideo] = useState<string>('');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => apiClient.get<any>(`/tasks/${id}`),
    // 处理中状态下定时轮询作为 WebSocket 的降级方案
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' ? 5000 : false;
    },
  });

  const onProgress = useCallback((data: { taskId: string; progress: number; currentVideoId: string; currentVideoTitle: string }) => {
    setLiveProgress(data.progress);
    setCurrentVideo(data.currentVideoTitle);
  }, []);

  const onVideoCompleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['task', id] });
  }, [queryClient, id]);

  const onVideoFailed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['task', id] });
  }, [queryClient, id]);

  const onTaskCompleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['task', id] });
    toast.success('任务已完成');
    setLiveProgress(null);
  }, [queryClient, id]);

  useTaskSocket(id, { onProgress, onVideoCompleted, onVideoFailed, onTaskCompleted });

  const [stopping, setStopping] = useState(false);
  const handleStopTask = async () => {
    setStopping(true);
    try {
      await apiClient.delete(`/tasks/${id}`);
      toast.success('任务已停止');
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    } catch (err: any) {
      toast.error(err?.message || '停止任务失败');
    } finally {
      setStopping(false);
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

  if (!task) return <p>任务不存在</p>;

  // WebSocket 实时进度优先，无实时数据时回退到 API 轮询值
  const displayProgress = liveProgress ?? task.progress;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-1 h-4 w-4" />返回列表
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{task.name}</h1>
        <Badge>{task.status}</Badge>
        {['PENDING', 'PROCESSING'].includes(task.status) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={stopping}>
                {stopping ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <StopCircle className="mr-1 h-4 w-4" />}
                停止任务
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认停止任务？</AlertDialogTitle>
                <AlertDialogDescription>
                  停止后，未完成的视频分析将被标记为失败。已完成的报告不受影响。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleStopTask}>确认停止</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={displayProgress} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{displayProgress}%</span>
            {currentVideo && task.status === 'PROCESSING' && (
              <span>正在分析: {currentVideo}</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <span className="text-sm text-muted-foreground">Skill</span>
              <p>{task.skillName}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">模型</span>
              <p>{task.modelName}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">创建者</span>
              <p>{task.createdBy}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">创建时间</span>
              <p>{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>视频处理状态</CardTitle>
        </CardHeader>
        <CardContent>
          {task.type === 'LINK' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>链接</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">点赞</TableHead>
                  <TableHead>报告</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.linkVideos?.map((lv: any) => {
                  const statusInfo = VIDEO_STATUS[lv.status] || VIDEO_STATUS.PENDING;
                  return (
                    <TableRow key={lv.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{lv.title || '未获取'}</div>
                        <div className="text-xs text-muted-foreground truncate">{lv.url}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {lv.platform === 'XIAOHONGSHU' ? '小红书' : '抖音'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{lv.likes ?? '-'}</TableCell>
                      <TableCell>
                        {lv.reportId ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/reports/${lv.reportId}`}>
                              <FileText className="mr-1 h-4 w-4" />查看报告
                            </Link>
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-xs truncate">{lv.error || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>视频</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>报告</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.videos?.map((v: any) => {
                  const statusInfo = VIDEO_STATUS[v.status] || VIDEO_STATUS.PENDING;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{v.videoTitle}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {v.reportId ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/reports/${v.reportId}`}>
                              <FileText className="mr-1 h-4 w-4" />查看报告
                            </Link>
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-xs truncate">{v.error || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
