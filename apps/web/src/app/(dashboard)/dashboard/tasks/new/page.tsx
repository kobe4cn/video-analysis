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
import { ArrowLeft, ArrowRight, Check, Video, Sparkles, Bot } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function CreateTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [taskName, setTaskName] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  const { data: videosData } = useQuery({
    queryKey: ['all-videos'],
    queryFn: () => apiClient.get<{ items: any[] }>('/videos?page=1&pageSize=100'),
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

      {/* Step 1: 选择视频 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />选择视频 ({selectedVideos.size} 已选)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
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
              <p className="text-muted-foreground text-center py-4">暂无视频，请先上传</p>
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
