import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { config } from './setup';

describe('E2E - 真实 API 测试', () => {
  const app = createApp();

  describe('generate texts', () => {
    it('调用 /api/generate 验证真实生成', async () => {
      const res = await request(app).post('/api/generate').send({
        topicId: config.topicId,
        modelIds: config.models.generators,
      });

      console.log('\n[E2E] generate texts response:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(config.models.generators.length);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('content');
      expect(res.body.data[0].content.length).toBeGreaterThan(0);
    });
  });

  describe('judge texts', () => {
    it('调用 /api/judge 验证真实评分', async () => {
      // 先生成多个文本
      const genRes = await request(app).post('/api/generate').send({
        topicId: config.topicId,
        modelIds: config.models.generators,
      });

      const texts = genRes.body.data.map((t: { id: string; content: string }) => ({
        id: t.id,
        content: t.content,
      }));

      // 获取题目信息
      const topicRes = await request(app).get(`/api/topics/${config.topicId}`);
      const topic = topicRes.body.data;

      // 调用评分（使用第一个 judge）
      const res = await request(app).post('/api/judge').send({
        topic,
        texts,
        judgeModelId: config.models.judges[0],
      });

      console.log('\n[E2E] judge texts response:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ranking');
      expect(res.body.data).toHaveProperty('scores');
      expect(res.body.data.ranking.length).toBe(texts.length);
    });
  });

  describe('compete with all generators', () => {
    it('调用 /api/compete 验证一键比赛（多模型）', async () => {
      const res = await request(app).post('/api/compete').send({
        topicId: config.topicId,
        modelIds: config.models.generators,
        judgeModelId: config.models.judges[0],
      });

      console.log('\n[E2E] compete response:', JSON.stringify(res.body, null, 2));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('texts');
      expect(res.body.data).toHaveProperty('judgeResult');
      expect(res.body.data.texts.length).toBe(config.models.generators.length);
      expect(res.body.data.judgeResult).not.toBeNull();
      expect(res.body.data.judgeResult.ranking.length).toBe(config.models.generators.length);
    });
  });

  describe('multi-judge scoring', () => {
    it('使用多个 judge 分别评分并比较结果', async () => {
      // 先生成文本
      const genRes = await request(app).post('/api/generate').send({
        topicId: config.topicId,
        modelIds: config.models.generators,
      });

      const texts = genRes.body.data.map((t: { id: string; content: string }) => ({
        id: t.id,
        content: t.content,
      }));

      // 获取题目信息
      const topicRes = await request(app).get(`/api/topics/${config.topicId}`);
      const topic = topicRes.body.data;

      // 使用每个 judge 分别评分
      const results: { judge: string; ranking: string[] }[] = [];

      for (const judgeModelId of config.models.judges) {
        const res = await request(app).post('/api/judge').send({
          topic,
          texts,
          judgeModelId,
        });

        if (res.status === 200 && res.body.success) {
          results.push({
            judge: judgeModelId,
            ranking: res.body.data.ranking,
          });
        }
      }

      console.log('\n[E2E] multi-judge results:', JSON.stringify(results, null, 2));

      // 验证至少有 2 个 judge 成功
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
