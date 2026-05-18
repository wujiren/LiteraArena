import { describe, it, expect } from 'vitest';
import { shuffle, normalizeScores, extractUuids, filterExpectedUuids } from './shuffle';

describe('shuffle', () => {
  it('应返回与输入相同长度的数组', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result.length).toBe(input.length);
  });

  it('应包含所有原数组元素', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it('使用相同种子应产生相同结果', () => {
    const input = [1, 2, 3, 4, 5];
    const result1 = shuffle(input, 'seed123');
    const result2 = shuffle(input, 'seed123');
    expect(result1).toEqual(result2);
  });

  it('不应修改原数组', () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('空数组应返回空数组', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('单元素数组应返回相同元素', () => {
    expect(shuffle([1])).toEqual([1]);
  });
});

describe('normalizeScores', () => {
  it('第1名应得10分', () => {
    const scores = normalizeScores(['uuid1', 'uuid2']);
    expect(scores['uuid1']).toBe(10);
  });

  it('第2名应得8分', () => {
    const scores = normalizeScores(['uuid1', 'uuid2']);
    expect(scores['uuid2']).toBe(8);
  });

  it('第3名应得6分', () => {
    const scores = normalizeScores(['u1', 'u2', 'u3']);
    expect(scores['u3']).toBe(6);
  });

  it('第4名应得4分', () => {
    const scores = normalizeScores(['u1', 'u2', 'u3', 'u4']);
    expect(scores['u4']).toBe(4);
  });

  it('第5名应得2分', () => {
    const scores = normalizeScores(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(scores['u5']).toBe(2);
  });

  it('第6名及以后应得1分', () => {
    const scores = normalizeScores(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    expect(scores['u6']).toBe(1);
    expect(scores['u7']).toBe(1);
  });

  it('边界：只有1人时应得10分', () => {
    const scores = normalizeScores(['only-one']);
    expect(scores['only-one']).toBe(10);
  });
});

describe('extractUuids', () => {
  it('应提取文本中的所有UUID', () => {
    const text = '最佳: 550e8400-e29b-41d4-a716-446655440000';
    const result = extractUuids(text);
    expect(result).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('应返回小写结果', () => {
    const text = '550E8400-E29B-41D4-A716-446655440000';
    const result = extractUuids(text);
    expect(result[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('无UUID时应返回空数组', () => {
    expect(extractUuids('没有UUID的文本')).toEqual([]);
  });

  it('应提取多个UUID', () => {
    const text =
      'uuid1: 550e8400-e29b-41d4-a716-446655440000, uuid2: 660e8400-e29b-41d4-a716-446655440001';
    const result = extractUuids(text);
    expect(result.length).toBe(2);
  });
});

describe('filterExpectedUuids', () => {
  it('应去重', () => {
    const uuids = ['a', 'a', 'b', 'c'];
    const expected = ['a', 'b', 'c'];
    expect(filterExpectedUuids(uuids, expected)).toEqual(['a', 'b', 'c']);
  });

  it('应保留首次出现顺序', () => {
    const uuids = ['b', 'a', 'c', 'a'];
    const expected = ['a', 'b', 'c'];
    expect(filterExpectedUuids(uuids, expected)).toEqual(['b', 'a', 'c']);
  });

  it('应过滤不在expected中的UUID', () => {
    const uuids = ['a', 'b', 'c', 'x'];
    const expected = ['a', 'b'];
    expect(filterExpectedUuids(uuids, expected)).toEqual(['a', 'b']);
  });

  it('UUID比较应不区分大小写', () => {
    // 模拟真实场景：extractUuids 返回 lowercase，expectedIds 是原始大小写
    const uuids = ['aaaa', 'bbbb']; // extractUuids 的输出（小写）
    const expected = ['AAAA', 'BBBB']; // texts.map(t => t.id) 的原始值
    expect(filterExpectedUuids(uuids, expected)).toEqual(['aaaa', 'bbbb']);
  });

  it('空数组输入应返回空数组', () => {
    expect(filterExpectedUuids([], ['a', 'b'])).toEqual([]);
  });
});
