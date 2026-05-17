import { Router } from 'express';
import type { ApiResponse, Topic } from '../types/index';
import { getAllTopics, getTopicById } from '../services/topicService';

const router = Router();

/**
 * GET /api/topics
 * 获取所有题目
 */
router.get('/', (_req, res) => {
  try {
    const topics = getAllTopics();
    const response: ApiResponse<Topic[]> = {
      success: true,
      data: topics,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取题目失败',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/topics/:id
 * 获取单个题目
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const topic = getTopicById(id);

    if (!topic) {
      const response: ApiResponse<never> = {
        success: false,
        error: `题目 ${id} 不存在`,
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Topic> = {
      success: true,
      data: topic,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取题目失败',
    };
    res.status(500).json(response);
  }
});

export default router;