// メインアプリケーション

class Application {
    constructor() {
        this.version = '1.0.0';
        this.isInitialized = false;
        this.components = {};

        this.init();
    }

    async init() {
        try {
            // 初期化開始
            console.log('IPA PM AI採点システム初期化開始...');

            // データベース初期化
            await this.initializeDatabase();

            // コンポーネント初期化
            await this.initializeComponents();

            // イベントリスナー設定
            this.setupEventListeners();

            // アプリケーション状態の復元
            await this.restoreApplicationState();

            // 初期化完了
            this.isInitialized = true;
            console.log('IPA PM AI採点システム初期化完了');

            // 初期化完了のイベント発火
            appEvents.emit('applicationReady');

            // ウェルカムメッセージ
            this.showWelcomeMessage();

        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            this.showInitializationError(error);
        }
    }

    // データベース初期化
    async initializeDatabase() {
        try {
            await dbManager.init();
            console.log('データベース初期化完了');
        } catch (error) {
            throw new Error(`データベース初期化エラー: ${error.message}`);
        }
    }

    // コンポーネント初期化
    async initializeComponents() {
        try {
            // 各コンポーネントは既にグローバルインスタンスとして初期化済み
            this.components = {
                database: window.dbManager,
                api: window.apiClient,
                rules: window.ruleEvaluator,
                grading: window.gradingSystem,
                problems: window.problemManager,
                history: window.historyManager,
                export: window.exportManager,
                ui: window.uiManager,
                connection: window.connectionMonitor
            };

            console.log('コンポーネント初期化完了');
        } catch (error) {
            throw new Error(`コンポーネント初期化エラー: ${error.message}`);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // アプリケーションレベルのイベント
        appEvents.on('databaseError', (error) => {
            this.handleDatabaseError(error);
        });

        appEvents.on('apiError', (error) => {
            this.handleApiError(error);
        });

        appEvents.on('serverConnected', () => {
            showToast('サーバーに接続しました', 'success');
        });

        appEvents.on('serverDisconnected', () => {
            showToast('サーバーとの接続が切断されました', 'warning');
        });

        // パフォーマンス監視
        this.setupPerformanceMonitoring();

        console.log('イベントリスナー設定完了');
    }

    // アプリケーション状態の復元
    async restoreApplicationState() {
        try {
            // 前回の状態を復元
            const lastSection = storage.get('last_active_section') || 'grading';
            window.uiManager.switchSection(lastSection);

            // その他の状態復元
            // (採点システムの状態復元は既にgradingSystem.loadCurrentState()で実行済み)

            console.log('アプリケーション状態復元完了');
        } catch (error) {
            console.warn('状態復元でエラーが発生しましたが、継続します:', error);
        }
    }

    // パフォーマンス監視設定
    setupPerformanceMonitoring() {
        // ページロード時間の記録
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            console.log(`ページロード時間: ${loadTime.toFixed(2)}ms`);
        });

