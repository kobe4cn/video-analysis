'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── 类型定义 ───

interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

// ─── 供应商表单初始值 ───

const emptyProviderForm = { name: '', baseUrl: '', apiKey: '' };
const emptyModelForm = { name: '', displayName: '', providerId: '', config: '' };

export default function ModelsSettingsPage() {
  const queryClient = useQueryClient();

  // ─── 供应商相关 state ───
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [providerForm, setProviderForm] = useState(emptyProviderForm);
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);

  // ─── 模型相关 state ───
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [modelForm, setModelForm] = useState(emptyModelForm);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);

  // ─── 数据查询 ───

  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['model-providers'],
    queryFn: () => apiClient.get<ModelProvider[]>('/model-providers'),
  });

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => apiClient.get<Model[]>('/models'),
  });

  // ─── 供应商 Mutations ───

  const createProviderMutation = useMutation({
    mutationFn: (body: typeof emptyProviderForm) =>
      apiClient.post('/model-providers', body),
    onSuccess: () => {
      toast.success('供应商创建成功');
      queryClient.invalidateQueries({ queryKey: ['model-providers'] });
      closeProviderDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyProviderForm & { isActive: boolean }>) =>
      apiClient.patch(`/model-providers/${id}`, body),
    onSuccess: () => {
      toast.success('供应商更新成功');
      queryClient.invalidateQueries({ queryKey: ['model-providers'] });
      closeProviderDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/model-providers/${id}`),
    onSuccess: () => {
      toast.success('供应商已删除');
      queryClient.invalidateQueries({ queryKey: ['model-providers'] });
      setDeleteProviderId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── 模型 Mutations ───

  const createModelMutation = useMutation({
    mutationFn: (body: { name: string; displayName: string; providerId: string; config?: Record<string, unknown> }) =>
      apiClient.post('/models', body),
    onSuccess: () => {
      toast.success('模型创建成功');
      queryClient.invalidateQueries({ queryKey: ['models'] });
      closeModelDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{ name: string; displayName: string; isActive: boolean; config: Record<string, unknown> }>) =>
      apiClient.patch(`/models/${id}`, body),
    onSuccess: () => {
      toast.success('模型更新成功');
      queryClient.invalidateQueries({ queryKey: ['models'] });
      closeModelDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/models/${id}`),
    onSuccess: () => {
      toast.success('模型已删除');
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setDeleteModelId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── 辅助函数 ───

  function closeProviderDialog() {
    setProviderDialogOpen(false);
    setEditingProvider(null);
    setProviderForm(emptyProviderForm);
  }

  function openCreateProvider() {
    setEditingProvider(null);
    setProviderForm(emptyProviderForm);
    setProviderDialogOpen(true);
  }

  function openEditProvider(provider: ModelProvider) {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      // 编辑时不回显完整 apiKey，留空表示不修改
      apiKey: '',
    });
    setProviderDialogOpen(true);
  }

  function handleProviderSubmit() {
    if (editingProvider) {
      const body: Record<string, string> = {};
      if (providerForm.name) body.name = providerForm.name;
      if (providerForm.baseUrl) body.baseUrl = providerForm.baseUrl;
      // 只有用户填写了新的 apiKey 才发送，避免将空值覆盖为空
      if (providerForm.apiKey) body.apiKey = providerForm.apiKey;
      updateProviderMutation.mutate({ id: editingProvider.id, ...body });
    } else {
      createProviderMutation.mutate(providerForm);
    }
  }

  function handleProviderToggle(provider: ModelProvider) {
    updateProviderMutation.mutate({ id: provider.id, isActive: !provider.isActive });
  }

  function closeModelDialog() {
    setModelDialogOpen(false);
    setEditingModel(null);
    setModelForm(emptyModelForm);
  }

  function openCreateModel() {
    setEditingModel(null);
    setModelForm(emptyModelForm);
    setModelDialogOpen(true);
  }

  function openEditModel(model: Model) {
    setEditingModel(model);
    setModelForm({
      name: model.name,
      displayName: model.displayName,
      providerId: model.providerId,
      config: model.config ? JSON.stringify(model.config, null, 2) : '',
    });
    setModelDialogOpen(true);
  }

  function handleModelSubmit() {
    const config = modelForm.config ? (() => {
      try { return JSON.parse(modelForm.config); }
      catch { toast.error('Config JSON 格式无效'); return null; }
    })() : undefined;

    // JSON 解析失败时 config 会是 null，此时不提交
    if (modelForm.config && config === null) return;

    if (editingModel) {
      updateModelMutation.mutate({
        id: editingModel.id,
        name: modelForm.name || undefined,
        displayName: modelForm.displayName || undefined,
        ...(config !== undefined ? { config } : {}),
      });
    } else {
      createModelMutation.mutate({
        name: modelForm.name,
        displayName: modelForm.displayName,
        providerId: modelForm.providerId,
        ...(config !== undefined ? { config } : {}),
      });
    }
  }

  function handleModelToggle(model: Model) {
    updateModelMutation.mutate({ id: model.id, isActive: !model.isActive });
  }

  const providerPending = createProviderMutation.isPending || updateProviderMutation.isPending;
  const modelPending = createModelMutation.isPending || updateModelMutation.isPending;

  return (
    <div className="space-y-8">
      {/* ─── 模型供应商管理 ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">模型供应商</h1>
          <Button onClick={openCreateProvider}>
            <Plus className="mr-2 h-4 w-4" />
            添加供应商
          </Button>
        </div>

        {providersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers?.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{provider.baseUrl}</TableCell>
                  <TableCell className="font-mono text-xs">{provider.apiKey}</TableCell>
                  <TableCell>
                    <Switch
                      checked={provider.isActive}
                      onCheckedChange={() => handleProviderToggle(provider)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(provider.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditProvider(provider)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteProviderId(provider.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {providers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无供应商
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ─── 模型列表管理 ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">模型列表</h2>
          <Button onClick={openCreateModel}>
            <Plus className="mr-2 h-4 w-4" />
            添加模型
          </Button>
        </div>

        {modelsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型名称</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models?.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium font-mono text-sm">{model.name}</TableCell>
                  <TableCell>{model.displayName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{model.providerName}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={model.isActive}
                      onCheckedChange={() => handleModelToggle(model)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditModel(model)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteModelId(model.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {models?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    暂无模型
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ─── 供应商创建/编辑对话框 ─── */}
      <Dialog open={providerDialogOpen} onOpenChange={(open) => { if (!open) closeProviderDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? '编辑供应商' : '添加供应商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={providerForm.name}
                onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                placeholder="例如：OpenAI"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                value={providerForm.baseUrl}
                onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="mt-1"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                placeholder={editingProvider ? '留空则不修改' : '输入 API Key'}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProviderDialog}>取消</Button>
            <Button
              onClick={handleProviderSubmit}
              disabled={
                providerPending ||
                (!editingProvider && (!providerForm.name || !providerForm.baseUrl || !providerForm.apiKey))
              }
            >
              {providerPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 模型创建/编辑对话框 ─── */}
      <Dialog open={modelDialogOpen} onOpenChange={(open) => { if (!open) closeModelDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? '编辑模型' : '添加模型'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>模型名称</Label>
              <Input
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                placeholder="例如：gpt-4o"
                className="mt-1"
              />
            </div>
            <div>
              <Label>显示名称</Label>
              <Input
                value={modelForm.displayName}
                onChange={(e) => setModelForm({ ...modelForm, displayName: e.target.value })}
                placeholder="例如：GPT-4o"
                className="mt-1"
              />
            </div>
            {/* 创建时才需要选择供应商，编辑时不可更改 */}
            {!editingModel && (
              <div>
                <Label>所属供应商</Label>
                <Select
                  value={modelForm.providerId}
                  onValueChange={(val) => setModelForm({ ...modelForm, providerId: val })}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.filter((p) => p.isActive).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Config (JSON, 可选)</Label>
              <Input
                value={modelForm.config}
                onChange={(e) => setModelForm({ ...modelForm, config: e.target.value })}
                placeholder='{"temperature": 0.7}'
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModelDialog}>取消</Button>
            <Button
              onClick={handleModelSubmit}
              disabled={
                modelPending ||
                (!editingModel && (!modelForm.name || !modelForm.displayName || !modelForm.providerId))
              }
            >
              {modelPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除供应商确认对话框 ─── */}
      <Dialog open={!!deleteProviderId} onOpenChange={() => setDeleteProviderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除供应商后，关联的模型可能受到影响，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProviderId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteProviderId && deleteProviderMutation.mutate(deleteProviderId)}
              disabled={deleteProviderMutation.isPending}
            >
              {deleteProviderMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除模型确认对话框 ─── */}
      <Dialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModelId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteModelId && deleteModelMutation.mutate(deleteModelId)}
              disabled={deleteModelMutation.isPending}
            >
              {deleteModelMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
