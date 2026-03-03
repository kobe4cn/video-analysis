'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, History, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hasRole = useAuthStore((s) => s.hasRole);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // 获取当前报告
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => apiClient.get<any>(`/reports/${id}`),
  });

  // 获取版本列表
  const { data: versions } = useQuery({
    queryKey: ['report-versions', id],
    queryFn: () => apiClient.get<any[]>(`/reports/${id}/versions`),
  });

  // 获取选中的历史版本内容
  const { data: versionDetail } = useQuery({
    queryKey: ['report-version', id, selectedVersionId],
    queryFn: () => apiClient.get<any>(`/reports/${id}/versions/${selectedVersionId}`),
    enabled: !!selectedVersionId,
  });

  // 提交报告修订
  const reviseMutation = useMutation({
    mutationFn: (body: { additionalRequirements: string }) => apiClient.post(`/reports/${id}/revise`, body),
    onSuccess: () => {
      toast.success('报告修复请求已提交，请在解析任务中查看进度');
      setReviseOpen(false);
      setAdditionalRequirements('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // 当前展示的内容：选中历史版本时用版本内容，否则用最新报告
  const displayContent = selectedVersionId && versionDetail ? versionDetail.content : report?.content;
  const displayVersion = selectedVersionId && versionDetail ? versionDetail.version : report?.version;

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!report) return <p>报告不存在</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/videos/${report.videoId}`}><ArrowLeft className="mr-1 h-4 w-4" />返回视频</Link>
        </Button>
        <h1 className="text-2xl font-bold">{report.videoTitle} - 分析报告</h1>
        <Badge variant="outline">
          {selectedVersionId ? `v${displayVersion} (历史)` : `v${report.version} (最新)`}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        {/* 版本选择器：让用户在不同报告版本之间切换 */}
        {versions && versions.length > 0 && (
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedVersionId || 'latest'}
              onValueChange={(val) => setSelectedVersionId(val === 'latest' ? null : val)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择版本" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">最新 (v{report.version})</SelectItem>
                {versions.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>v{v.version} - {new Date(v.createdAt).toLocaleDateString('zh-CN')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 仅 OPERATOR 及以上角色可修复报告，且仅在查看最新版本时显示 */}
        {hasRole('OPERATOR') && !selectedVersionId && (
          <Button variant="outline" onClick={() => setReviseOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />修复报告
          </Button>
        )}
      </div>

      {/* 报告正文：渲染 Markdown 格式的分析内容 */}
      <Card>
        <CardContent className="report-content prose prose-neutral max-w-none py-8 px-8 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayContent || '暂无内容'}
          </ReactMarkdown>
        </CardContent>
      </Card>

      {/* 修复报告对话框：用户提交额外要求后触发后端重新分析 */}
      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>修复报告</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              系统将基于当前报告内容和您的额外要求，结合最新的 Skill 重新分析视频并生成新版本报告。
            </p>
            <div>
              <Label>额外的分析要求</Label>
              <Textarea
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                placeholder="请输入您希望补充或修正的分析要求..."
                rows={6}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviseOpen(false)}>取消</Button>
            <Button
              onClick={() => reviseMutation.mutate({ additionalRequirements })}
              disabled={!additionalRequirements.trim() || reviseMutation.isPending}
            >
              {reviseMutation.isPending ? '提交中...' : '提交修复'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
