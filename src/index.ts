import 'dotenv/config';
import { createApp } from './app';

// 环境变量验证
const requiredEnvVars = ['OPENROUTER_API_KEY'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('缺少必需的环境变量:', missing.join(', '));
  console.error('请创建 .env 文件并设置这些变量');
  process.exit(1);
}

const app = createApp();
const PORT = parseInt(process.env.PORT || '3000');

// 启动服务器
app.listen(PORT, () => {
  console.log(`LiteraArena 服务器运行在 http://localhost:${PORT}`);
  console.log(`OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? '已设置' : '未设置'}`);
  console.log(`最大并发数: ${process.env.MAX_CONCURRENT || '3'}`);
});
