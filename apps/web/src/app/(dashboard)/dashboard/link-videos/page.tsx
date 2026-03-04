'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Link2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { QueryError } from '@/components/query-error';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '等待中', variant: 'secondary' },
  SCRAPING: { label: '抓取中', variant: 'default' },
  ANALYZING: { label: '分析中', variant: 'default' },
  COMPLETED: { label: '已完成', variant: 'outline' },
  FAILED: { label: '失败', variant: 'destructive' },
};

const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  XIAOHONGSHU: { label: '小红书', color: 'text-red-500' },
  DOUYIN: { label: '抖音', color: 'text-blue-500' },
};

export default function LinkVideosPage() {
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['link-videos', page, platform, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (platform) params.set('platform', platform);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get<any>(`/link-videos?${params.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/link-videos/${id}`),
    onSuccess: () => {
      toast.success('链接视频已删除');
      queryClient.invalidateQueries({ queryKey: ['link-videos'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatCount = (count: number | null) => {
    if (count === null || count === undefined) return '-';
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    return String(count);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">链接视频</h1>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索标题、URL 或博主..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={platform || 'all'} onValueChange={(v) => { setPlatform(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            <SelectItem value="XIAOHONGSHU">小红书</SelectItem>
            <SelectItem value="DOUYIN">抖音</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="PENDING">等待中</SelectItem>
            <SelectItem value="SCRAPING">抓取中</SelectItem>
            <SelectItem value="ANALYZING">分析中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <QueryError error={error} retry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台</TableHead>
                  <TableHead>标题 / URL</TableHead>
                  <TableHead>博主</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">点赞</TableHead>
                  <TableHead className="text-right">收藏</TableHead>
                  <TableHead className="text-right">评论</TableHead>
                  <TableHead>报告</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items?.map((lv: any) => {
                  const statusInfo = STATUS_MAP[lv.status] || { label: lv.status, variant: 'secondary' as const };
                  const platformInfo = PLATFORM_MAP[lv.platform] || { label: lv.platform, color: '' };
                  return (
                    <TableRow key={lv.id}>
                      <TableCell><span className={`font-medium ${platformInfo.color}`}>{platformInfo.label}</span></TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{lv.title || '未获取'}</div>
                        <a href={lv.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline truncate block">{lv.url}</a>
                      </TableCell>
                      <TableCell>{lv.author || '-'}</TableCell>
                      <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                      <TableCell className="text-right">{formatCount(lv.likes)}</TableCell>
                      <TableCell className="text-right">{formatCount(lv.collects)}</TableCell>
                      <TableCell className="text-right">{formatCount(lv.comments)}</TableCell>
                      <TableCell>
                        {lv.reportCount > 0
                          ? <Badge variant="outline" className="text-green-600">{lv.reportCount} 份</Badge>
                          : <span className="text-muted-foreground text-sm">暂无</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(lv.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data?.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState icon={Link2} title="暂无链接视频" description="通过创建链接任务来添加视频链接" />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="flex items-center text-sm text-muted-foreground">第 {page} / {data.totalPages} 页</span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定删除该链接视频记录？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
