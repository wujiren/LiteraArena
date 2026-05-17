# MVP方案详细文档

## 1. 项目概述

### 1.1 目标

构建一个最小可行的大语言模型写作能力测试平台，用于评估LLM在文学创作方面的能力（模仿风格、结构复刻、语言表达）。

### 1.2 范围

- 后端：TypeScript + Express
- 前端：后续实现
- 当前阶段：仅后端可运行

---

## 2. 技术架构

### 2.1 技术栈

| 组件       | 技术       | 版本  |
| ---------- | ---------- | ----- |
| 运行时     | Node.js    | >=18  |
| 语言       | TypeScript | ^5.0  |
| 框架       | Express    | ^4.18 |
| HTTP客户端 | axios      | ^1.6  |
| 环境变量   | dotenv     | ^16.0 |
| 并发控制   | p-limit    | ^3.0  |
| UUID生成   | uuid       | ^9.0  |

### 2.2 项目结构

```
/LiteraArena
├── package.json
├── tsconfig.json
├── .env                          # API密钥（不提交git）
├── .gitignore
├── src/
│   ├── index.ts                  # 入口，Express服务器启动
│   ├── routes/
│   │   ├── topics.ts             # 题目相关API
│   │   ├── generate.ts           # 文本生成API
│   │   └── judge.ts              # 裁判打分API
│   ├── services/
│   │   ├── openrouter.ts         # OpenRouter API封装
│   │   └── topicService.ts       # 题目管理服务
│   ├── types/
│   │   └── index.ts              # 共享类型定义
│   └── utils/
│       └── shuffle.ts            # 数组随机打乱工具
└── data/
    └── tests.md                  # 题目定义文件
```

---

## 3. 环境配置

### 3.1 .env 文件

```env
OPENROUTER_API_KEY=your_api_key_here
PORT=3000
MAX_CONCURRENT=3
```

### 3.2 配置说明

| 变量               | 说明               | 必填         |
| ------------------ | ------------------ | ------------ |
| OPENROUTER_API_KEY | OpenRouter API密钥 | 是           |
| PORT               | 服务器端口         | 否，默认3000 |
| MAX_CONCURRENT     | 最大并发生成数     | 否，默认3    |

---

## 4. 数据结构

### 4.1 类型定义 (src/types/index.ts)

```typescript
/**
 * 写作题目
 */
interface Topic {
  id: number;
  title: string;
  description: string;
}

/**
 * 生成的文本
 */
interface GeneratedText {
  id: string; // UUID，用于匿名标识
  topicId: number;
  modelId: string; // 模型ID，如 "anthropic/claude-3-haiku"
  modelName: string; // 模型显示名，如 "Claude 3 Haiku"
  content: string; // 生成的文本内容
  createdAt: string; // ISO时间戳
}

/**
 * 打分请求
 */
interface JudgeRequest {
  topic: Topic;
  texts: GeneratedText[];
  judgeModelId: string;
}

/**
 * 打分结果
 */
interface JudgeResult {
  ranking: string[]; // UUID数组，按最佳到最差排序
  scores: Record<string, number>; // UUID -> 标准分数
}

/**
 * API响应统一格式
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 4.2 分数标准化规则

| 排名 | 分数 |
| ---- | ---- |
| 1    | 10   |
| 2    | 8    |
| 3    | 6    |
| 4    | 4    |
| 5    | 2    |
| 6+   | 1    |

---

## 5. API设计

### 5.1 获取题目列表

**请求**

```
GET /api/topics
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "落日余晖",
      "description": "描写'落日余晖'。"
    },
    {
      "id": 2,
      "title": "云端摩天阁序",
      "description": "请你接受一个高难度的文学挑战..."
    }
  ]
}
```

### 5.2 获取可用模型

**请求**

```
GET /api/models
```

**响应**

```json
{
  "success": true,
  "data": [
    { "id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku" },
    { "id": "openai/gpt-4o-mini", "name": "GPT-4o Mini" }
  ]
}
```

### 5.3 生成文本

**请求**

```
POST /api/generate
Content-Type: application/json

{
  "topicId": 1,
  "modelIds": ["anthropic/claude-3-haiku", "openai/gpt-4o-mini"]
}
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "topicId": 1,
      "modelId": "anthropic/claude-3-haiku",
      "modelName": "Claude 3 Haiku",
      "content": "夕阳西沉，金色的光芒...",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 5.4 裁判打分

**请求**

