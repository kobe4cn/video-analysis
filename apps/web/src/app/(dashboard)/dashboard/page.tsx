'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, ListTodo, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { QueryError } from '@/components/query-error';
import { useAuthStore } from '@/stores/auth-store';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '等待中', variant: 'secondary' },
  PROCESSING: { label: '处理中', variant: 'default' },
  COMPLETED: { label: '已完成', variant: 'outline' },
  PARTIAL: { label: '部分完成', variant: 'outline' },
  FAILED: { label: '失败', variant: 'destructive' },
};

export default function DashboardPage() {
  const hasRole = useAuthStore((s) => s.hasRole);
  const isOperator = hasRole('OPERATOR');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get<any>('/dashboard/stats'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <QueryError error={error} retry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* 统计卡片：根据角色展示不同指标，USER 仅看视频和报告 */}
      <div className={`grid gap-4 ${isOperator ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">视频总数</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.videoCount || 0}</p></CardContent>
        </Card>
        {isOperator && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">任务总数</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{data?.taskCount || 0}</p></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">报告总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.reportCount || 0}</p></CardContent>
        </Card>
        {isOperator && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">活跃 Skills</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{data?.skillCount || 0}</p></CardContent>
          </Card>
        )}
      </div>

      {/* 最近活动：根据角色展示不同内容 */}
      <div className={`grid gap-6 ${isOperator ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
        {/* 最近任务：仅 OPERATOR 及以上角色可见 */}
        {isOperator && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                最近任务
                <Link href="/dashboard/tasks" className="text-sm text-muted-foreground hover:underline">查看全部</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.recentTasks?.length === 0 && <p className="text-sm text-muted-foreground">暂无任务</p>}
              {data?.recentTasks?.map((task: any) => {
                const statusInfo = STATUS_MAP[task.status] || { label: task.status, variant: 'secondary' as const };
                return (
                  <Link key={task.id} href={`/dashboard/tasks/${task.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                    <div>
                      <p className="font-medium text-sm">{task.name}</p>
                      <p className="text-xs text-muted-foreground">{task.skillName} · {task.videoCount} 视频</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={task.progress} className="w-16 h-2" />
                      <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* 最近报告 */}
        <Card>
          <CardHeader>
            <CardTitle>最近报告</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recentReports?.length === 0 && <p className="text-sm text-muted-foreground">暂无报告</p>}
            {data?.recentReports?.map((report: any) => (
              <Link key={report.id} href={`/dashboard/reports/${report.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                <div>
                  <p className="font-medium text-sm">{report.videoTitle}</p>
                  <p className="text-xs text-muted-foreground">{new Date(report.updatedAt).toLocaleString('zh-CN')}</p>
                </div>
                <Badge variant="outline">v{report.version}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
