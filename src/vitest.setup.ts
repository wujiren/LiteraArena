import { vi } from 'vitest';

// Mock 环境变量
process.env.OPENROUTER_API_KEY = 'test-mock-key';

// 仅在 CI 环境中静默 console.error，减少测试输出噪音
if (process.env.CI) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
