import axios, { AxiosInstance } from 'axios';
import type { ModelInfo } from '../types/index';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// 默认超时时间：5分钟（文学创作可能需要较长时间）
const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '300000');

export class OpenRouterService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string, timeout: number = DEFAULT_TIMEOUT) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: OPENROUTER_API_BASE,
      timeout, // 可配置的超时时间
    });
  }

  /**
   * 获取所有可用模型
   */
  async getModels(): Promise<ModelInfo[]> {
    const response = await this.client.get('/models', {
      headers: this.getHeaders(),
    });

    // 解析OpenRouter返回的模型列表
    // 实际返回格式参考OpenRouter API文档
    const models = response.data.data || [];

    return models.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
    }));
  }

  /**
   * 发送聊天请求
   * @param modelId 模型ID
   * @param messages 消息数组
   */
  async chatCompletion(
    modelId: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    const response = await this.client.post(
      '/chat/completions',
      {
        model: modelId,
        messages,
      },
      {
        headers: this.getHeaders(),
      },
    );

    // 提取助手回复内容
    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new Error('OpenRouter返回为空');
    }

    return choice.message?.content || '';
  }

  /**
   * 生成文本
   * @param modelId 模型ID
   * @param prompt 用户提示词
   * @param systemPrompt 系统提示词（可选，默认值）
   */
  async generateText(
    modelId: string,
    prompt: string,
    systemPrompt: string = '你是一位优秀的作家，请根据题目要求创作文本。直接输出创作内容，不要添加任何解释、标题或前言。',
  ): Promise<string> {
    return this.chatCompletion(modelId, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]);
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://literaarena.local',
      'X-Title': 'LiteraArena',
      'Content-Type': 'application/json',
    };
  }
}

// 工厂函数
let instance: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (!instance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY未设置');
    }
    instance = new OpenRouterService(apiKey);
  }
  return instance;
}
