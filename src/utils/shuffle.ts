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