'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

interface TaskSocketCallbacks {
  onProgress?: (data: { taskId: string; progress: number; currentVideoId: string; currentVideoTitle: string }) => void;
  onVideoCompleted?: (data: { taskId: string; taskVideoId: string; videoId: string; reportId: string }) => void;
  onVideoFailed?: (data: { taskId: string; taskVideoId: string; videoId: string; error: string }) => void;
  onTaskCompleted?: (data: { taskId: string }) => void;
}

/**
 * 监听指定任务的 WebSocket 事件，在组件卸载或 taskId 变化时自动清理订阅。
 * 回调函数应使用 useCallback 包裹以避免不必要的重新订阅。
 */
export function useTaskSocket(taskId: string | null, callbacks: TaskSocketCallbacks) {
  useEffect(() => {
    if (!taskId) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    if (callbacks.onProgress) socket.on(`task:progress:${taskId}`, callbacks.onProgress);
    if (callbacks.onVideoCompleted) socket.on(`task:video:completed:${taskId}`, callbacks.onVideoCompleted);
    if (callbacks.onVideoFailed) socket.on(`task:video:failed:${taskId}`, callbacks.onVideoFailed);
    if (callbacks.onTaskCompleted) socket.on(`task:completed:${taskId}`, callbacks.onTaskCompleted);

    return () => {
      socket.off(`task:progress:${taskId}`);
      socket.off(`task:video:completed:${taskId}`);
      socket.off(`task:video:failed:${taskId}`);
      socket.off(`task:completed:${taskId}`);
    };
  }, [taskId, callbacks]);
}
