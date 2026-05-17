import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import type { ApiResponse, GenerateRequest, GeneratedText, Topic } from '../types/index';
import { getOpenRouterService } from '../services/openrouter';
import { getTopicById } from '../services/topicService';

const router = Router();

// 并发限制数
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3');
const limit = pLimit(MAX_CONCURRENT);

/**
 * POST /api/generate
 * 生成文本
 */
router.post('/', async (req, res) => {
  try {
    const { topicId, modelIds } = req.body as GenerateRequest;

    // 验证参数
    if (!topicId || !modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '必须提供 topicId 和 modelIds（数组）',
      };
      res.status(400).json(response);
      return;
    }

    // 获取题目
    const topic = getTopicById(topicId);
    if (!topic) {
      const response: ApiResponse<never> = {
        success: false,
        error: `题目 ${topicId} 不存在`,
      };
      res.status(404).json(response);
      return;
    }

    // 构造提示词
    const prompt = buildPrompt(topic);

    // 并发生成
    const service = getOpenRouterService();
    const generationPromises = modelIds.map(modelId =>
      limit(async () => {
        try {
          const content = await service.generateText(modelId, prompt);
          const generatedText: GeneratedText = {
            id: uuidv4(),
            topicId,
            modelId,
            modelName: modelId, // 简化处理，实际可从模型列表获取名称
            content,
            createdAt: new Date().toISOString(),
          };
          return generatedText;
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ERROR [generate.${modelId}]:`, error);
          throw error;
        }
      })
    );

    const results = await Promise.allSettled(generationPromises);

    // 收集成功的结果
    const generatedTexts: GeneratedText[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        generatedTexts.push(result.value);
      } else {
        // 保留错误原因，便于调试
        const detail = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(`模型 ${modelIds[index]} 生成失败: ${detail}`);
      }
    });

    if (generatedTexts.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '所有模型生成失败',
      };
      res.status(500).json(response);
      return;
    }

    // 部分成功时返回警告信息
    const response: ApiResponse<GeneratedText[]> = {
      success: true,
      data: generatedTexts,
    };
    if (errors.length > 0) {
      response.warnings = errors;
    }
    res.json(response);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR [generate.post]:`, error);
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '生成文本失败',
    };
    res.status(500).json(response);
  }
});

/**
 * 构造生成提示词
 * 输出约束由system prompt管理，职责更清晰
 */
function buildPrompt(topic: Topic): string {
  return `【写作题目】${topic.title}

【要求】
${topic.description}`;
}

export default router;