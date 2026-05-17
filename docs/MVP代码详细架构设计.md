# MVP代码详细架构设计

## 1. 项目初始化

### 1.1 package.json

```json
{
  "name": "literaarena",
  "version": "1.0.0",
  "description": "LLM写作能力测试平台",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.0",
    "express": "^4.18.0",
    "p-limit": "^3.0.0",
    "seedrandom": "^3.0.5",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/seedrandom": "^3.0.0",
    "@types/uuid": "^9.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**注意**：`p-limit` v3 是 CommonJS 模块，因此 tsconfig 使用 CommonJS 模式。

### 1.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**说明**：
- 使用 `CommonJS` 模式以兼容 `p-limit` v3 等 CommonJS 依赖
- 配合 `tsx` 运行，无需编译即可执行
- 去掉 `.js` 后缀的 import（CommonJS 不需要）

---

## 2. 类型定义 (src/types/index.ts)

```typescript
/**
 * 写作题目
 */
export interface Topic {
  id: number;
  title: string;
  description: string;
}

/**
 * 生成的文本
 */
export interface GeneratedText {
  id: string;           // UUID，用于匿名标识
  topicId: number;
  modelId: string;      // 模型ID，如 "anthropic/claude-3-haiku"
  modelName: string;    // 模型显示名，如 "Claude 3 Haiku"
  content: string;      // 生成的文本内容
  createdAt: string;     // ISO时间戳
}

/**
 * OpenRouter模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
}

/**
 * 打分请求
 */
export interface JudgeRequest {
  topic: Topic;
  texts: GeneratedText[];
  judgeModelId: string;
}

/**
 * 打分结果
 */
export interface JudgeResult {
  ranking: string[];                  // UUID数组，按最佳到最差排序
  scores: Record<string, number>;    // UUID -> 标准分数
}

/**
 * API响应统一格式
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];  // 部分成功时的警告信息
}

/**
 * 生成请求
 */
export interface GenerateRequest {
  topicId: number;
  modelIds: string[];
}
```

---

## 3. 工具函数 (src/utils/shuffle.ts)

```typescript
import seedrandom from 'seedrandom';

/**
 * Fisher-Yates 洗牌算法
 * @param array 要打乱的数组
 * @param seed 可选的随机种子（用于可重现的测试）
 */
