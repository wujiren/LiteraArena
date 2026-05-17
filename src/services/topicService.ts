import * as fs from 'fs';
import * as path from 'path';
import type { Topic } from '../types/index';

/**
 * 从tests.md解析题目
 * 格式规范：见 data/tests.example.md
 */
export function loadTopics(): Topic[] {
  const filePath = path.join(process.cwd(), 'data', 'tests.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return parseTopicsFromMarkdown(content);
}

/**
 * 解析Markdown格式的题目
 *
 * 支持格式：
 * ### 1. 落日余晖
 * > 描写"落日余晖"的场景
 *
 * ### 2. 云端摩天阁序
 * > 请模仿王勃《滕王阁序》...
 */
function parseTopicsFromMarkdown(content: string): Topic[] {
  const topics: Topic[] = [];
  const lines = content.split('\n');

  let currentTopic: Partial<Topic> = {};

  for (const line of lines) {
    // 跳过空行
    if (!line.trim()) continue;

    // 检测题目编号（如 "### 1" 或 "### 2"）
    // 格式：### 数字. 标题 或 ### 数字 标题
    const titleMatch = line.match(/^###\s+(\d+)\.?\s*(.+)?$/);
    if (titleMatch) {
      // 保存上一个题目
      if (currentTopic.id) {
        topics.push(currentTopic as Topic);
      }
      currentTopic = {
        id: parseInt(titleMatch[1]),
        title: (titleMatch[2] || `题目${titleMatch[1]}`).trim(),
        description: '',
      };
      continue;
    }

    // 检测引用块（题目描述）
    if (line.startsWith('>')) {
      const quoteContent = line.substring(1).trim();
      if (currentTopic.description) {
        currentTopic.description += '\n' + quoteContent;
      } else {
        currentTopic.description = quoteContent;
      }
      continue;
    }

    // 非引用、非标题行：作为附加描述处理
    if (currentTopic.id && !line.startsWith('#') && line.trim()) {
      if (currentTopic.description) {
        currentTopic.description += '\n' + line.trim();
      }
    }
  }

  // 保存最后一个题目
  if (currentTopic.id) {
    topics.push(currentTopic as Topic);
  }

  return topics;
}

/**
 * 根据ID获取题目
 */
export function getTopicById(id: number): Topic | undefined {
  const topics = loadTopics();
  return topics.find((t) => t.id === id);
}

/**
 * 获取所有题目
 */
export function getAllTopics(): Topic[] {
  return loadTopics();
}
