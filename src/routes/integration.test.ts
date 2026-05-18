import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getOpenRouterService } from '../services/openrouter';

// 共享 mock 函数引用
const mockGenerateText = vi.fn().mockResolvedValue('模拟的生成内容');
const mockChatCompletion = vi.fn().mockResolvedValue('模拟的裁判回复');
const mockGetModels = vi.fn().mockResolvedValue([
  { id: 'model-1', name: 'Model One' },
  { id: 'model-2', name: 'Model Two' },
]);

// 用于 compete 测试的 UUID
const competeUuids = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
];

// 模块级别 mock
vi.mock('../services/openrouter', () => ({
  getOpenRouterService: vi.fn(() => ({
    generateText: mockGenerateText,
    chatCompletion: mockChatCompletion,
    getModels: mockGetModels,
  })),
}));

// 每个测试前重置 mock 状态
beforeEach(() => {
  mockGenerateText.mockReset().mockResolvedValue('模拟的生成内容');
  mockChatCompletion.mockReset().mockResolvedValue('模拟的裁判回复');
});

describe('GET /health', () => {
  it('应返回200和ok状态', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/topics', () => {
  it('应返回所有题目', async () => {
    const res = await request(createApp()).get('/api/topics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('题目应有id、title、description', async () => {
    const res = await request(createApp()).get('/api/topics');
    const topic = res.body.data[0];
    expect(topic).toHaveProperty('id');
    expect(topic).toHaveProperty('title');
    expect(topic).toHaveProperty('description');
  });
});

describe('GET /api/topics/:id', () => {
  it('存在的题目应返回200', async () => {
    const res = await request(createApp()).get('/api/topics/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
  });

  it('不存在的题目应返回404', async () => {
    const res = await request(createApp()).get('/api/topics/999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/generate', () => {
  it('缺少topicId应返回400', async () => {
    const res = await request(createApp())
      .post('/api/generate')
      .send({ modelIds: ['model-1'] });
    expect(res.status).toBe(400);
  });

  it('缺少modelIds应返回400', async () => {
    const res = await request(createApp()).post('/api/generate').send({ topicId: 1 });
    expect(res.status).toBe(400);
  });

  it('modelIds为空数组应返回400', async () => {
    const res = await request(createApp()).post('/api/generate').send({ topicId: 1, modelIds: [] });
    expect(res.status).toBe(400);
  });

  it('不存在的topicId应返回404', async () => {
    const res = await request(createApp())
      .post('/api/generate')
      .send({ topicId: 999, modelIds: ['model-1'] });
    expect(res.status).toBe(404);
  });

  it('成功时应返回GeneratedText数组', async () => {
    const res = await request(createApp())
      .post('/api/generate')
      .send({ topicId: 1, modelIds: ['model-1', 'model-2'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('content');
    expect(res.body.data[0]).toHaveProperty('modelId');
  });

  it('部分模型失败时应返回warnings', async () => {
    // 通过 mockResolvedValueOnce 实现部分失败
    mockGenerateText
      .mockResolvedValueOnce('成功内容')
      .mockRejectedValueOnce(new Error('rate limited'));

    const res = await request(createApp())
      .post('/api/generate')
      .send({ topicId: 1, modelIds: ['model-1', 'model-2'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.warnings).toBeDefined();
    expect(res.body.warnings.length).toBe(1);
  });
});

describe('POST /api/judge', () => {
  const testUuids = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
  ];

  it('缺少topic应返回400', async () => {
    const res = await request(createApp())
      .post('/api/judge')
      .send({
        texts: [
          { id: testUuids[0], content: '内容1' },
          { id: testUuids[1], content: '内容2' },
        ],
        judgeModelId: 'model-1',
      });
    expect(res.status).toBe(400);
  });

  it('texts少于2篇应返回400', async () => {
    const res = await request(createApp())
      .post('/api/judge')
      .send({
        topic: { id: 1, title: '测试', description: '测试' },
        texts: [{ id: testUuids[0], content: '内容' }],
        judgeModelId: 'model-1',
      });
    expect(res.status).toBe(400);
  });

  it('缺少judgeModelId应返回400', async () => {
    const res = await request(createApp())
      .post('/api/judge')
      .send({
        topic: { id: 1, title: '测试', description: '测试' },
        texts: [
          { id: testUuids[0], content: '内容1' },
          { id: testUuids[1], content: '内容2' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('成功时应返回ranking和scores', async () => {
    // 使用合法 UUID 格式
    mockChatCompletion.mockResolvedValue(
      `最佳: ${testUuids[0]}\n次佳: ${testUuids[1]}\n最差: ${testUuids[2]}`,
    );

    const res = await request(createApp())
      .post('/api/judge')
      .send({
        topic: { id: 1, title: '测试', description: '测试' },
        texts: [
          { id: testUuids[0], content: '内容1' },
          { id: testUuids[1], content: '内容2' },
          { id: testUuids[2], content: '内容3' },
        ],
        judgeModelId: 'model-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ranking).toBeDefined();
    expect(res.body.data.scores).toBeDefined();
  });
});

describe('POST /api/compete', () => {
  it('缺少topicId应返回400', async () => {
    const res = await request(createApp())
      .post('/api/compete')
      .send({ modelIds: ['model-1'], judgeModelId: 'judge-1' });
    expect(res.status).toBe(400);
  });

  it('缺少modelIds应返回400', async () => {
    const res = await request(createApp())
      .post('/api/compete')
      .send({ topicId: 1, judgeModelId: 'judge-1' });
    expect(res.status).toBe(400);
  });

  it('缺少judgeModelId应返回400', async () => {
    const res = await request(createApp())
      .post('/api/compete')
      .send({ topicId: 1, modelIds: ['model-1'] });
    expect(res.status).toBe(400);
  });

  it('不存在的topicId应返回404', async () => {
    const res = await request(createApp())
      .post('/api/compete')
      .send({ topicId: 999, modelIds: ['model-1'], judgeModelId: 'judge-1' });
    expect(res.status).toBe(404);
  });

  it('成功时应返回texts和judgeResult', async () => {
    mockGenerateText.mockResolvedValueOnce('生成的文本1').mockResolvedValueOnce('生成的文本2');
    mockChatCompletion.mockResolvedValue(`最佳: ${competeUuids[0]}\n次佳: ${competeUuids[1]}`);

    const res = await request(createApp())
      .post('/api/compete')
      .send({ topicId: 1, modelIds: ['model-1', 'model-2'], judgeModelId: 'judge-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.texts).toHaveLength(2);
    expect(res.body.data.judgeResult).toBeDefined();
    expect(res.body.data.judgeResult.ranking).toBeDefined();
    expect(res.body.data.judgeResult.scores).toBeDefined();
  });

  it('评分失败时应返回warnings但仍返回texts', async () => {
    mockGenerateText.mockResolvedValueOnce('生成的文本1').mockResolvedValueOnce('生成的文本2');
    mockChatCompletion.mockRejectedValue(new Error('judge failed'));

    const res = await request(createApp())
      .post('/api/compete')
      .send({ topicId: 1, modelIds: ['model-1', 'model-2'], judgeModelId: 'judge-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.texts).toHaveLength(2);
    expect(res.body.data.judgeResult).toBeNull();
    expect(res.body.warnings).toBeDefined();
  });
});
