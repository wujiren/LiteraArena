import { readFileSync } from 'fs';
import { join } from 'path';

interface TestConfig {
  models: {
    generators: string[];
    judges: string[];
  };
  topicId: number;
}

// 加载测试配置
function loadTestConfig(): TestConfig {
  const configPath = join(process.cwd(), 'test-config.json');
  const content = readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as TestConfig;
}

const config = loadTestConfig();

console.log('\n[E2E] 真实 API 测试（使用配置模型）');
console.log(`[E2E] 生成模型: ${config.models.generators.join(', ')}`);
console.log(`[E2E] 评分模型: ${config.models.judges.join(', ')}`);
console.log(`[E2E] 题目ID: ${config.topicId}`);

// 导出配置供测试使用
export { config };

// 导出类型
export type { TestConfig };
