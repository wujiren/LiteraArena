# LiteraArena - LLM 写作能力测试平台

一个用于测试和评判大型语言模型（LLM）写作能力的平台。通过提供写作题目、并行生成多篇文本、匿名评分排序，全面评估不同模型的写作表现。

---

## 目录

- [功能特性](#功能特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [配置说明](#配置说明)
- [项目结构](#项目结构)
- [评分系统](#评分系统)
- [测试](#测试)

---

## 功能特性

| 特性               | 说明                                              |
| ------------------ | ------------------------------------------------- |
| **多模型并行生成** | 支持同时调用多个 LLM 生成文本，并发数可配置       |
| **匿名评分系统**   | 文本以 UUID 匿名标识，评分前打乱顺序避免偏见      |
| **灵活的题目管理** | Markdown 格式存储写作题目，易于扩展               |
| **智能解析**       | 支持多种排名格式解析（最佳/次佳/第三/第X名/最差） |
| **容错机制**       | 部分模型失败不影响整体，支持 warnings 返回        |
| **可重现测试**     | Fisher-Yates 洗牌算法支持种子控制，确保结果可复现 |

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端                                   │
└─────────────────────────┬─────────────────────────────────────────┘
                          │ HTTP 请求
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express Server                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ /health │ │ /topics │ │/generate│ │ /judge  │  ...           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘                │
│       │           │           │           │                     │
│  ┌────┴───────────┴───────────┴───────────┴────┐               │
│  │              路由层 (Routes)                  │               │
│  └────────────────────┬─────────────────────────┘               │
│                      │                                          │
│  ┌────────────────────┴─────────────────────────┐               │
│  │              服务层 (Services)                  │               │
│  │  ┌──────────────┐  ┌──────────────────────┐   │               │
│  │  │ OpenRouter   │  │ TopicService        │   │               │
│  │  │ Service      │  │                      │   │               │
│  │  └──────┬───────┘  └──────────────────────┘   │               │
│  └─────────┼────────────────────────────────────┘               │
│            │                                           │
│            ▼                                           │
│  ┌─────────────────────────┐                            │
│  │    OpenRouter API       │                            │
│  │   (多模型调用)           │                            │
│  └─────────────────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户请求 → Express路由 → 服务层 → OpenRouter API → 评分排序 → 响应
```

---

## 快速开始

### 前置条件

- Node.js >= 18
- pnpm >= 8
- OpenRouter API Key

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd LiteraArena

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 OPENROUTER_API_KEY
```

### 启动

```bash
# 开发模式（热重载）
pnpm dev

# 生产构建
pnpm build
pnpm start

# 运行测试
pnpm test
```

服务启动后访问 http://localhost:3456/health 确认运行状态。

---

## API 文档

### 健康检查

**GET** `/health`

检查服务是否正常运行。

```json
// Response 200
{
  "status": "ok",
  "timestamp": "2026-05-18T02:30:00.000Z"
}
```

---

### 获取题目列表

**GET** `/api/topics`

获取所有可用写作题目。

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "落日余晖",
      "description": "描写\"落日余晖\"的场景，要求使用比喻和拟人手法，300字左右。"
    },
    {
      "id": 2,
      "title": "云端摩天阁序",
      "description": "请你接受一个高难度的文学挑战。请模仿王勃《滕王阁序》的风格和骈文体裁..."
    }
  ]
}
```

---

### 获取单个题目

**GET** `/api/topics/:id`

```json
// Response 200
{
  "success": true,
  "data": {
    "id": 1,
    "title": "落日余晖",
    "description": "描写\"落日余晖\"的场景..."
  }
}

// Response 404
{
  "success": false,
  "error": "题目不存在"
}
```

---

### 获取可用模型

**GET** `/api/models`

从 OpenRouter 获取所有可用模型列表。

```json
// Response 200
{
  "success": true,
  "data": [
    { "id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku" },
    { "id": "openai/gpt-4-turbo", "name": "GPT-4 Turbo" }
  ]
}
```

---

### 文本生成

**POST** `/api/generate`

为指定题目生成文本。

**Request Body:**

```json
{
  "topicId": 1,
  "modelIds": ["anthropic/claude-3-haiku", "openai/gpt-4-turbo"]
}
```

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "topicId": 1,
      "modelId": "anthropic/claude-3-haiku",
      "modelName": "Claude 3 Haiku",
      "content": "夕阳西沉，天边的云彩被染成了橘红色...",
      "createdAt": "2026-05-18T02:30:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "topicId": 1,
      "modelId": "openai/gpt-4-turbo",
      "modelName": "GPT-4 Turbo",
      "content": "当最后一缕阳光穿透云层...",
      "createdAt": "2026-05-18T02:30:01.000Z"
    }
  ],
  "warnings": []
}
```

**部分成功示例（含警告）:**

```json
{
  "success": true,
  "data": [...],
  "warnings": ["模型 openai/gpt-4-turbo 生成失败: rate limited"]
}
```

---

### 文本评分

**POST** `/api/judge`

使用 LLM 作为评委对文本进行匿名评分。

**Request Body:**

```json
{
  "topic": {
    "id": 1,
    "title": "落日余晖",
    "description": "描写\"落日余晖\"的场景..."
  },
  "texts": [
    { "id": "550e8400-e29b-41d4-a716-446655440000", "content": "夕阳西沉..." },
    { "id": "660e8400-e29b-41d4-a716-446655440001", "content": "当最后一缕阳光..." }
  ],
  "judgeModelId": "anthropic/claude-3-opus"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "ranking": ["660e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440000"],
    "scores": {
      "660e8400-e29b-41d4-a716-446655440001": 10,
      "550e8400-e29b-41d4-a716-446655440000": 8
    }
  }
}
```

---

### 一键比赛

**POST** `/api/compete`

一键完成文本生成和评分，组合了 `/api/generate` 和 `/api/judge` 的功能。

**Request Body:**

```json
{
  "topicId": 1,
  "modelIds": ["anthropic/claude-3-haiku", "openai/gpt-4-turbo"],
  "judgeModelId": "anthropic/claude-3-opus"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "texts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "topicId": 1,
        "modelId": "anthropic/claude-3-haiku",
        "modelName": "anthropic/claude-3-haiku",
        "content": "夕阳西沉，天边的云彩被染成了橘红色...",
        "createdAt": "2026-05-18T02:30:00.000Z"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "topicId": 1,
        "modelId": "openai/gpt-4-turbo",
        "modelName": "openai/gpt-4-turbo",
        "content": "当最后一缕阳光穿透云层...",
        "createdAt": "2026-05-18T02:30:01.000Z"
      }
    ],
    "judgeResult": {
      "ranking": ["660e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440000"],
      "scores": {
        "660e8400-e29b-41d4-a716-446655440001": 10,
        "550e8400-e29b-41d4-a716-446655440000": 8
      }
    }
  },
  "warnings": []
}
```

**说明：**

- 如果评分失败，`judgeResult` 为 `null`，但仍会返回生成的文本
- 部分模型生成失败时，会在 `warnings` 中返回错误信息

---

## 配置说明

### 环境变量

| 变量                 | 必填 | 默认值 | 说明                |
| -------------------- | ---- | ------ | ------------------- |
| `OPENROUTER_API_KEY` | 是   | -      | OpenRouter API 密钥 |
| `PORT`               | 否   | 3000   | 服务器监听端口      |
| `MAX_CONCURRENT`     | 否   | 3      | 最大并发 LLM 调用数 |
| `REQUEST_TIMEOUT`    | 否   | 300000 | 请求超时（毫秒）    |

### 题目管理

题目存储在 `data/tests.md`，使用 Markdown 格式：

```markdown
### 1. 落日余晖

> 描写"落日余晖"的场景，要求使用比喻和拟人手法，300字左右。

### 2. 云端摩天阁序

> 请你接受一个高难度的文学挑战。请模仿王勃《滕王阁序》的风格...
```

格式说明：

- `### N.` 定义题目 ID 和标题
- `>` 引用块定义题目描述（支持多行）

---

## 项目结构

```
LiteraArena/
├── .env                    # 环境变量配置
├── .vscode/
│   └── settings.json       # VSCode 配置（文件嵌套）
├── data/
│   └── tests.md            # 写作题目库
├── docs/                   # 项目文档
├── src/
│   ├── index.ts            # 服务器入口
│   ├── app.ts              # Express 应用工厂
│   ├── vitest.setup.ts     # 测试配置
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   ├── routes/             # 路由层
│   │   ├── topics.ts       # 题目相关 API
│   │   ├── models.ts       # 模型列表 API
│   │   ├── generate.ts     # 文本生成 API
│   │   ├── judge.ts        # 评分 API
│   │   ├── generate.test.ts
│   │   ├── judge.test.ts
│   │   └── integration.test.ts
│   ├── services/           # 服务层
│   │   ├── openrouter.ts   # OpenRouter API 封装
│   │   ├── topicService.ts # 题目加载/解析
│   │   └── topicService.test.ts
│   └── utils/              # 工具函数
│       ├── shuffle.ts      # Fisher-Yates 洗牌/评分
│       └── shuffle.test.ts
├── vitest.config.ts        # Vitest 测试配置
├── tsconfig.json           # TypeScript IDE 配置
├── tsconfig.build.json     # TypeScript 生产构建配置
└── package.json
```

---

## 评分系统

### 评分流程

```
1. 接收文本数组（每篇包含 UUID 和内容）
2. Fisher-Yates 洗牌打乱顺序（匿名化）
3. 构建评分 Prompt（含评分标准）
4. 调用 LLM 评委获取排名
5. 解析排名结果（支持多种格式）
6. 标准化分数返回
```

### 评分标准

LLM 评委按以下维度评分：

| 维度         | 权重 |
| ------------ | ---- |
| 语言流畅度   | 30%  |
| 创意与想象力 | 25%  |
| 文章结构     | 25%  |
| 风格匹配度   | 20%  |

### 分数转换

| 排名        | 分数  |
| ----------- | ----- |
| 第1名       | 10 分 |
| 第2名       | 8 分  |
| 第3名       | 6 分  |
| 第4名       | 4 分  |
| 第5名       | 2 分  |
| 第6名及以后 | 1 分  |

### 响应格式解析

系统支持两种排名格式解析：

**方法1：结构化格式**

```
最佳: <UUID>
次佳: <UUID>
最差: <UUID>
```

**方法2：UUID 白名单过滤**
若结构化解析失败，按 UUID 在响应中出现顺序排序。

---

## 测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式（文件变化时自动运行）
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

### 测试覆盖

| 测试文件               | 覆盖范围                       | 测试数量 |
| ---------------------- | ------------------------------ | -------- |
| `shuffle.test.ts`      | 洗牌算法、UUID提取、分数标准化 | 22       |
| `topicService.test.ts` | Markdown解析、题目加载         | 7        |
| `generate.test.ts`     | Prompt构建                     | 3        |
| `judge.test.ts`        | 响应解析、Prompt构建           | 16       |
| `integration.test.ts`  | API 端到端测试（含 compete）   | 21       |
| **总计**               |                                | **69**   |

### 门禁验收

```bash
pnpm check
```

包含：测试 → Prettier → ESLint → TypeScript 类型检查

---

## 技术栈

| 类别     | 技术               |
| -------- | ------------------ |
| 运行时   | Node.js >= 18      |
| 语言     | TypeScript         |
| 框架     | Express            |
| 测试     | Vitest + Supertest |
| 代码质量 | ESLint + Prettier  |
| LLM API  | OpenRouter         |
