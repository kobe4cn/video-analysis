import type { TaskStatus, TaskVideoStatus } from '../constants/status';

export interface CreateTaskRequest {
  name: string;
  videoIds: string[];
  skillId: string;
  modelId: string;
}

export interface TaskItem {
  id: string;
  name: string;
  status: TaskStatus;
  skillId: string;
  skillName: string;
  modelId: string;
  modelName: string;
  progress: number;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskDetail extends TaskItem {
  taskVideos: TaskVideoItem[];
}

export interface TaskVideoItem {
  id: string;
  videoId: string;
  videoTitle: string;
  status: TaskVideoStatus;
  reportId: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskProgressPayload {
  taskId: string;
  progress: number;
  currentVideoId: string;
  currentVideoTitle: string;
}

export interface TaskVideoCompletedPayload {
  taskId: string;
  taskVideoId: string;
  videoId: string;
  reportId: string;
}

export interface TaskVideoFailedPayload {
  taskId: string;
  taskVideoId: string;
  videoId: string;
  error: string;
}