export function shuffle<T>(array: T[], seed?: string): T[] {
  const result = [...array];

  // 如果提供了种子，使用确定性随机
  const random = seed ? seedrandom(seed) : Math.random;

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * 分数标准化
 * @param ranking 排名数组（从最佳到最差）
 * @returns UUID -> 分数 的映射
 */
export function normalizeScores(ranking: string[]): Record<string, number> {
  const scoreMap: Record<string, number> = {};
  const scoreTable: Record<number, number> = {
    0: 10,  // 第1名
    1: 8,   // 第2名
    2: 6,   // 第3名
    3: 4,   // 第4名
    4: 2,   // 第5名
  };

  ranking.forEach((uuid, index) => {
    scoreMap[uuid] = scoreTable[index] ?? 1; // 第6名及以后给1分
  });

  return scoreMap;
}

/**
 * 提取文本中所有UUID（用于裁判结果解析）
 * @param text 文本内容
 * @returns 提取到的UUID数组
 */
export function extractUuids(text: string): string[] {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  return (text.match(uuidRegex) || []).map(u => u.toLowerCase());
}

/**
 * 验证UUID是否在预期列表中（白名单过滤 + 去重）
 * 保留首次出现顺序，避免重复UUID导致分数分配错误
 * @param uuids 所有提取到的UUID（可能包含重复）
 * @param expectedIds 预期存在的UUID列表
 * @returns 在预期列表中的UUID（去重后，保持首次出现顺序）
 */
export function filterExpectedUuids(uuids: string[], expectedIds: string[]): string[] {
  const expectedSet = new Set(expectedIds.map(id => id.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const u of uuids) {
    if (expectedSet.has(u) && !seen.has(u)) {
      seen.add(u);
      result.push(u);
    }
  }

  return result;
}
```

---

## 4. OpenRouter服务 (src/services/openrouter.ts)

```typescript
import axios, { AxiosInstance } from 'axios';
import type { ModelInfo } from '../types/index';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// 默认超时时间：5分钟（文学创作可能需要较长时间）
const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '300000');

export class OpenRouterService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string, timeout: number = DEFAULT_TIMEOUT) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: OPENROUTER_API_BASE,
      timeout,  // 可配置的超时时间
    });
  }

  /**
   * 获取所有可用模型
   */
  async getModels(): Promise<ModelInfo[]> {
    const response = await this.client.get('/models', {
      headers: this.getHeaders(),
    });

    // 解析OpenRouter返回的模型列表
    // 实际返回格式参考OpenRouter API文档
    const models = response.data.data || [];

    return models.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
    }));
  }

  /**
   * 发送聊天请求
   * @param modelId 模型ID
   * @param messages 消息数组
   */
  async chatCompletion(
    modelId: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    const response = await this.client.post(
      '/chat/completions',
      {
        model: modelId,
        messages,
      },
      {
        headers: this.getHeaders(),
      }
    );

    // 提取助手回复内容
    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new Error('OpenRouter返回为空');
    }

    return choice.message?.content || '';
  }

  /**
   * 生成文本
   * @param modelId 模型ID
   * @param prompt 用户提示词
   * @param systemPrompt 系统提示词（可选，默认值）
   */
  async generateText(
    modelId: string,
    prompt: string,
    systemPrompt: string = '你是一位优秀的作家，请根据题目要求创作文本。直接输出创作内容，不要添加任何解释、标题或前言。'
  ): Promise<string> {
    return this.chatCompletion(modelId, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]);
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://literaarena.local',
      'X-Title': 'LiteraArena',
      'Content-Type': 'application/json',
    };
  }
}

// 工厂函数
let instance: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (!instance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY未设置');
    }
    instance = new OpenRouterService(apiKey);
  }
  return instance;
}
```

---

## 5. 题目服务 (src/services/topicService.ts)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { Topic } from '../types/index';

/**
 * 从tests.md解析题目
 * 格式规范：见 data/tests.example.md
 */
export function loadTopics(): Topic[] {
  const filePath = path.join(process.cwd(), 'data', 'tests.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return parseTopicsFromMarkdown(content);
}

/**
 * 解析Markdown格式的题目
 *
 * 支持格式：
 * ### 1. 落日余晖
 * > 描写"落日余晖"的场景
 *
 * ### 2. 云端摩天阁序
 * > 请模仿王勃《滕王阁序》...
 */
function parseTopicsFromMarkdown(content: string): Topic[] {
  const topics: Topic[] = [];
  const lines = content.split('\n');

  let currentTopic: Partial<Topic> = {};

  for (const line of lines) {
    // 跳过空行
    if (!line.trim()) continue;

    // 检测题目编号（如 "### 1" 或 "### 2"）
    // 格式：### 数字. 标题 或 ### 数字 标题
    const titleMatch = line.match(/^###\s+(\d+)\.?\s*(.+)?$/);
    if (titleMatch) {
      // 保存上一个题目
      if (currentTopic.id) {
        topics.push(currentTopic as Topic);
      }
      currentTopic = {
        id: parseInt(titleMatch[1]),
        title: (titleMatch[2] || `题目${titleMatch[1]}`).trim(),
        description: '',
      };
      continue;
    }

    // 检测引用块（题目描述）
    if (line.startsWith('>')) {
      const quoteContent = line.substring(1).trim();
      if (currentTopic.description) {
        currentTopic.description += '\n' + quoteContent;
      } else {
        currentTopic.description = quoteContent;
      }
      continue;
    }

    // 非引用、非标题行：作为附加描述处理
    if (currentTopic.id && !line.startsWith('#') && line.trim()) {
      if (currentTopic.description) {
        currentTopic.description += '\n' + line.trim();
      }
    }
  }

  // 保存最后一个题目
  if (currentTopic.id) {
    topics.push(currentTopic as Topic);
  }

  return topics;
}

/**
 * 根据ID获取题目
 */
export function getTopicById(id: number): Topic | undefined {
  const topics = loadTopics();
  return topics.find(t => t.id === id);
}

/**
 * 获取所有题目
 */
export function getAllTopics(): Topic[] {
  return loadTopics();
}
```

