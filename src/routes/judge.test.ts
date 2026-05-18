import { describe, it, expect } from 'vitest';
import { parseJudgeResponse, buildJudgePrompt } from './judge';

describe('parseJudgeResponse', () => {
  const uuids = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
  ];

  describe('结构化格式解析', () => {
    it('应解析"最佳"格式', () => {
      const response = `最佳: ${uuids[0]}
次佳: ${uuids[1]}
最差: ${uuids[2]}`;
      const result = parseJudgeResponse(response, uuids);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[0]);
    });

    it('应解析"次佳"格式（单条）', () => {
      // 只提供1个UUID，expectedIds 也只包含1个
      const singleUuid = [uuids[1]];
      const response = `次佳: ${uuids[1]}`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[1]);
    });

    it('应解析"第三"格式（单条）', () => {
      const singleUuid = [uuids[2]];
      const response = `第三: ${uuids[2]}`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[2]);
    });

    it('应解析"第X名"格式（多条）', () => {
      // expectedIds 只包含匹配到的 UUID，否则会返回 null
      const localUuids = [uuids[0], uuids[1]];
      const response = `第4名: ${uuids[0]}
第5名: ${uuids[1]}`;
      const result = parseJudgeResponse(response, localUuids);
      expect(result).not.toBeNull();
      expect(result).toContain(uuids[0]);
      expect(result).toContain(uuids[1]);
    });

    it('应解析"最差"格式（单条）', () => {
      const singleUuid = [uuids[2]];
      const response = `最差: ${uuids[2]}`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[2]);
    });

    it('应支持中文冒号', () => {
      const singleUuid = [uuids[0]];
      const response = `最佳：${uuids[0]}`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[0]);
    });
  });

  describe('UUID白名单过滤（方法2兜底）', () => {
    it('应按出现顺序排序', () => {
      const response = `文字${uuids[2]}开头，${uuids[0]}在中间，${uuids[1]}在最后`;
      const result = parseJudgeResponse(response, uuids);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[2]);
      expect(result![1]).toBe(uuids[0]);
      expect(result![2]).toBe(uuids[1]);
    });

    it('UUID应去重（保留首次出现）', () => {
      const singleUuid = [uuids[0]];
      const response = `${uuids[0]}出现两次${uuids[0]}，但应该只保留一次`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      const count = result!.filter((u) => u === uuids[0]).length;
      expect(count).toBe(1);
    });

    it('中文数字序数词应通过方法2兜底解析', () => {
      // "最佳"、"次佳"、"第三"是硬编码的，但"第四"、"第五"等不是
      // 这些会 fallback 到方法2，按UUID出现顺序排列
      const response = `第四: ${uuids[0]}
第二: ${uuids[1]}
第一: ${uuids[2]}`;
      const result = parseJudgeResponse(response, uuids);
      expect(result).not.toBeNull();
      expect(result).toContain(uuids[0]);
      expect(result).toContain(uuids[1]);
      expect(result).toContain(uuids[2]);
    });
  });

  describe('边界情况', () => {
    it('UUID不在expected列表中时应返回null', () => {
      const response = '最佳: 00000000-0000-0000-0000-000000000000';
      expect(parseJudgeResponse(response, uuids)).toBeNull();
    });

    it('完全没有UUID时应返回null', () => {
      expect(parseJudgeResponse('这些文章都写得不错', uuids)).toBeNull();
    });

    it('空字符串应返回null', () => {
      expect(parseJudgeResponse('', uuids)).toBeNull();
    });

    it('UUID大小写应不敏感', () => {
      const singleUuid = [uuids[0]];
      const upperUuid = uuids[0].toUpperCase();
      const response = `最佳: ${upperUuid}`;
      const result = parseJudgeResponse(response, singleUuid);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(uuids[0].toLowerCase());
    });
  });
});

describe('buildJudgePrompt', () => {
  it('应包含题目标题和描述', () => {
    const topic = { title: '测试标题', description: '测试描述' };
    const texts = [{ id: 'uuid1', content: '内容1' }];
    const prompt = buildJudgePrompt(topic, texts);
    expect(prompt).toContain('测试标题');
    expect(prompt).toContain('测试描述');
  });

  it('应包含所有文本ID和内容', () => {
    const topic = { title: '测试', description: '' };
    const texts = [
      { id: 'uuid1', content: '内容1' },
      { id: 'uuid2', content: '内容2' },
    ];
    const prompt = buildJudgePrompt(topic, texts);
    expect(prompt).toContain('uuid1');
    expect(prompt).toContain('内容1');
    expect(prompt).toContain('uuid2');
    expect(prompt).toContain('内容2');
  });

  it('应指定输出格式要求', () => {
    const topic = { title: '测试', description: '' };
    const texts = [{ id: 'uuid1', content: '内容' }];
    const prompt = buildJudgePrompt(topic, texts);
    expect(prompt).toContain('最佳');
    expect(prompt).toContain('最差');
  });
});
