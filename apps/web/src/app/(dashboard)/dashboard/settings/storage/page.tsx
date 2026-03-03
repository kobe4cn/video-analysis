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

interface OssConfig {
  id: string;
  provider: string;
  accessKeyId: string;
  accessKeySecret: string;
  region: string;
  isActive: boolean;
}

interface OssBucket {
  id: string;
  name: string;
  ossConfigId: string;
  domain: string;
  isDefault: boolean;
  isActive: boolean;
}

// ─── 表单初始值 ───

const emptyConfigForm = { provider: '', accessKeyId: '', accessKeySecret: '', region: '' };
const emptyBucketForm = { name: '', ossConfigId: '', domain: '', isDefault: false };

export default function StorageSettingsPage() {
  const queryClient = useQueryClient();

  // ─── OSS 配置 state ───
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<OssConfig | null>(null);
  const [configForm, setConfigForm] = useState(emptyConfigForm);
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null);

  // ─── Bucket state ───
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<OssBucket | null>(null);
  const [bucketForm, setBucketForm] = useState(emptyBucketForm);
  const [deleteBucketId, setDeleteBucketId] = useState<string | null>(null);

  // ─── 数据查询 ───

  const { data: ossConfigs, isLoading: configsLoading } = useQuery({
    queryKey: ['oss-configs'],
    queryFn: () => apiClient.get<OssConfig[]>('/oss-configs'),
  });

  const { data: ossBuckets, isLoading: bucketsLoading } = useQuery({
    queryKey: ['oss-buckets'],
    queryFn: () => apiClient.get<OssBucket[]>('/oss-buckets'),
  });

  // ─── OSS 配置 Mutations ───

  const createConfigMutation = useMutation({
    mutationFn: (body: typeof emptyConfigForm) =>
      apiClient.post('/oss-configs', body),
    onSuccess: () => {
      toast.success('OSS 配置创建成功');
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
      closeConfigDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyConfigForm & { isActive: boolean }>) =>
      apiClient.patch(`/oss-configs/${id}`, body),
    onSuccess: () => {
      toast.success('OSS 配置更新成功');
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
      closeConfigDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/oss-configs/${id}`),
    onSuccess: () => {
      toast.success('OSS 配置已删除');
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
      setDeleteConfigId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Bucket Mutations ───

  const createBucketMutation = useMutation({
    mutationFn: (body: { name: string; ossConfigId: string; domain?: string; isDefault?: boolean }) =>
      apiClient.post('/oss-buckets', body),
    onSuccess: () => {
      toast.success('Bucket 创建成功');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      closeBucketDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateBucketMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{ name: string; ossConfigId: string; domain: string; isDefault: boolean; isActive: boolean }>) =>
      apiClient.patch(`/oss-buckets/${id}`, body),
    onSuccess: () => {
      toast.success('Bucket 更新成功');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      closeBucketDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBucketMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/oss-buckets/${id}`),
    onSuccess: () => {
      toast.success('Bucket 已删除');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      setDeleteBucketId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── OSS 配置辅助函数 ───

  function closeConfigDialog() {
    setConfigDialogOpen(false);
    setEditingConfig(null);
    setConfigForm(emptyConfigForm);
  }

  function openCreateConfig() {
    setEditingConfig(null);
    setConfigForm(emptyConfigForm);
    setConfigDialogOpen(true);
  }

  function openEditConfig(config: OssConfig) {
    setEditingConfig(config);
    setConfigForm({
      provider: config.provider,
      accessKeyId: config.accessKeyId,
      // 编辑时不回显完整 Secret，留空表示不修改
      accessKeySecret: '',
      region: config.region,
    });
    setConfigDialogOpen(true);
  }

  function handleConfigSubmit() {
    if (editingConfig) {
      const body: Record<string, string> = {};
      if (configForm.provider) body.provider = configForm.provider;
      if (configForm.accessKeyId) body.accessKeyId = configForm.accessKeyId;
      if (configForm.accessKeySecret) body.accessKeySecret = configForm.accessKeySecret;
      if (configForm.region) body.region = configForm.region;
      updateConfigMutation.mutate({ id: editingConfig.id, ...body });
    } else {
      createConfigMutation.mutate(configForm);
    }
  }

  function handleConfigToggle(config: OssConfig) {
    updateConfigMutation.mutate({ id: config.id, isActive: !config.isActive });
  }

  // ─── Bucket 辅助函数 ───

  function closeBucketDialog() {
    setBucketDialogOpen(false);
    setEditingBucket(null);
    setBucketForm(emptyBucketForm);
  }

  function openCreateBucket() {
    setEditingBucket(null);
    setBucketForm(emptyBucketForm);
    setBucketDialogOpen(true);
  }

  function openEditBucket(bucket: OssBucket) {
    setEditingBucket(bucket);
    setBucketForm({
      name: bucket.name,
      ossConfigId: bucket.ossConfigId,
      domain: bucket.domain || '',
      isDefault: bucket.isDefault,
    });
    setBucketDialogOpen(true);
  }

  function handleBucketSubmit() {
    if (editingBucket) {
      updateBucketMutation.mutate({
        id: editingBucket.id,
        name: bucketForm.name || undefined,
        ossConfigId: bucketForm.ossConfigId || undefined,
        domain: bucketForm.domain || undefined,
        isDefault: bucketForm.isDefault,
      });
    } else {
      createBucketMutation.mutate({
        name: bucketForm.name,
        ossConfigId: bucketForm.ossConfigId,
        domain: bucketForm.domain || undefined,
        isDefault: bucketForm.isDefault || undefined,
      });
    }
  }

  function handleBucketToggle(bucket: OssBucket) {
    updateBucketMutation.mutate({ id: bucket.id, isActive: !bucket.isActive });
  }

  /** 根据 ossConfigId 查找对应配置的 provider 名称 */
  function getConfigLabel(ossConfigId: string): string {
    const config = ossConfigs?.find((c) => c.id === ossConfigId);
    return config ? `${config.provider} (${config.region})` : ossConfigId;
  }

  const configPending = createConfigMutation.isPending || updateConfigMutation.isPending;
  const bucketPending = createBucketMutation.isPending || updateBucketMutation.isPending;

  return (
    <div className="space-y-8">
      {/* ─── OSS 配置管理 ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">OSS 配置</h1>
          <Button onClick={openCreateConfig}>
            <Plus className="mr-2 h-4 w-4" />
            添加配置
          </Button>
        </div>

        {configsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Access Key ID</TableHead>
                <TableHead>Access Key Secret</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ossConfigs?.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{config.accessKeyId}</TableCell>
                  <TableCell className="font-mono text-xs">{config.accessKeySecret}</TableCell>
                  <TableCell>{config.region}</TableCell>
                  <TableCell>
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={() => handleConfigToggle(config)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditConfig(config)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfigId(config.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ossConfigs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无 OSS 配置
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ─── Bucket 管理 ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Bucket 列表</h2>
          <Button onClick={openCreateBucket}>
            <Plus className="mr-2 h-4 w-4" />
            添加 Bucket
          </Button>
        </div>

        {bucketsLoading ? (
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
                <TableHead>OSS 配置</TableHead>
                <TableHead>域名</TableHead>
                <TableHead>默认</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ossBuckets?.map((bucket) => (
                <TableRow key={bucket.id}>
                  <TableCell className="font-medium">{bucket.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getConfigLabel(bucket.ossConfigId)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{bucket.domain || '-'}</TableCell>
                  <TableCell>
                    {bucket.isDefault ? (
                      <Badge>默认</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={bucket.isActive}
                      onCheckedChange={() => handleBucketToggle(bucket)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditBucket(bucket)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteBucketId(bucket.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ossBuckets?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无 Bucket
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ─── OSS 配置创建/编辑对话框 ─── */}
      <Dialog open={configDialogOpen} onOpenChange={(open) => { if (!open) closeConfigDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑 OSS 配置' : '添加 OSS 配置'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider</Label>
              <Select
                value={configForm.provider}
                onValueChange={(val) => setConfigForm({ ...configForm, provider: val })}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="选择 Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aliyun">Aliyun OSS</SelectItem>
                  <SelectItem value="tencent">Tencent COS</SelectItem>
                  <SelectItem value="aws">AWS S3</SelectItem>
                  <SelectItem value="minio">MinIO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access Key ID</Label>
              <Input
                value={configForm.accessKeyId}
                onChange={(e) => setConfigForm({ ...configForm, accessKeyId: e.target.value })}
                placeholder="输入 Access Key ID"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Access Key Secret</Label>
              <Input
                type="password"
                value={configForm.accessKeySecret}
                onChange={(e) => setConfigForm({ ...configForm, accessKeySecret: e.target.value })}
                placeholder={editingConfig ? '留空则不修改' : '输入 Access Key Secret'}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Region</Label>
              <Input
                value={configForm.region}
                onChange={(e) => setConfigForm({ ...configForm, region: e.target.value })}
                placeholder="例如：cn-hangzhou"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeConfigDialog}>取消</Button>
            <Button
              onClick={handleConfigSubmit}
              disabled={
                configPending ||
                (!editingConfig && (!configForm.provider || !configForm.accessKeyId || !configForm.accessKeySecret || !configForm.region))
              }
            >
              {configPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bucket 创建/编辑对话框 ─── */}
      <Dialog open={bucketDialogOpen} onOpenChange={(open) => { if (!open) closeBucketDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBucket ? '编辑 Bucket' : '添加 Bucket'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bucket 名称</Label>
              <Input
                value={bucketForm.name}
                onChange={(e) => setBucketForm({ ...bucketForm, name: e.target.value })}
                placeholder="输入 Bucket 名称"
                className="mt-1"
              />
            </div>
            <div>
              <Label>关联 OSS 配置</Label>
              <Select
                value={bucketForm.ossConfigId}
                onValueChange={(val) => setBucketForm({ ...bucketForm, ossConfigId: val })}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="选择 OSS 配置" />
                </SelectTrigger>
                <SelectContent>
                  {ossConfigs?.filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.provider} ({c.region})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>自定义域名 (可选)</Label>
              <Input
                value={bucketForm.domain}
                onChange={(e) => setBucketForm({ ...bucketForm, domain: e.target.value })}
                placeholder="https://cdn.example.com"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="bucket-default"
                checked={bucketForm.isDefault}
                onCheckedChange={(checked) => setBucketForm({ ...bucketForm, isDefault: checked })}
              />
              <Label htmlFor="bucket-default">设为默认 Bucket</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeBucketDialog}>取消</Button>
            <Button
              onClick={handleBucketSubmit}
              disabled={
                bucketPending ||
                (!editingBucket && (!bucketForm.name || !bucketForm.ossConfigId))
              }
            >
              {bucketPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除 OSS 配置确认对话框 ─── */}
      <Dialog open={!!deleteConfigId} onOpenChange={() => setDeleteConfigId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除 OSS 配置后，关联的 Bucket 可能受到影响，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfigId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfigId && deleteConfigMutation.mutate(deleteConfigId)}
              disabled={deleteConfigMutation.isPending}
            >
              {deleteConfigMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除 Bucket 确认对话框 ─── */}
      <Dialog open={!!deleteBucketId} onOpenChange={() => setDeleteBucketId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBucketId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteBucketId && deleteBucketMutation.mutate(deleteBucketId)}
              disabled={deleteBucketMutation.isPending}
            >
              {deleteBucketMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
