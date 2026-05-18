import { Router } from 'express';
import type { ApiResponse, GeneratedText, JudgeResult } from '../types/index';
import { getOpenRouterService } from '../services/openrouter';
import { getTopicById } from '../services/topicService';
import { buildPrompt } from './generate';
import { buildJudgePrompt, parseJudgeResponse } from './judge';
import { shuffle, normalizeScores } from '../utils/shuffle';
import pLimit from 'p-limit';

const router = Router();

// 并发限制数
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3');
const limit = pLimit(MAX_CONCURRENT);

interface CompeteRequest {
  topicId: number;
  modelIds: string[];
  judgeModelId: string;
}

/**
 * POST /api/compete
 * 一键完成生成和评分
 */
router.post('/', async (req, res) => {
  try {
    const { topicId, modelIds, judgeModelId } = req.body as CompeteRequest;

    // 验证参数
    if (!topicId || !modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: '必须提供 topicId 和 modelIds（数组）',
      };
      res.status(400).json(response);
      return;
    }

    if (!judgeModelId) {
      const response: ApiResponse<never> = {
        success: false,
        error: '必须提供 judgeModelId',
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

    // 第一步：生成文本
    const prompt = buildPrompt(topic);
    const service = getOpenRouterService();

    const generationPromises = modelIds.map((modelId) =>
      limit(async () => {
        try {
          const content = await service.generateText(modelId, prompt);
          const generatedText: GeneratedText = {
            id: crypto.randomUUID(),
            topicId,
            modelId,
            modelName: modelId,
            content,
            createdAt: new Date().toISOString(),
          };
          return generatedText;
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] ERROR [compete.generate.${modelId}]:`,
            error,
          );
          throw error;
        }
      }),
    );

    const generationResults = await Promise.allSettled(generationPromises);

    // 收集成功生成的文本
    const generatedTexts: GeneratedText[] = [];
    const generationErrors: string[] = [];

    generationResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        generatedTexts.push(result.value);
      } else {
        const detail =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        generationErrors.push(`模型 ${modelIds[index]} 生成失败: ${detail}`);
      }
    });

    if (generatedTexts.length < 2) {
      const response: ApiResponse<never> = {
        success: false,
        error: '至少需要2篇成功生成的文本才能进行评分',
      };
      res.status(400).json(response);
      return;
    }

    // 第二步：评分
    const shuffledTexts = shuffle(generatedTexts);
    const judgePrompt = buildJudgePrompt(topic, shuffledTexts);

    let judgeResult: JudgeResult | null = null;
    let judgeError: string | null = null;

    try {
      const judgeResponse = await service.chatCompletion(judgeModelId, [
        { role: 'system', content: '你是一位严格的文学评判专家。' },
        { role: 'user', content: judgePrompt },
      ]);

      const ranking = parseJudgeResponse(
        judgeResponse,
        generatedTexts.map((t) => t.id),
      );

      if (!ranking || ranking.length < generatedTexts.length) {
        judgeError = '裁判输出解析失败';
      } else {
        const scores = normalizeScores(ranking);
        judgeResult = { ranking, scores };
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ERROR [compete.judge]:`, error);
      judgeError = error instanceof Error ? error.message : '裁判打分失败';
    }

    // 构建响应
    const response: ApiResponse<{
      texts: GeneratedText[];
      judgeResult: JudgeResult | null;
    }> = {
      success: true,
      data: {
        texts: generatedTexts,
        judgeResult,
      },
    };

    // 添加警告信息
    if (generationErrors.length > 0) {
      response.warnings = response.warnings || [];
      response.warnings.push(...generationErrors);
    }

    if (judgeError) {
      response.warnings = response.warnings || [];
      response.warnings.push(judgeError);
    }

    res.json(response);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR [compete.post]:`, error);
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '比赛失败',
    };
    res.status(500).json(response);
  }
});

export default router;
