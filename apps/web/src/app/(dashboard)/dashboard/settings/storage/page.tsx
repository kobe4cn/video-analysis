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
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Cloud, Link } from 'lucide-react';
import { toast } from 'sonner';

// ─── 类型定义 ───

interface OssConfig {
  id: string;
  name: string;
  provider: string;
  accessKeyId: string;
  region: string;
  bucketCount: number;
  createdAt: string;
}

interface OssBucket {
  id: string;
  name: string;
  ossConfigId: string;
  ossConfigName: string;
  isDefault: boolean;
  videoCount: number;
  createdAt: string;
}

interface RemoteBucket {
  name: string;
  region: string;
  creationDate: string;
}

// ─── 表单初始值 ───

const emptyConfigForm = { name: '', provider: '', accessKeyId: '', accessKeySecret: '', region: '' };
const emptyBucketForm = { name: '', ossConfigId: '', isDefault: false };

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function validateBucketName(name: string): string | null {
  if (!name) return null;
  if (name.length < 3) return '名称至少 3 个字符';
  if (name.length > 63) return '名称最多 63 个字符';
  if (!BUCKET_NAME_REGEX.test(name)) {
    return '仅允许小写字母、数字和连字符，不能以连字符开头或结尾';
  }
  return null;
}

export default function StorageSettingsPage() {
  const queryClient = useQueryClient();

  // ─── OSS 配置 state ───
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<OssConfig | null>(null);
  const [configForm, setConfigForm] = useState(emptyConfigForm);
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null);

  // ─── Bucket state ───
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [bucketTab, setBucketTab] = useState<string>('link');
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

  // 选中 OSS 配置后拉取阿里云上已有的 Bucket
  const { data: remoteBuckets, isLoading: remoteBucketsLoading } = useQuery({
    queryKey: ['remote-buckets', bucketForm.ossConfigId],
    queryFn: () =>
      apiClient.get<RemoteBucket[]>(`/oss-buckets/remote?configId=${bucketForm.ossConfigId}`),
    enabled: !!bucketForm.ossConfigId && bucketDialogOpen,
  });

  // 过滤掉已关联到本地的 Bucket
  const availableRemoteBuckets = remoteBuckets?.filter(
    (rb) => !ossBuckets?.some((lb) => lb.name === rb.name),
  );

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
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyConfigForm>) =>
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
    mutationFn: (body: { name: string; ossConfigId: string; isDefault?: boolean }) =>
      apiClient.post('/oss-buckets', body),
    onSuccess: () => {
      toast.success('Bucket 创建成功');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
      closeBucketDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkBucketMutation = useMutation({
    mutationFn: (body: { name: string; ossConfigId: string; isDefault?: boolean }) =>
      apiClient.post('/oss-buckets/link', body),
    onSuccess: () => {
      toast.success('Bucket 关联成功');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
      closeBucketDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBucketMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/oss-buckets/${id}`),
    onSuccess: () => {
      toast.success('Bucket 已删除');
      queryClient.invalidateQueries({ queryKey: ['oss-buckets'] });
      queryClient.invalidateQueries({ queryKey: ['oss-configs'] });
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
      name: config.name,
      provider: config.provider,
      accessKeyId: config.accessKeyId,
      accessKeySecret: '',
      region: config.region,
    });
    setConfigDialogOpen(true);
  }

  function handleConfigSubmit() {
    if (editingConfig) {
      const body: Record<string, string> = {};
      if (configForm.name) body.name = configForm.name;
      if (configForm.provider) body.provider = configForm.provider;
      if (configForm.accessKeyId) body.accessKeyId = configForm.accessKeyId;
      if (configForm.accessKeySecret) body.accessKeySecret = configForm.accessKeySecret;
      if (configForm.region) body.region = configForm.region;
      updateConfigMutation.mutate({ id: editingConfig.id, ...body });
    } else {
      createConfigMutation.mutate(configForm);
    }
  }

  // ─── Bucket 辅助函数 ───

  function closeBucketDialog() {
    setBucketDialogOpen(false);
    setBucketForm(emptyBucketForm);
    setBucketTab('link');
  }

  function openCreateBucket() {
    setBucketForm(emptyBucketForm);
    setBucketTab('link');
    setBucketDialogOpen(true);
  }

  function handleBucketCreate() {
    createBucketMutation.mutate({
      name: bucketForm.name,
      ossConfigId: bucketForm.ossConfigId,
      isDefault: bucketForm.isDefault || undefined,
    });
  }

  function handleBucketLink() {
    linkBucketMutation.mutate({
      name: bucketForm.name,
      ossConfigId: bucketForm.ossConfigId,
      isDefault: bucketForm.isDefault || undefined,
    });
  }

  const configPending = createConfigMutation.isPending || updateConfigMutation.isPending;
  const bucketPending = createBucketMutation.isPending || linkBucketMutation.isPending;

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
                <TableHead>名称</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Access Key ID</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Bucket 数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ossConfigs?.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell>{config.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{config.accessKeyId}</TableCell>
                  <TableCell>{config.region}</TableCell>
                  <TableCell>{config.bucketCount}</TableCell>
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
                <TableHead>默认</TableHead>
                <TableHead>视频数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ossBuckets?.map((bucket) => (
                <TableRow key={bucket.id}>
                  <TableCell className="font-medium">{bucket.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{bucket.ossConfigName}</Badge>
                  </TableCell>
                  <TableCell>
                    {bucket.isDefault ? (
                      <Badge>默认</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{bucket.videoCount}</TableCell>
                  <TableCell>{new Date(bucket.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                  <TableCell className="text-right">
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
              <Label>名称</Label>
              <Input
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                placeholder="例如：阿里云主账号"
                className="mt-1"
              />
            </div>
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
                (!editingConfig && (!configForm.name || !configForm.provider || !configForm.accessKeyId || !configForm.accessKeySecret || !configForm.region))
              }
            >
              {configPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bucket 添加对话框（关联已有 / 新建） ─── */}
      <Dialog open={bucketDialogOpen} onOpenChange={(open) => { if (!open) closeBucketDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加 Bucket</DialogTitle>
          </DialogHeader>

          {/* 先选 OSS 配置，两种模式共用 */}
          <div>
            <Label>关联 OSS 配置</Label>
            <Select
              value={bucketForm.ossConfigId}
              onValueChange={(val) => setBucketForm({ ...emptyBucketForm, ossConfigId: val })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="选择 OSS 配置" />
              </SelectTrigger>
              <SelectContent>
                {ossConfigs?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} - {c.provider} ({c.region})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bucketForm.ossConfigId && (
            <Tabs value={bucketTab} onValueChange={setBucketTab} className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="link" className="flex-1">
                  <Link className="mr-1.5 h-3.5 w-3.5" />
                  关联已有 Bucket
                </TabsTrigger>
                <TabsTrigger value="create" className="flex-1">
                  <Cloud className="mr-1.5 h-3.5 w-3.5" />
                  新建 Bucket
                </TabsTrigger>
              </TabsList>

              {/* ─── 关联已有 ─── */}
              <TabsContent value="link" className="space-y-4 mt-4">
                <div>
                  <Label>选择阿里云上的 Bucket</Label>
                  {remoteBucketsLoading ? (
                    <Skeleton className="h-10 w-full mt-1" />
                  ) : availableRemoteBuckets && availableRemoteBuckets.length > 0 ? (
                    <Select
                      value={bucketForm.name}
                      onValueChange={(val) => setBucketForm({ ...bucketForm, name: val })}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="选择 Bucket" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRemoteBuckets.map((rb) => (
                          <SelectItem key={rb.name} value={rb.name}>
                            {rb.name}
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({rb.region})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      {remoteBuckets ? '没有可关联的 Bucket（全部已关联或账号下无 Bucket）' : '加载失败'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="link-bucket-default"
                    checked={bucketForm.isDefault}
                    onCheckedChange={(checked) => setBucketForm({ ...bucketForm, isDefault: checked })}
                  />
                  <Label htmlFor="link-bucket-default">设为默认 Bucket</Label>
                </div>
              </TabsContent>

              {/* ─── 新建 ─── */}
              <TabsContent value="create" className="space-y-4 mt-4">
                <div>
                  <Label>Bucket 名称</Label>
                  <Input
                    value={bucketForm.name}
                    onChange={(e) =>
                      setBucketForm({ ...bucketForm, name: e.target.value.toLowerCase() })
                    }
                    placeholder="例如：my-video-bucket"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    仅允许小写字母、数字和连字符（-），3-63 个字符，不能以连字符开头或结尾
                  </p>
                  {bucketForm.name && validateBucketName(bucketForm.name) && (
                    <p className="text-xs text-destructive mt-1">
                      {validateBucketName(bucketForm.name)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="create-bucket-default"
                    checked={bucketForm.isDefault}
                    onCheckedChange={(checked) => setBucketForm({ ...bucketForm, isDefault: checked })}
                  />
                  <Label htmlFor="create-bucket-default">设为默认 Bucket</Label>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeBucketDialog}>取消</Button>
            {bucketTab === 'link' ? (
              <Button
                onClick={handleBucketLink}
                disabled={bucketPending || !bucketForm.name || !bucketForm.ossConfigId}
              >
                {bucketPending ? '关联中...' : '关联'}
              </Button>
            ) : (
              <Button
                onClick={handleBucketCreate}
                disabled={
                  bucketPending ||
                  !bucketForm.name ||
                  !bucketForm.ossConfigId ||
                  !!validateBucketName(bucketForm.name)
                }
              >
                {bucketPending ? '创建中...' : '创建'}
              </Button>
            )}
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
              此操作将同时删除阿里云上的 Bucket，删除后无法恢复。确定继续？
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
