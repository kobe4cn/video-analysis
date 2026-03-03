'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Video, Sparkles, Bot, FolderOpen, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface FolderItem {
  id: string;
  name: string;
  videoCount: number;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [taskName, setTaskName] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  // 文件夹导航：null 表示文件夹列表，具体 id 表示进入该文件夹，'root' 表示未归类
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);

  const { data: foldersData } = useQuery({
    queryKey: ['video-folders'],
    queryFn: () => apiClient.get<FolderItem[]>('/videos/folders'),
  });

  // 仅在进入了某个文件夹（或未归类）时才请求视频列表
  const { data: videosData } = useQuery({
    queryKey: ['folder-videos', currentFolder?.id],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      params.set('folderId', currentFolder!.id);
      return apiClient.get<{ items: any[] }>(`/videos?${params.toString()}`);
    },
    enabled: !!currentFolder,
  });

  const { data: skillsData } = useQuery({
    queryKey: ['all-skills'],
    queryFn: () => apiClient.get<{ items: any[] }>('/skills?page=1&pageSize=100'),
  });

  const { data: modelsData } = useQuery({
    queryKey: ['all-models'],
    queryFn: () => apiClient.get<any[]>('/models'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; videoIds: string[]; skillId: string; modelId: string }) =>
      apiClient.post<{ id: string; status: string }>('/tasks', body),
    onSuccess: (data) => {
      toast.success('任务已创建');
      router.push(`/dashboard/tasks/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleVideo = (id: string) => {
    const next = new Set(selectedVideos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVideos(next);
  };

  const handleSubmit = () => {
    createMutation.mutate({
      name: taskName,
      videoIds: Array.from(selectedVideos),
      skillId: selectedSkill,
      modelId: selectedModel,
    });
  };

  const videos = videosData?.items || [];
  const skills = skillsData?.items || [];
  const models = Array.isArray(modelsData) ? modelsData : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-1 h-4 w-4" />返回
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">创建解析任务</h1>
      </div>

      {/* 步骤指示器：四步流程直观展示当前进度 */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`flex items-center gap-1 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {s}
            </div>
            <span className="text-sm hidden sm:inline">
              {['选择视频', '选择 Skill', '选择模型', '确认提交'][s - 1]}
            </span>
            {s < 4 && <div className={`w-8 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: 选择视频 —— 先选文件夹再从中勾选视频，跨文件夹选择时已选数量持续保留 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />选择视频
              {selectedVideos.size > 0 && (
                <Badge variant="secondary">{selectedVideos.size} 已选</Badge>
              )}
            </CardTitle>

            {/* 面包屑导航 */}
            {currentFolder && (
              <div className="flex items-center gap-1 text-sm pt-1">
                <button
                  onClick={() => setCurrentFolder(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  选择文件夹
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{currentFolder.name}</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* 文件夹列表视图 */}
            {!currentFolder && (
              <div className="space-y-2">
                {/* 未归类视频入口 */}
                <div
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setCurrentFolder({ id: 'root', name: '未归类视频' })}
                >
                  <Video className="h-6 w-6 text-muted-foreground shrink-0" />
                  <span className="flex-1 font-medium">未归类视频</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>

                {foldersData?.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setCurrentFolder({ id: folder.id, name: folder.name })}
                  >
                    <FolderOpen className="h-6 w-6 text-amber-500 shrink-0" />
                    <span className="flex-1 font-medium">{folder.name}</span>
                    <span className="text-sm text-muted-foreground">{folder.videoCount} 个视频</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}

                {(!foldersData || foldersData.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">暂无文件夹，请先在视频管理中创建</p>
                )}
              </div>
            )}

            {/* 视频列表视图：进入文件夹后显示 */}
            {currentFolder && (
              <div className="space-y-2 max-h-96 overflow-auto">
                {/* 全选/取消全选 */}
                {videos.length > 0 && (
                  <div className="flex items-center gap-2 pb-2 border-b mb-2">
                    <button
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        const next = new Set(selectedVideos);
                        const allSelected = videos.every((v: any) => next.has(v.id));
                        videos.forEach((v: any) => {
                          if (allSelected) next.delete(v.id);
                          else next.add(v.id);
                        });
                        setSelectedVideos(next);
                      }}
                    >
                      {videos.every((v: any) => selectedVideos.has(v.id)) ? '取消本页全选' : '全选本页'}
                    </button>
                  </div>
                )}

                {videos.map((v: any) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted ${selectedVideos.has(v.id) ? 'bg-muted border border-primary' : ''}`}
                    onClick={() => toggleVideo(v.id)}
                  >
                    <input type="checkbox" checked={selectedVideos.has(v.id)} readOnly className="h-4 w-4" />
                    <span className="flex-1">{v.title}</span>
                    {v.hasReport && <Badge variant="outline" className="text-xs">有报告</Badge>}
                  </div>
                ))}
                {videos.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">该文件夹内暂无视频</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: 选择 Skill */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />选择 Skill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {skills.map((s: any) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded cursor-pointer hover:bg-muted ${selectedSkill === s.id ? 'bg-muted border border-primary' : ''}`}
                onClick={() => setSelectedSkill(s.id)}
              >
                <input type="radio" checked={selectedSkill === s.id} readOnly className="h-4 w-4" />
                <div>
                  <p className="font-medium">{s.name}</p>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </div>
                <Badge variant="outline" className="ml-auto">v{s.version}</Badge>
              </div>
            ))}
            {skills.length === 0 && (
              <p className="text-muted-foreground text-center py-4">暂无 Skill，请先创建</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: 选择模型并设置任务名称 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />选择模型
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>任务名称</Label>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：批量视频分析 - 2024.03"
                className="mt-1 mb-4"
              />
            </div>
            <div className="space-y-2">
              {models.map((m: any) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded cursor-pointer hover:bg-muted ${selectedModel === m.id ? 'bg-muted border border-primary' : ''}`}
                  onClick={() => setSelectedModel(m.id)}
                >
                  <input type="radio" checked={selectedModel === m.id} readOnly className="h-4 w-4" />
                  <div>
                    <p className="font-medium">{m.displayName}</p>
                    <p className="text-sm text-muted-foreground">{m.providerName}</p>
                  </div>
                </div>
              ))}
              {models.length === 0 && (
                <p className="text-muted-foreground text-center py-4">暂无模型，请在设置中添加</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: 确认提交 */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>确认任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-muted-foreground">任务名称：</span>{taskName}
            </div>
            <div>
              <span className="text-muted-foreground">选择视频数：</span>{selectedVideos.size} 个
            </div>
            <div>
              <span className="text-muted-foreground">Skill：</span>
              {skills.find((s: any) => s.id === selectedSkill)?.name}
            </div>
            <div>
              <span className="text-muted-foreground">模型：</span>
              {models.find((m: any) => m.id === selectedModel)?.displayName}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导航按钮：根据当前步骤必填项是否完成来控制可用性 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />上一步
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && selectedVideos.size === 0) ||
              (step === 2 && !selectedSkill) ||
              (step === 3 && (!selectedModel || !taskName))
            }
          >
            下一步<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            <Check className="mr-2 h-4 w-4" />
            {createMutation.isPending ? '提交中...' : '提交任务'}
          </Button>
        )}
      </div>
    </div>
  );
}