### 5.1 tests.md 格式规范

```markdown
### 1. 落日余晖
> 描写"落日余晖"的场景，要求使用比喻和拟人手法，300字左右。

### 2. 云端摩天阁序
> 请你接受一个高难度的文学挑战。请模仿王勃《滕王阁序》的风格和骈文体裁，描绘未来都市的夜景。
```

---

## 6. 路由：题目 (src/routes/topics.ts)

```typescript
import { Router } from 'express';
import type { ApiResponse, Topic } from '../types/index';
import { getAllTopics, getTopicById } from '../services/topicService';

const router = Router();

/**
 * GET /api/topics
 * 获取所有题目
 */
router.get('/', (_req, res) => {
  try {
    const topics = getAllTopics();
    const response: ApiResponse<Topic[]> = {
      success: true,
      data: topics,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取题目失败',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/topics/:id
 * 获取单个题目
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const topic = getTopicById(id);

    if (!topic) {
      const response: ApiResponse<never> = {
        success: false,
        error: `题目 ${id} 不存在`,
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Topic> = {
      success: true,
      data: topic,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取题目失败',
    };
    res.status(500).json(response);
  }
});

export default router;
```

---

## 7. 路由：模型 (src/routes/models.ts)

```typescript
import { Router } from 'express';
import type { ApiResponse, ModelInfo } from '../types/index';
import { getOpenRouterService } from '../services/openrouter';

const router = Router();

/**
 * GET /api/models
 * 获取所有可用模型
 */
router.get('/', async (_req, res) => {
  try {
    const service = getOpenRouterService();
    const models = await service.getModels();

    const response: ApiResponse<ModelInfo[]> = {
      success: true,
      data: models,
    };
    res.json(response);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR [models.get]:`, error);
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取模型列表失败',
    };
    res.status(500).json(response);
  }
});

export default router;
```

---

## 8. 路由：生成 (src/routes/generate.ts)

```typescript
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
```

---

## 9. 路由：裁判 (src/routes/judge.ts)

```typescript
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
    const ranking = parseJudgeResponse(judgeResponse, texts.map(t => t.id));

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
function buildJudgePrompt(
  topic: { title: string; description: string },
  texts: { id: string; content: string }[]
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
function parseJudgeResponse(response: string, expectedIds: string[]): string[] | null {
  // 方法1：匹配结构化格式（最佳/次佳/第三/第X名/最差）
  const lines = response.split('\n');
  const ranking: string[] = [];

  for (const line of lines) {
    const match = line.match(/(?:最佳|次佳|第三|第(\d+)名|最差)\s*[:：]\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
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
      filteredUuids.forEach(uuid => {
        orderMap.set(uuid, response.toLowerCase().indexOf(uuid));
      });
      filteredUuids.sort((a, b) => orderMap.get(a)! - orderMap.get(b)!);

      // 验证是否包含所有期望的UUID
      const hasAllExpected = expectedIds.every(id =>
        filteredUuids.some(u => u === id.toLowerCase())
      );

      if (hasAllExpected) {
        return filteredUuids;
      }
    }
  }

  return ranking.length >= expectedIds.length ? ranking : null;
}

export default router;
```

---

## 10. 服务器入口 (src/index.ts)

```typescript
import 'dotenv/config';
import express from 'express';
import topicsRouter from './routes/topics';
import modelsRouter from './routes/models';
import generateRouter from './routes/generate';
import judgeRouter from './routes/judge';

// 环境变量验证
const requiredEnvVars = ['OPENROUTER_API_KEY'];
const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('缺少必需的环境变量:', missing.join(', '));
  console.error('请创建 .env 文件并设置这些变量');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// 中间件
app.use(express.json());

// 请求日志（简化版）
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/topics', topicsRouter);
app.use('/api/models', modelsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/judge', judgeRouter);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理（兜底）
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${new Date().toISOString()}] ERROR [unhandled]:`, err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`LiteraArena 服务器运行在 http://localhost:${PORT}`);
  console.log(`OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? '已设置' : '未设置'}`);
  console.log(`最大并发数: ${process.env.MAX_CONCURRENT || '3'}`);
});
```

---

## 11. 数据流图（更新版）

```
用户请求
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express Server                          │
│  (index.ts)                                                │
└─────────────────────────────────────────────────────────────┘
    │
    ├─ GET /api/topics ──────────────► topicService.ts
    │                                      │
    │                                      ▼
    │                                 读取 tests.md
    │                                      │
    │                                      ▼
    │                                 返回 Topic[]
    │
    ├─ GET /api/models ──────────────► openrouter.ts
    │                                      │
    │                                      ▼
    │                                 调用 OpenRouter API
    │                                      │
    │                                      ▼
    │                                 返回 ModelInfo[]
    │
    ├─ POST /api/generate ───────────► topicService.ts (获取题目)
    │   [可信输入: topicId, modelIds]      │
    │                                      ▼
    │                                 openrouter.ts (并发生成)
    │                                      │
    │                                      ▼
    │                                 返回 GeneratedText[]
    │
    └─ POST /api/judge ──────────────► shuffle.ts (随机打乱)
        [不可信输入: texts内容*]              │
                                         ▼
                                    openrouter.ts (调用裁判)
                                         │
                                         ▼
                                    parseJudgeResponse (解析结果)
                                         │
                                         ▼
                                    normalizeScores (标准化分数)
                                         │
                                         ▼
                                    返回 JudgeResult

