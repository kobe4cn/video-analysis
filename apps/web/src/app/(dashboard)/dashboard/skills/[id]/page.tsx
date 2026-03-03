'use client';

import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Skill {
  id: string;
  name: string;
  description?: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

interface SkillVersion {
  id: string;
  version: number;
  content: string;
  createdAt: string;
}

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'edit';
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  const { data: skill, isLoading } = useQuery({
    queryKey: ['skill', id],
    queryFn: () => apiClient.get<Skill>(`/skills/${id}`),
  });

  const { data: versions } = useQuery({
    queryKey: ['skill-versions', id],
    queryFn: () => apiClient.get<SkillVersion[]>(`/skills/${id}/versions`),
  });

  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const { data: versionDetail } = useQuery({
    queryKey: ['skill-version', id, selectedVersion],
    queryFn: () =>
      apiClient.get<SkillVersion>(
        `/skills/${id}/versions/${selectedVersion}`
      ),
    enabled: !!selectedVersion,
  });

  // 当 skill 数据加载完成后同步到表单状态
  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description || '');
      setContent(skill.content);
    }
  }, [skill]);

  const updateMutation = useMutation({
    mutationFn: (body: { name: string; description: string; content: string }) =>
      apiClient.patch(`/skills/${id}`, body),
    onSuccess: () => {
      toast.success('Skill 已更新');
      queryClient.invalidateQueries({ queryKey: ['skill', id] });
      queryClient.invalidateQueries({ queryKey: ['skill-versions', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/skills">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回列表
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{skill?.name}</h1>
        <Badge variant="outline">v{skill?.version}</Badge>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="edit">编辑</TabsTrigger>
          <TabsTrigger value="versions">版本历史</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>内容 (Prompt)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="mt-1 font-mono text-sm"
            />
          </div>
          <Button
            onClick={() => updateMutation.mutate({ name, description, content })}
            disabled={updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">版本列表</h3>
              {versions?.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无历史版本</p>
              )}
              {versions?.map((v) => (
                <Card
                  key={v.id}
                  className={`cursor-pointer ${selectedVersion === v.id ? 'border-primary' : ''}`}
                  onClick={() => setSelectedVersion(v.id)}
                >
                  <CardContent className="py-2 px-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="md:col-span-2">
              {selectedVersion && versionDetail ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      版本 {versionDetail.version} 内容
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md max-h-[60vh] overflow-auto">
                      {versionDetail.content}
                    </pre>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  选择一个版本查看内容
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
