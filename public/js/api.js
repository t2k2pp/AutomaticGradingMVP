// API通信クラス

class APIClient {
    constructor() {
        this.baseURL = 'http://localhost:8000/api';
        this.timeout = 30000; // 30秒タイムアウト
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1秒
    }

    // 基本的なHTTPリクエスト
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        // タイムアウト制御
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        config.signal = controller.signal;

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    errorData.error || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new APIError('リクエストがタイムアウトしました', 408);
            }

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError(
                'ネットワークエラーが発生しました',
                0,
                { originalError: error.message }
            );
        }
    }

    // リトライ機能付きリクエスト
    async requestWithRetry(method, endpoint, data = null, options = {}) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await this.request(method, endpoint, data, options);
            } catch (error) {
                lastError = error;

                // リトライしない条件
                if (error.status >= 400 && error.status < 500) {
                    throw error; // クライアントエラーはリトライしない
                }

                if (attempt < this.retryAttempts) {
                    console.warn(`API request failed (attempt ${attempt}):`, error.message);
                    await new Promise(resolve =>
                        setTimeout(resolve, this.retryDelay * attempt)
                    );
                }
            }
        }

        throw lastError;
    }

    // AI採点リクエスト
    async gradeAnswer(gradingData) {
        try {
            console.log('AI採点リクエストを送信中...');

            const response = await this.requestWithRetry('POST', '/ai/grade', gradingData);

            console.log('AI採点が完了しました');
            return response;
        } catch (error) {
            console.error('AI採点エラー:', error);
            throw new Error(`AI採点に失敗しました: ${error.message}`);
        }
    }

    // モデル一覧取得
    async getModels() {
        try {
            const response = await this.request('GET', '/ai/models');
            return response;
        } catch (error) {
            console.error('モデル一覧取得エラー:', error);
            throw new Error(`モデル一覧の取得に失敗しました: ${error.message}`);
        }
    }

    // ヘルスチェック
    async healthCheck() {
        try {
            const response = await this.request('GET', '/health');
            return response;
        } catch (error) {
            console.error('ヘルスチェックエラー:', error);
            throw new Error(`ヘルスチェックに失敗しました: ${error.message}`);
        }
    }

    // 詳細ヘルスチェック
    async detailedHealthCheck() {
        try {
            const response = await this.request('GET', '/health/detailed');
            return response;
        } catch (error) {
            console.error('詳細ヘルスチェックエラー:', error);
            throw new Error(`詳細ヘルスチェックに失敗しました: ${error.message}`);
        }
    }

    // 接続状態の確認
    async checkConnection() {
        try {
            await this.healthCheck();
            return true;
        } catch (error) {
            return false;
        }
    }

    // 設定の更新
    updateConfig(config) {
        if (config.baseURL) {
            this.baseURL = config.baseURL;
        }
        if (config.timeout) {
            this.timeout = config.timeout;
        }
        if (config.retryAttempts) {
            this.retryAttempts = config.retryAttempts;
        }
        if (config.retryDelay) {
            this.retryDelay = config.retryDelay;
        }
    }
}

// カスタムエラークラス
class APIError extends Error {
    constructor(message, status = 0, details = {}) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.details = details;
    }
}

// グローバルAPIクライアントインスタンス
window.apiClient = new APIClient();

// 接続状態監視
class ConnectionMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isServerOnline = false;
        this.checkInterval = 30000; // 30秒間隔
        this.intervalId = null;

        this.init();
    }

    init() {
        // ブラウザのオンライン状態監視
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectionStatus();
            this.startServerCheck();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.isServerOnline = false;
            this.updateConnectionStatus();
            this.stopServerCheck();
        });

        // 初期状態の確認
        if (this.isOnline) {
            this.startServerCheck();
        } else {
            this.updateConnectionStatus();
        }
    }

    async startServerCheck() {
        // 既存のチェックを停止
        this.stopServerCheck();

        // 即座に1回チェック
        await this.checkServer();

        // 定期チェックを開始
        this.intervalId = setInterval(async () => {
            await this.checkServer();
        }, this.checkInterval);
    }

    stopServerCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async checkServer() {
        if (!this.isOnline) {
            return;
        }

        try {
            const isConnected = await window.apiClient.checkConnection();
            const wasOnline = this.isServerOnline;
            this.isServerOnline = isConnected;

            if (wasOnline !== isConnected) {
                this.updateConnectionStatus();

                if (isConnected) {
                    appEvents.emit('serverConnected');
                } else {
                    appEvents.emit('serverDisconnected');
                }
            }
        } catch (error) {
            const wasOnline = this.isServerOnline;
            this.isServerOnline = false;

            if (wasOnline) {
                this.updateConnectionStatus();
                appEvents.emit('serverDisconnected');
            }
        }
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        const indicatorElement = statusElement?.previousElementSibling;

        if (!statusElement) return;

        if (!this.isOnline) {
            statusElement.textContent = 'オフライン';
            if (indicatorElement) {
                indicatorElement.className = 'fas fa-circle';
                indicatorElement.style.color = 'var(--danger-500)';
            }
        } else if (this.isServerOnline) {
            statusElement.textContent = '接続中';
            if (indicatorElement) {
                indicatorElement.className = 'fas fa-circle';
                indicatorElement.style.color = 'var(--success-500)';
            }
        } else {
            statusElement.textContent = 'サーバー未接続';
            if (indicatorElement) {
                indicatorElement.className = 'fas fa-circle';
                indicatorElement.style.color = 'var(--warning-500)';
            }
        }
    }

    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            isServerOnline: this.isServerOnline,
            status: !this.isOnline ? 'offline' :
                   this.isServerOnline ? 'connected' : 'disconnected'
        };
    }
}

// グローバル接続監視インスタンス
window.connectionMonitor = new ConnectionMonitor();

// API設定管理
class APISettings {
    constructor() {
        this.settings = {
            baseURL: 'http://localhost:8000/api',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableRetry: true,
            enableLogging: true
        };

        this.load();
    }

    load() {
        const saved = storage.get('api_settings');
        if (saved) {
            this.settings = { ...this.settings, ...saved };
            window.apiClient.updateConfig(this.settings);
        }
    }

    save() {
        storage.set('api_settings', this.settings);
        window.apiClient.updateConfig(this.settings);
    }

    update(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.save();
    }

    get(key) {
        return this.settings[key];
    }

    getAll() {
        return { ...this.settings };
    }

    reset() {
        storage.remove('api_settings');
        this.settings = {
            baseURL: 'http://localhost:8000/api',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableRetry: true,
            enableLogging: true
        };
        this.save();
    }
}

// グローバルAPI設定インスタンス
window.apiSettings = new APISettings();

// リクエストログ管理
class RequestLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.enabled = true;
    }

    log(type, endpoint, data, response, duration, error = null) {
        if (!this.enabled) return;

        const logEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            type,
            endpoint,
            duration,
            success: !error,
            data: data ? JSON.stringify(data).substring(0, 500) : null,
            response: response ? JSON.stringify(response).substring(0, 500) : null,
            error: error ? error.message : null
        };

        this.logs.unshift(logEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        // デバッグ用コンソール出力
        if (window.apiSettings.get('enableLogging')) {
            console.log(`API ${type}:`, {
                endpoint,
                duration: `${duration}ms`,
                success: !error,
                ...(error && { error: error.message })
            });
        }
    }

    getLogs(count = 50) {
        return this.logs.slice(0, count);
    }

    clearLogs() {
        this.logs = [];
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}

// グローバルリクエストロガーインスタンス
window.requestLogger = new RequestLogger();