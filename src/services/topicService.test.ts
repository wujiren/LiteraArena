import { describe, it, expect } from 'vitest';
import { parseTopicsFromMarkdown } from './topicService';

describe('parseTopicsFromMarkdown', () => {
  const validMarkdown = `
### 1. 落日余晖
> 描写"落日余晖"的场景

### 2. 云端摩天阁序
> 请模仿王勃《滕王阁序》
`;

  it('应解析出所有题目', () => {
    const topics = parseTopicsFromMarkdown(validMarkdown);
    expect(topics.length).toBe(2);
  });

  it('应正确提取id和title', () => {
    const topics = parseTopicsFromMarkdown(validMarkdown);
    expect(topics[0].id).toBe(1);
    expect(topics[0].title).toBe('落日余晖');
    expect(topics[1].id).toBe(2);
    expect(topics[1].title).toBe('云端摩天阁序');
  });

  it('应正确提取description', () => {
    const topics = parseTopicsFromMarkdown(validMarkdown);
    expect(topics[0].description).toContain('落日余晖');
  });

  it('应忽略空行', () => {
    const markdown = `
### 1. 测试

> 描述

### 2. 测试2

> 描述2
`;
    const topics = parseTopicsFromMarkdown(markdown);
    expect(topics.length).toBe(2);
  });

  it('应处理无标题的情况（使用默认标题）', () => {
    const markdown = `### 99`;
    const topics = parseTopicsFromMarkdown(markdown);
    expect(topics[0].title).toBe('题目99');
  });

  it('应合并多行description', () => {
    const markdown = `
### 1. 测试
> 第一行描述
> 第二行描述
`;
    const topics = parseTopicsFromMarkdown(markdown);
    expect(topics[0].description).toContain('第一行描述');
    expect(topics[0].description).toContain('第二行描述');
  });

  it('空输入应返回空数组', () => {
    expect(parseTopicsFromMarkdown('')).toEqual([]);
  });
});
