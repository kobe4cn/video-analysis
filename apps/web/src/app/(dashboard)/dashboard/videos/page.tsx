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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Upload, Download, Trash2, Eye, FileText, Video,
  FolderOpen, FolderPlus, MoreHorizontal, Pencil, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { VideoUploadDialog } from '@/components/video/video-upload-dialog';
import { EmptyState } from '@/components/empty-state';
import { QueryError } from '@/components/query-error';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

interface VideoItem {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  hasReport: boolean;
  latestReportId?: string;
  createdAt: string;
}

interface VideosResponse {
  items: VideoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FolderItem {
  id: string;
  name: string;
  videoCount: number;
  createdAt: string;
}

export default function VideosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState('');

  // 文件夹操作状态
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const hasRole = useAuthStore((s) => s.hasRole);

  // 文件夹列表
  const { data: folders } = useQuery({
    queryKey: ['video-folders'],
    queryFn: () => apiClient.get<FolderItem[]>('/videos/folders'),
  });

  // 视频列表：根据是否在文件夹内传不同参数
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['videos', page, search, currentFolderId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (search) params.set('search', search);
      if (currentFolderId) {
        params.set('folderId', currentFolderId);
      } else {
        // 根目录：只显示未归类视频
        params.set('folderId', 'root');
      }
      return apiClient.get<VideosResponse>(`/videos?${params.toString()}`);
    },
  });

  // ─── Mutations ───

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/videos/${id}`),
    onSuccess: () => {
      toast.success('视频已删除');
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['video-folders'] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/videos/folders', { name }),
    onSuccess: () => {
      toast.success('文件夹已创建');
      queryClient.invalidateQueries({ queryKey: ['video-folders'] });
      setFolderDialogOpen(false);
      setFolderName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient.patch(`/videos/folders/${id}`, { name }),
    onSuccess: () => {
      toast.success('文件夹已重命名');
      queryClient.invalidateQueries({ queryKey: ['video-folders'] });
      setFolderDialogOpen(false);
      setFolderName('');
      setEditingFolderId(null);
      // 如果当前在被重命名的文件夹内，更新面包屑名称
      if (editingFolderId === currentFolderId) {
        setCurrentFolderName(folderName);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/videos/folders/${id}`),
    onSuccess: () => {
      toast.success('文件夹已删除');
      queryClient.invalidateQueries({ queryKey: ['video-folders'] });
      setDeleteFolderId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Handlers ───

  const handleDownload = async (id: string) => {
    try {
      const { url } = await apiClient.get<{ url: string }>(
        `/videos/${id}/download-url`
      );
      window.open(url, '_blank');
    } catch {
      toast.error('获取下载链接失败');
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const enterFolder = (folder: FolderItem) => {
    setCurrentFolderId(folder.id);
    setCurrentFolderName(folder.name);
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const backToRoot = () => {
    setCurrentFolderId(null);
    setCurrentFolderName('');
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const openCreateFolder = () => {
    setEditingFolderId(null);
    setFolderName('');
    setFolderDialogOpen(true);
  };

  const openRenameFolder = (folder: FolderItem) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderDialogOpen(true);
  };

  const handleFolderSubmit = () => {
    if (!folderName.trim()) return;
    if (editingFolderId) {
      renameFolderMutation.mutate({ id: editingFolderId, name: folderName.trim() });
    } else {
      createFolderMutation.mutate(folderName.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">视频管理</h1>
        <div className="flex items-center gap-2">
          {hasRole('OPERATOR') && !currentFolderId && (
            <Button variant="outline" onClick={openCreateFolder}>
              <FolderPlus className="mr-2 h-4 w-4" />
              新建文件夹
            </Button>
          )}
          {hasRole('OPERATOR') && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              上传视频
            </Button>
          )}
        </div>
      </div>

      {/* 面包屑导航：进入文件夹后显示返回路径 */}
      {currentFolderId && (
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={backToRoot}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            全部视频
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{currentFolderName}</span>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <Input
          placeholder="搜索视频..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-sm"
        />
        <Button variant="secondary" onClick={handleSearch}>
          搜索
        </Button>
      </div>

      {/* 文件夹卡片网格：仅在根目录且无搜索时显示 */}
      {!currentFolderId && !search && folders && folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group relative flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => enterFolder(folder)}
            >
              <FolderOpen className="h-8 w-8 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground">{folder.videoCount} 个视频</p>
              </div>

              {hasRole('OPERATOR') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openRenameFolder(folder)}>
                      <Pencil className="mr-2 h-4 w-4" />重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteFolderId(folder.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 视频表格 */}
      {isError ? (
        <QueryError error={error} retry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* 未归类视频标题：仅在根目录且有文件夹时显示分隔提示 */}
          {!currentFolderId && !search && folders && folders.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground pt-2">未归类视频</h2>
          )}

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>上传者</TableHead>
                <TableHead>报告</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items?.map((video) => (
                <TableRow key={video.id}>
                  <TableCell className="font-medium">{video.title}</TableCell>
                  <TableCell>{formatFileSize(video.fileSize)}</TableCell>
                  <TableCell>{video.uploadedBy}</TableCell>
                  <TableCell>
                    {video.hasReport ? (
                      <Link
                        href={`/dashboard/reports/${video.latestReportId}`}
                      >
                        <Badge variant="default">
                          <FileText className="mr-1 h-3 w-3" />
                          已生成
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="secondary">暂无</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(video.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/videos/${video.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(video.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {hasRole('OPERATOR') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(video.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Video}
                      title="暂无视频"
                      description={currentFolderId ? '该文件夹内暂无视频' : '上传视频后即可在此处管理和查看'}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

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

      {/* 上传对话框 */}
      <VideoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultFolderId={currentFolderId || undefined}
      />

      {/* 删除视频确认对话框 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后视频文件和关联数据将无法恢复，确定继续？
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

      {/* 新建/重命名文件夹对话框 */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolderId ? '重命名文件夹' : '新建文件夹'}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>文件夹名称</Label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="例如：品牌A"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleFolderSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleFolderSubmit}
              disabled={!folderName.trim() || createFolderMutation.isPending || renameFolderMutation.isPending}
            >
              {editingFolderId ? '确认' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除文件夹确认对话框 */}
      <Dialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除文件夹</DialogTitle>
            <DialogDescription>
              仅允许删除空文件夹，请先移除文件夹内的视频。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteFolderId && deleteFolderMutation.mutate(deleteFolderId)}
              disabled={deleteFolderMutation.isPending}
            >
              {deleteFolderMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