        // メモリ使用量の定期監視（開発環境のみ）
        if (window.location.hostname === 'localhost') {
            setInterval(() => {
                if (performance.memory) {
                    const memory = performance.memory;
                    console.log('メモリ使用量:', {
                        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                    });
                }
            }, 60000); // 1分間隔
        }
    }

    // ウェルカムメッセージ
    showWelcomeMessage() {
        const isFirstTime = !storage.get('has_visited_before');

        if (isFirstTime) {
            setTimeout(() => {
                showToast('IPA PM AI採点システムへようこそ！', 'info', 7000);
                storage.set('has_visited_before', true);
            }, 1000);
        }
    }

    // 初期化エラー表示
    showInitializationError(error) {
        const errorContainer = document.createElement('div');
        errorContainer.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    background: #dc2626;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 500px;
                    text-align: center;
                ">
                    <h2 style="margin: 0 0 1rem 0;">
                        <i class="fas fa-exclamation-triangle"></i>
                        初期化エラー
                    </h2>
                    <p style="margin: 0 0 1rem 0;">
                        アプリケーションの初期化中にエラーが発生しました。
                    </p>
                    <details style="margin: 1rem 0; text-align: left;">
                        <summary style="cursor: pointer;">詳細を表示</summary>
                        <pre style="margin: 0.5rem 0; font-size: 0.8em; white-space: pre-wrap;">${error.message}</pre>
                    </details>
                    <button onclick="window.location.reload()" style="
                        background: white;
                        color: #dc2626;
                        border: none;
                        padding: 0.5rem 1rem;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        ページを再読み込み
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(errorContainer);
    }

    // データベースエラー処理
    handleDatabaseError(error) {
        console.error('データベースエラー:', error);
        showToast('データベースエラーが発生しました', 'error');

        // 重大なエラーの場合は再初期化を試行
        if (error.message.includes('version') || error.message.includes('schema')) {
            this.attemptDatabaseRecovery();
        }
    }

    // APIエラー処理
    handleApiError(error) {
        console.error('APIエラー:', error);

        let message = 'API通信エラーが発生しました';
        if (error.status === 0) {
            message = 'ネットワーク接続を確認してください';
        } else if (error.status === 429) {
            message = 'リクエスト制限に達しました。しばらく待ってから再試行してください';
        } else if (error.status >= 500) {
            message = 'サーバーエラーが発生しました';
        }

        showToast(message, 'error');
    }

    // データベース復旧試行
    async attemptDatabaseRecovery() {
        try {
            console.log('データベース復旧を試行中...');

            // 既存の接続をクローズ
            dbManager.close();

            // データベースを削除して再作成
            const deleteRequest = indexedDB.deleteDatabase(dbManager.dbName);

            deleteRequest.onsuccess = async () => {
                try {
                    await dbManager.init();
                    showToast('データベースが復旧されました', 'success');
                } catch (error) {
                    console.error('データベース復旧失敗:', error);
                    showToast('データベースの復旧に失敗しました', 'error');
                }
            };

            deleteRequest.onerror = () => {
                console.error('データベース削除失敗');
                showToast('データベースの復旧に失敗しました', 'error');
            };

        } catch (error) {
            console.error('データベース復旧エラー:', error);
        }
    }

    // アプリケーション情報の取得
    getInfo() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            components: Object.keys(this.components),
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform
            },
            performance: {
                loadTime: performance.now(),
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null
            }
        };
    }

    // アプリケーション状態の保存
    saveApplicationState() {
        try {
            storage.set('last_active_section', window.uiManager.currentSection);
            storage.set('last_session', Date.now());
        } catch (error) {
            console.warn('アプリケーション状態の保存に失敗:', error);
        }
    }

    // クリーンアップ
    cleanup() {
        try {
            this.saveApplicationState();

            // データベース接続をクローズ
            if (this.components.database) {
                this.components.database.close();
            }

            // イベントリスナーをクリア
            appEvents.events = {};

            console.log('アプリケーションクリーンアップ完了');
        } catch (error) {
            console.error('クリーンアップエラー:', error);
        }
    }

    // デバッグ情報の出力
    debug() {
        console.group('IPA PM AI採点システム デバッグ情報');
        console.log('アプリケーション情報:', this.getInfo());
        console.log('ストレージ:', storage.get(''));
        console.log('データベース状態:', dbManager.isConnected());
        console.log('API設定:', apiSettings.getAll());
        console.groupEnd();
    }
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.cleanup();
    }
});

// デバッグ用のグローバル関数
window.debugApp = () => {
    if (window.app) {
        window.app.debug();
    }
};

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
});

// CSS追加スタイル（統計モーダル用）
const additionalStyles = `
    <style>
        .settings-content {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        .settings-section {
            border-bottom: 1px solid var(--gray-200);
            padding-bottom: 1.5rem;
        }

        .settings-section:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .settings-section h4 {
            margin-bottom: 1rem;
            color: var(--gray-800);
        }

        .settings-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .statistics-content {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .stat-card {
            background: var(--gray-50);
            padding: 1.5rem;
            border-radius: var(--border-radius);
            text-align: center;
        }

        .stat-card h4 {
            margin: 0 0 0.5rem 0;
            font-size: var(--text-sm);
            color: var(--gray-600);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-value {
            font-size: var(--text-2xl);
            font-weight: 700;
            color: var(--primary-600);
        }

        .stats-section {
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: var(--border-radius);
            padding: 1.5rem;
        }

        .stats-section h4 {
            margin: 0 0 1rem 0;
            color: var(--gray-800);
        }

        .score-distribution {
            display: flex;
            gap: 2rem;
            justify-content: center;
        }

        .score-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }

        .score-count {
            font-weight: 600;
            color: var(--gray-700);
        }

        .year-distribution {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }

        .year-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 1rem;
            background: var(--gray-50);
            border-radius: var(--border-radius);
        }

        .year-label {
            font-weight: 500;
        }

        .year-count {
            font-weight: 600;
            color: var(--primary-600);
        }

        .system-info {
            display: grid;
            gap: 0.5rem;
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--gray-100);
        }

        .info-item:last-child {
            border-bottom: none;
        }

        .info-label {
            color: var(--gray-600);
        }

        .info-value {
            font-weight: 600;
            color: var(--gray-800);
        }

        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: 1fr 1fr;
            }

            .score-distribution {
                flex-direction: column;
                gap: 1rem;
            }

            .settings-actions {
                grid-template-columns: 1fr;
            }
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);