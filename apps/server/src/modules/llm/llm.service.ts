import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 调用 GLM 系列模型分析视频
   * 通过 video_url 传递视频地址，text 传递分析 prompt（来自 Skill 模块）
   */
  async analyzeVideo(params: {
    modelId: string;
    videoUrl: string;
    prompt: string;
  }): Promise<string> {
    // 从数据库读取 Model + Provider 配置（包含 baseUrl 和 apiKey）
    const model = await this.prisma.model.findUniqueOrThrow({
      where: { id: params.modelId },
      include: { provider: true },
    });

    // GLM API 要求 content 为多模态数组，video_url 和 text 分别作为独立元素
    const body = {
      model: model.name,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'video_url', video_url: { url: params.videoUrl } },
            { type: 'text', text: params.prompt },
          ],
        },
      ],
      thinking: { type: 'enabled' },
    };

    this.logger.log(
      `Calling LLM API: model=${model.name}, videoUrl=${params.videoUrl.substring(0, 50)}...`,
    );

    // GLM API 地址格式: baseUrl/chat/completions
    const response = await fetch(
      `${model.provider.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${model.provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`GLM API error: ${response.status} ${errorText}`);
      throw new Error(`GLM API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
