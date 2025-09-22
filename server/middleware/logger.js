const logger = require('../utils/logger');

const loggerMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // レスポンス完了時のログ
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Error', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

module.exports = loggerMiddleware;