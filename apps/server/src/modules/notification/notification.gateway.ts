import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/** WebSocket 网关，向前端推送任务处理进度 */
@WebSocketGateway({
  cors: { origin: 'http://localhost:3000' },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id}, userId: ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** 推送任务整体进度 */
  emitTaskProgress(payload: {
    taskId: string;
    progress: number;
    currentVideoId: string;
    currentVideoTitle: string;
  }) {
    this.server.emit(`task:progress:${payload.taskId}`, payload);
  }

  /** 推送单视频分析完成 */
  emitTaskVideoCompleted(payload: {
    taskId: string;
    taskVideoId: string;
    videoId: string;
    reportId: string;
  }) {
    this.server.emit(`task:video:completed:${payload.taskId}`, payload);
  }

  /** 推送单视频分析失败 */
  emitTaskVideoFailed(payload: {
    taskId: string;
    taskVideoId: string;
    videoId: string;
    error: string;
  }) {
    this.server.emit(`task:video:failed:${payload.taskId}`, payload);
  }

  /** 推送任务整体完成 */
  emitTaskCompleted(taskId: string) {
    this.server.emit(`task:completed:${taskId}`, { taskId });
  }
}
