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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface SkillItem {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

interface SkillsResponse {
  items: SkillItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function SkillsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', content: '' });
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((s) => s.hasRole);

  const { data, isLoading } = useQuery({
    queryKey: ['skills', page, search],
    queryFn: () =>
      apiClient.get<SkillsResponse>(
        `/skills?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`
      ),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string; content: string }) =>
      apiClient.post('/skills', body),
    onSuccess: () => {
      toast.success('Skill 创建成功');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setCreateOpen(false);
      setForm({ name: '', description: '', content: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/skills/${id}`),
    onSuccess: () => {
      toast.success('Skill 已删除');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skills 管理</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          创建 Skill
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="搜索 Skill..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-sm"
        />
        <Button variant="secondary" onClick={handleSearch}>
          搜索
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
                <TableHead>描述</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items?.map((skill) => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {skill.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{skill.version}</Badge>
                  </TableCell>
                  <TableCell>
                    {skill.isActive ? (
                      <Badge>活跃</Badge>
                    ) : (
                      <Badge variant="secondary">停用</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/skills/${skill.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/skills/${skill.id}?tab=versions`}>
                        <History className="h-4 w-4" />
                      </Link>
                    </Button>
                    {hasRole('ADMIN') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(skill.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    暂无 Skill
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

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

      {/* 创建对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建 Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：视频内容分析"
                className="mt-1"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="简要描述 Skill 的用途"
                className="mt-1"
              />
            </div>
            <div>
              <Label>内容 (Prompt)</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="输入分析视频时使用的 prompt..."
                rows={10}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={
                !form.name || !form.content || createMutation.isPending
              }
            >
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定继续？
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
