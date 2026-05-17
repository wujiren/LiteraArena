import { Router } from 'express';
import type { ApiResponse, ModelInfo } from '../types/index';
import { getOpenRouterService } from '../services/openrouter';

const router = Router();

/**
 * GET /api/models
 * 获取所有可用模型
 */
router.get('/', async (_req, res) => {
  try {
    const service = getOpenRouterService();
    const models = await service.getModels();

    const response: ApiResponse<ModelInfo[]> = {
      success: true,
      data: models,
    };
    res.json(response);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR [models.get]:`, error);
    const response: ApiResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : '获取模型列表失败',
    };
    res.status(500).json(response);
  }
});

export default router;
