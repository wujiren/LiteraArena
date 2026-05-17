import 'dotenv/config';
import express from 'express';
import topicsRouter from './routes/topics';
import modelsRouter from './routes/models';
import generateRouter from './routes/generate';
import judgeRouter from './routes/judge';

// 环境变量验证
const requiredEnvVars = ['OPENROUTER_API_KEY'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('缺少必需的环境变量:', missing.join(', '));
  console.error('请创建 .env 文件并设置这些变量');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

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

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理（兜底）
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${new Date().toISOString()}] ERROR [unhandled]:`, err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`LiteraArena 服务器运行在 http://localhost:${PORT}`);
  console.log(`OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? '已设置' : '未设置'}`);
  console.log(`最大并发数: ${process.env.MAX_CONCURRENT || '3'}`);
});
