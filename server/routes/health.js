const express = require('express');
const router = express.Router();

// ヘルスチェックエンドポイント
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 詳細ヘルスチェック
router.get('/detailed', async (req, res) => {
  try {
    // AI APIへの接続テスト
    const aiApiUrl = process.env.AI_API_URL || 'http://127.0.0.1:1234';

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      ai_api: {
        url: aiApiUrl,
        configured: !!process.env.AI_API_URL
      }
    };

    res.json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;