const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const aiRoutes = require('./routes/ai');
const healthRoutes = require('./routes/health');
const loggerMiddleware = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: false // 開発環境用
}));

// CORS設定
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true
}));

// レート制限
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'レート制限に達しました。しばらく時間をおいてから再度お試しください。'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// JSONパーサー
app.use(express.json({ limit: '10mb' }));

// ログミドルウェア
app.use(loggerMiddleware);

// ルート設定
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);

// エラーハンドリング
app.use(errorHandler);

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'エンドポイントが見つかりません',
    path: req.originalUrl
  });
});

// サーバー起動
app.listen(PORT, () => {
  logger.info(`APIプロキシサーバーが起動しました: http://localhost:${PORT}`);
  logger.info(`AI API URL: ${process.env.AI_API_URL || 'http://127.0.0.1:1234'}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERMを受信しました。サーバーを終了します...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINTを受信しました。サーバーを終了します...');
  process.exit(0);
});

module.exports = app;