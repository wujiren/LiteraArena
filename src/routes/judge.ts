import { Router } from 'express';
import type { ApiResponse, JudgeRequest, JudgeResult } from '../types/index';
import { getOpenRouterService } from '../services/openrouter';
import { shuffle, normalizeScores, extractUuids, filterExpectedUuids } from '../utils/shuffle';

const router = Router();

/**
 * POST /api/judge
 * 裁判打分
 *
 * 注意：MVP阶段信任客户端传入的texts数据。
 * 后续版本应引入服务端持久化，由服务端直接传入验证过的文本。
 */
router.post('/', async (req, res) => {
  try {
    const { topic, texts, judgeModelId } = req.body as JudgeRequest;

    // 验证参数
    if (!topic || !texts || texts.length < 2 || !judgeModelId) {
      const response: ApiResponse<never> = {
        success: false,
        error: '必须提供 topic、texts（至少2篇）和 judgeModelId',
      };
      res.status(400).json(response);
      return;
    }

    // 随机打乱文本顺序（匿名化）
    const shuffledTexts = shuffle(texts);

    // 构造裁判Prompt
    const prompt = buildJudgePrompt(topic, shuffledTexts);

    // 调用裁判模型
    const service = getOpenRouterService();
    const judgeResponse = await service.chatCompletion(judgeModelId, [
      { role: 'system', content: '你是一位严格的文学评判专家。' },
      { role: 'user', content: prompt },
    ]);

    // 解析裁判输出
    const ranking = parseJudgeResponse(
      judgeResponse,
      texts.map((t) => t.id),
    );

    if (!ranking || ranking.length < texts.length) {
      const response: ApiResponse<never> = {
        success: false,
        error: '裁判输出解析失败，请重试',
      };
      res.status(500).json(response);
      return;
    }

    // 标准化分数
    const scores = normalizeScores(ranking);

    const result: JudgeResult = {
      ranking,
      scores,
    };

    const response: ApiResponse<JudgeResult> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR [judge.post]:`, error);
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '裁判打分失败',
    };
    res.status(500).json(response);
  }
});

/**
 * 构造裁判Prompt
 */
export function buildJudgePrompt(
  topic: { title: string; description: string },
  texts: { id: string; content: string }[],
): string {
  const textsSection = texts
    .map((t, i) => `文本${i + 1}（ID: ${t.id}）:\n${t.content}`)
    .join('\n\n');

  return `你是一位严格的文学评判专家。请根据以下写作题目，对提供的多篇文本进行排序。

【写作题目】
${topic.title}
${topic.description}

【评分标准】
1. 语言流畅度（30%）
2. 创意性（25%）
3. 结构完整性（25%）
4. 风格匹配度（20%）

【待评判文本】
${textsSection}

请严格按照以下格式输出排序结果，每行一个：
最佳: [UUID]
次佳: [UUID]
第三: [UUID]
...
最差: [UUID]

只输出排序结果，不要其他解释文字。`;
}

/**
 * 解析裁判模型的输出
 * 优先级：方法1（结构化格式） > 方法2（白名单UUID过滤）
 */
export function parseJudgeResponse(response: string, expectedIds: string[]): string[] | null {
  // 方法1：匹配结构化格式（最佳/次佳/第三/第X名/最差）
  const lines = response.split('\n');
  const ranking: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /(?:最佳|次佳|第三|第(\d+)名|最差)\s*[:：]\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (match) {
      ranking.push(match[2].toLowerCase());
    }
  }

  // 方法2：如果方法1不足，使用白名单UUID过滤
  if (ranking.length < expectedIds.length) {
    const allUuids = extractUuids(response);
    const filteredUuids = filterExpectedUuids(allUuids, expectedIds);

    // 按在响应中出现的顺序排序（去重后）
    if (filteredUuids.length >= expectedIds.length) {
      const orderMap = new Map<string, number>();
      filteredUuids.forEach((uuid) => {
        orderMap.set(uuid, response.toLowerCase().indexOf(uuid));
      });
      filteredUuids.sort((a, b) => orderMap.get(a)! - orderMap.get(b)!);

      // 验证是否包含所有期望的UUID
      const hasAllExpected = expectedIds.every((id) =>
        filteredUuids.some((u) => u === id.toLowerCase()),
      );

      if (hasAllExpected) {
        return filteredUuids;
      }
    }
  }

  return ranking.length >= expectedIds.length ? ranking : null;
}

export default router;
