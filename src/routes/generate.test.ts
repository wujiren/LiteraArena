import { describe, it, expect } from 'vitest';
import { buildPrompt } from './generate';

describe('buildPrompt', () => {
  it('应包含题目标题', () => {
    const topic = { id: 1, title: '落日余晖', description: '描写落日余晖' };
    const prompt = buildPrompt(topic);
    expect(prompt).toContain('落日余晖');
  });

  it('应包含题目描述', () => {
    const topic = { id: 1, title: '测试', description: '描写落日余晖' };
    const prompt = buildPrompt(topic);
    expect(prompt).toContain('描写落日余晖');
  });

  it('应使用【写作题目】和【要求】格式', () => {
    const topic = { id: 1, title: '测试', description: '描述' };
    const prompt = buildPrompt(topic);
    expect(prompt).toContain('【写作题目】');
    expect(prompt).toContain('【要求】');
  });
});
