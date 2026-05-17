/**
 * 写作题目
 */
export interface Topic {
  id: number;
  title: string;
  description: string;
}

/**
 * 生成的文本
 */
export interface GeneratedText {
  id: string; // UUID，用于匿名标识
  topicId: number;
  modelId: string; // 模型ID，如 "anthropic/claude-3-haiku"
  modelName: string; // 模型显示名，如 "Claude 3 Haiku"
  content: string; // 生成的文本内容
  createdAt: string; // ISO时间戳
}

/**
 * OpenRouter模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
}

/**
 * 打分请求
 */
export interface JudgeRequest {
  topic: Topic;
  texts: GeneratedText[];
  judgeModelId: string;
}

/**
 * 打分结果
 */
export interface JudgeResult {
  ranking: string[]; // UUID数组，按最佳到最差排序
  scores: Record<string, number>; // UUID -> 标准分数
}

/**
 * API响应统一格式
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[]; // 部分成功时的警告信息
}

/**
 * 生成请求
 */
export interface GenerateRequest {
  topicId: number;
  modelIds: string[];
}
