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

    // OSS URL 可能含中文字符，GLM API 无法直接获取未编码的 URL
    const encodedVideoUrl = encodeURI(params.videoUrl);

    // GLM API 要求 content 为多模态数组，video_url 和 text 分别作为独立元素
    const body = {
      model: model.name,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'video_url', video_url: { url: encodedVideoUrl } },
            { type: 'text', text: params.prompt },
          ],
        },
      ],
    };

    const apiUrl = `${model.provider.baseUrl}/chat/completions`;

    this.logger.log(
      `Calling LLM API:\n` +
      `  URL: ${apiUrl}\n` +
      `  Model: ${model.name}\n` +
      `  Video URL: ${encodedVideoUrl}\n` +
      `  Prompt length: ${params.prompt.length} chars`,
    );
    this.logger.debug(`Request body: ${JSON.stringify(body, null, 2)}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${model.provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `GLM API error: ${response.status} ${errorText}\n` +
        `  Request body: ${JSON.stringify(body)}`,
      );
      throw new Error(`GLM API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