* MVP阶段信任客户端传入的texts数据
```

---

## 12. 关键函数签名汇总

| 模块 | 函数 | 签名 |
|------|------|------|
| openrouter.ts | `OpenRouterService.getModels()` | `() => Promise<ModelInfo[]>` |
| openrouter.ts | `OpenRouterService.chatCompletion()` | `(modelId: string, messages: Message[]) => Promise<string>` |
| openrouter.ts | `OpenRouterService.generateText()` | `(modelId: string, prompt: string, systemPrompt?: string) => Promise<string>` |
| topicService.ts | `loadTopics()` | `() => Topic[]` |
| topicService.ts | `getTopicById()` | `(id: number) => Topic \| undefined` |
| topicService.ts | `getAllTopics()` | `() => Topic[]` |
| shuffle.ts | `shuffle()` | `<T>(array: T[], seed?: string) => T[]` |
| shuffle.ts | `normalizeScores()` | `(ranking: string[]) => Record<string, number>` |
| shuffle.ts | `extractUuids()` | `(text: string) => string[]` |
| shuffle.ts | `filterExpectedUuids()` | `(uuids: string[], expectedIds: string[]) => string[]` |
| generate.ts | `buildPrompt()` | `(topic: Topic) => string` |
| judge.ts | `buildJudgePrompt()` | `(topic: Topic, texts: Text[]) => string` |
| judge.ts | `parseJudgeResponse()` | `(response: string, expectedIds: string[]) => string[] \| null` |

---

## 13. 依赖关系图

```
index.ts
├── routes/topics.ts
│   └── services/topicService.ts
├── routes/models.ts
│   └── services/openrouter.ts
├── routes/generate.ts
│   ├── services/openrouter.ts
│   └── services/topicService.ts
└── routes/judge.ts
    ├── services/openrouter.ts
    └── utils/shuffle.ts

types/index.ts (所有模块共享)
```

---

## 14. 环境变量

| 变量 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| OPENROUTER_API_KEY | OpenRouter API密钥 | 是 | - |
| PORT | 服务器端口 | 否 | 3000 |
| MAX_CONCURRENT | 最大并发生成数 | 否 | 3 |
| REQUEST_TIMEOUT | 请求超时（毫秒） | 否 | 300000 |

启动时会验证 `OPENROUTER_API_KEY` 是否设置，缺失则报错退出。