```
POST /api/judge
Content-Type: application/json

{
  "topic": { "id": 1, "title": "落日余晖", "description": "描写'落日余晖'。" },
  "texts": [
    { "id": "uuid1", "content": "文本1内容", ... },
    { "id": "uuid2", "content": "文本2内容", ... }
  ],
  "judgeModelId": "openai/gpt-4o"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "ranking": ["uuid2", "uuid1", "uuid3"],
    "scores": {
      "uuid2": 10,
      "uuid1": 8,
      "uuid3": 6
    }
  }
}
```

---

## 6. 核心模块设计

### 6.1 OpenRouter服务 (src/services/openrouter.ts)

**功能**

- 封装OpenRouter API调用
- 获取模型列表
- 发送聊天请求
- 错误处理与日志

**API端点**

- 模型列表: `GET https://openrouter.ai/api/v1/models`
- 聊天完成: `POST https://openrouter.ai/api/v1/chat/completions`

**请求头要求**

```typescript
const headers = {
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  'HTTP-Referer': 'https://literaarena.local', // OpenRouter要求
  'X-Title': 'LiteraArena', // 应用名称
};
```

### 6.2 题目服务 (src/services/topicService.ts)

**功能**

- 从 `data/tests.md` 解析题目
- 提供题目查询接口

### 6.3 生成路由 (src/routes/generate.ts)

**流程**

1. 接收 topicId 和 modelIds
2. 查询题目详情
3. 构造Prompt（注入题目要求）
4. 并发调用OpenRouter（限制MAX_CONCURRENT）
5. 收集结果，返回GeneratedText[]

### 6.4 裁判路由 (src/routes/judge.ts)

**流程**

1. 接收 texts 和 judgeModelId
2. 随机打乱文本顺序（匿名化）
3. 构造裁判Prompt
4. 调用裁判模型
5. 解析排序结果
6. 标准化分数
7. 返回JudgeResult

### 6.5 裁判Prompt模板（改进版）

```
你是一位严格的文学评判专家。请根据以下写作题目，对提供的多篇文本进行排序。

【写作题目】
{topicTitle}
{description}

【评分标准】
1. 语言流畅度（30%）
2. 创意性（25%）
3. 结构完整性（25%）
4. 风格匹配度（20%）

【待评判文本】
{shuffledTexts}

请严格按照以下格式输出排序结果，每行一个：
最佳: [UUID]
次佳: [UUID]
第三: [UUID]
...
最差: [UUID]

只输出排序结果，不要其他解释文字。
```

**说明**：

- 使用结构化格式（最佳/次佳/第三...最差）而非数组，降低解析失败率
- 每个文本用UUID匿名标识，不暴露任何模型信息
- 文本顺序已随机打乱，避免顺序偏好

---

## 7. 并发控制

### 7.1 实现方式

使用 `p-limit` 库限制并发数：

```typescript
import pLimit from 'p-limit';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3');
const limit = pLimit(MAX_CONCURRENT);

// 并发生成
const results = await Promise.all(
  modelIds.map((modelId) => limit(() => generateText(modelId, topic))),
);
```

---

## 8. 错误处理

### 8.1 错误响应格式

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 8.2 简化错误处理策略（MVP阶段）

MVP采用"快速失败"策略：

- OpenRouter API错误 → 直接throw，500状态码返回
- 参数校验失败 → 400状态码
- 题目/模型不存在 → 404状态码

详细错误码和重试机制在后续迭代中完善。

### 8.3 裁判结果解析

裁判模型可能不完全遵循格式要求，解析逻辑：

```typescript
function parseJudgeResponse(response: string): string[] {
  // 1. 提取所有UUID（格式：8-4-4-4-12位hex）
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const uuids = response.match(uuidRegex) || [];

  // 2. 去重，保持首次出现顺序
  return [...new Set(uuids)];
}
```

如果解析失败（<2个UUID），返回错误提示，要求重新打分。

---

## 9. 测试验证

### 9.1 验证步骤

1. 启动服务器: `npm run dev`
2. 获取题目: `curl http://localhost:3000/api/topics`
3. 获取模型: `curl http://localhost:3000/api/models`
4. 生成文本: `curl -X POST http://localhost:3000/api/generate -d '{...}'`
5. 裁判打分: `curl -X POST http://localhost:3000/api/judge -d '{...}'`

---

## 10. 后续扩展

- [ ] 前端界面开发
- [ ] 多种打分方式（分数制、评语制）
- [ ] 结果导出（CSV/PDF）
- [ ] 数据库持久化（SQLite）
- [ ] 用户认证
- [ ] 历史记录管理
