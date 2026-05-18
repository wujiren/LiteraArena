import express from 'express';
import topicsRouter from './routes/topics';
import modelsRouter from './routes/models';
import generateRouter from './routes/generate';
import judgeRouter from './routes/judge';
import competeRouter from './routes/compete';

/**
 * 创建 Express 应用（供测试和服务器启动共用）
 */
export function createApp(): express.Express {
  const app = express();

  // 中间件
  app.use(express.json());

  // 请求日志（简化版）
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // 路由
  app.use('/api/topics', topicsRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/judge', judgeRouter);
  app.use('/api/compete', competeRouter);

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 错误处理（兜底）
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(`[${new Date().toISOString()}] ERROR [unhandled]:`, err);
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
      });
    },
  );

  return app;
}
