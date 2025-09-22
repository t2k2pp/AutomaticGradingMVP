// UIコンポーネントとインタラクション

class UIManager {
    constructor() {
        this.currentSection = 'grading';
        this.toasts = new Map();
        this.toastCounter = 0;

        this.init();
    }

    init() {
        this.bindNavigationEvents();
        this.bindGlobalEvents();
        this.setupErrorHandling();
        this.initializeToastContainer();
    }

    // ナビゲーションイベントの設定
    bindNavigationEvents() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.id.replace('nav-', '');
                this.switchSection(section);
            });
        });

        // 初期表示の設定
        this.switchSection('grading');
    }

    // グローバルイベントの設定
    bindGlobalEvents() {
        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '未保存の変更があります。ページを離れますか？';
                return '未保存の変更があります。ページを離れますか？';
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // Ctrl+S: 評価保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.currentSection === 'grading') {
                    gradingSystem.saveEvaluation();
                }
            }

            // Ctrl+Enter: AI採点実行
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                if (this.currentSection === 'grading') {
                    gradingSystem.executeGrading();
                }
            }

            // Esc: モーダルクローズ
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // 設定ボタン
        const settingsButton = document.getElementById('settings-btn');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => this.showSettingsModal());
        }

        // リサイズイベント
        window.addEventListener('resize', debounce(() => {
            this.handleResize();
        }, 250));
    }

    // セクションの切り替え
    switchSection(sectionName) {
        // ナビゲーションの更新
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.getElementById(`nav-${sectionName}`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // セクションの表示/非表示
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        const activeSection = document.getElementById(`${sectionName}-section`);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        this.currentSection = sectionName;

        // セクション固有の初期化処理
        this.initializeSection(sectionName);
    }

    // セクション固有の初期化
    initializeSection(sectionName) {
        switch (sectionName) {
            case 'grading':
                // 採点画面の初期化は既に完了済み
                break;
            case 'problems':
                problemManager.loadProblems();
                break;
            case 'history':
                historyManager.loadHistories();
                break;
        }
    }

    // 未保存の変更があるかチェック
    hasUnsavedChanges() {
        if (this.currentSection === 'grading') {
            const answer = document.getElementById('student-answer')?.value || '';
            const finalScore = document.querySelector('input[name="final-score"]:checked');
            const finalComment = document.getElementById('final-comment')?.value || '';

            // 解答が入力されているが評価が保存されていない場合
            return answer.trim() && (finalScore || finalComment.trim());
        }
        return false;
    }

    // エラーハンドリングの設定
    setupErrorHandling() {
        // 未処理のエラーをキャッチ
        window.addEventListener('error', (e) => {
            console.error('Unhandled error:', e.error);
            this.showErrorToast('予期しないエラーが発生しました');
        });

        // Promise のエラーをキャッチ
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showErrorToast('非同期処理でエラーが発生しました');
        });
    }

    // トーストコンテナの初期化
    initializeToastContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    // リサイズハンドリング
    handleResize() {
        // モバイル表示時の調整
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // モバイル時の調整
            document.body.classList.add('mobile-view');
        } else {
            document.body.classList.remove('mobile-view');
        }
    }

    // モーダル関連
    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    // 設定モーダルの表示
    showSettingsModal() {
        const modalHtml = `
            <div class="modal active" id="settings-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>システム設定</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this.renderSettingsContent()}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="this.closest('.modal').remove(); document.body.style.overflow = ''">キャンセル</button>
                        <button class="btn btn-primary" onclick="window.uiManager.saveSettings()">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';

        const modal = document.getElementById('settings-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                modal.remove();
                document.body.style.overflow = '';
            }
        });
    }

    // 設定内容のレンダリング
    renderSettingsContent() {
        const apiSettings = window.apiSettings.getAll();
        const raterIdValue = storage.get('rater_id') || 'anonymous';

        return `
            <div class="settings-content">
                <section class="settings-section">
                    <h4>ユーザー設定</h4>
                    <div class="form-group">
                        <label for="settings-rater-id">採点者ID:</label>
                        <input type="text" id="settings-rater-id" class="input" value="${escapeHtml(raterIdValue)}" placeholder="採点者IDを入力">
                    </div>
                </section>

                <section class="settings-section">
                    <h4>API設定</h4>
                    <div class="form-group">
                        <label for="settings-api-url">API URL:</label>
                        <input type="url" id="settings-api-url" class="input" value="${escapeHtml(apiSettings.baseURL)}" placeholder="http://localhost:8000/api">
                    </div>
                    <div class="form-group">
                        <label for="settings-timeout">タイムアウト (ms):</label>
                        <input type="number" id="settings-timeout" class="input" value="${apiSettings.timeout}" min="5000" max="300000">
                    </div>
                    <div class="form-group">
                        <label for="settings-retry-attempts">リトライ回数:</label>
                        <input type="number" id="settings-retry-attempts" class="input" value="${apiSettings.retryAttempts}" min="0" max="10">
                    </div>
                </section>

                <section class="settings-section">
                    <h4>システム操作</h4>
                    <div class="settings-actions">
                        <button class="btn btn-outline" onclick="window.exportManager.exportSettings()">
                            <i class="fas fa-download"></i>
                            設定をエクスポート
                        </button>
                        <button class="btn btn-outline" onclick="window.exportManager.createFullBackup()">
                            <i class="fas fa-archive"></i>
                            フルバックアップ作成
                        </button>
                        <button class="btn btn-outline" onclick="window.uiManager.showStatistics()">
                            <i class="fas fa-chart-bar"></i>
                            統計情報表示
                        </button>
                        <button class="btn btn-outline warning" onclick="window.uiManager.clearAllData()">
                            <i class="fas fa-trash"></i>
                            全データクリア
                        </button>
                    </div>
                </section>
            </div>
        `;
    }

    // 設定の保存
    saveSettings() {
        try {
            // ユーザー設定
            const raterId = document.getElementById('settings-rater-id')?.value || 'anonymous';
            storage.set('rater_id', raterId);

            // API設定
            const apiUrl = document.getElementById('settings-api-url')?.value;
            const timeout = parseInt(document.getElementById('settings-timeout')?.value);
            const retryAttempts = parseInt(document.getElementById('settings-retry-attempts')?.value);

            const apiSettings = {};
            if (apiUrl) apiSettings.baseURL = apiUrl;
            if (timeout) apiSettings.timeout = timeout;
            if (retryAttempts >= 0) apiSettings.retryAttempts = retryAttempts;

            window.apiSettings.update(apiSettings);

            // モーダルを閉じる
            document.getElementById('settings-modal')?.remove();
            document.body.style.overflow = '';

            showToast('設定を保存しました', 'success');

        } catch (error) {
            handleError(error, 'saveSettings');
        }
    }

    // 統計情報の表示
    async showStatistics() {
        try {
            const [problemStats, historyStats] = await Promise.all([
                problemManager.getStatistics(),
                historyManager.getStatistics()
            ]);

            const modalHtml = `
                <div class="modal active" id="statistics-modal">
                    <div class="modal-content" style="max-width: 800px;">
                        <div class="modal-header">
                            <h3>システム統計情報</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            ${this.renderStatistics(problemStats, historyStats)}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline" onclick="window.exportManager.exportStatisticsReport()">
                                <i class="fas fa-download"></i>
                                統計レポートをエクスポート
                            </button>
                            <button class="btn btn-ghost" onclick="this.closest('.modal').remove(); document.body.style.overflow = ''">閉じる</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.style.overflow = 'hidden';

            const modal = document.getElementById('statistics-modal');
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-close')) {
                    modal.remove();
                    document.body.style.overflow = '';
                }
            });

        } catch (error) {
            handleError(error, 'showStatistics');
        }
    }

    // 統計情報のレンダリング
    renderStatistics(problemStats, historyStats) {
        return `
            <div class="statistics-content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4>問題数</h4>
                        <div class="stat-value">${problemStats.totalProblems}</div>
                    </div>
                    <div class="stat-card">
                        <h4>採点履歴数</h4>
                        <div class="stat-value">${historyStats.totalHistories}</div>
                    </div>
                    <div class="stat-card">
                        <h4>AI一致率</h4>
                        <div class="stat-value">${historyStats.aiAccuracy.percentage}%</div>
                    </div>
                    <div class="stat-card">
                        <h4>平均処理時間</h4>
                        <div class="stat-value">${historyStats.averageLatency}ms</div>
                    </div>
                </div>

                <section class="stats-section">
                    <h4>スコア分布</h4>
                    <div class="score-distribution">
                        <div class="score-item">
                            <span class="score-badge score-excellent">〇</span>
                            <span class="score-count">${historyStats.scoreDistribution.excellent}件</span>
                        </div>
                        <div class="score-item">
                            <span class="score-badge score-good">△</span>
                            <span class="score-count">${historyStats.scoreDistribution.good}件</span>
                        </div>
                        <div class="score-item">
                            <span class="score-badge score-poor">✕</span>
                            <span class="score-count">${historyStats.scoreDistribution.poor}件</span>
                        </div>
                    </div>
                </section>

                <section class="stats-section">
                    <h4>年度別問題数</h4>
                    <div class="year-distribution">
                        ${Object.entries(problemStats.yearDistribution).map(([year, count]) => `
                            <div class="year-item">
                                <span class="year-label">${escapeHtml(year)}</span>
                                <span class="year-count">${count}件</span>
                            </div>
                        `).join('')}
                    </div>
                </section>

                <section class="stats-section">
                    <h4>システム情報</h4>
                    <div class="system-info">
                        <div class="info-item">
                            <span class="info-label">ルール適用件数:</span>
                            <span class="info-value">${historyStats.ruleOverrides}件</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">最近7日間のアクティビティ:</span>
                            <span class="info-value">${historyStats.recentActivity}件</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">平均文字数制限:</span>
                            <span class="info-value">${problemStats.averageCharLimit}文字</span>
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    // 全データクリア
    async clearAllData() {
        if (!confirm('全ての問題と採点履歴を削除しますか？\nこの操作は取り消せません。')) {
            return;
        }

        if (!confirm('本当に全てのデータを削除しますか？\n削除前にバックアップを作成することをお勧めします。')) {
            return;
        }

        try {
            await dbManager.clearDatabase();

            // 設定モーダルを閉じる
            document.getElementById('settings-modal')?.remove();
            document.body.style.overflow = '';

            showToast('全てのデータを削除しました', 'success');

            // 画面をリフレッシュ
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            handleError(error, 'clearAllData');
        }
    }

    // エラートーストの表示
    showErrorToast(message) {
        showToast(message, 'error');
    }
}

// トーストメッセージ表示関数
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const titles = {
        success: '成功',
        error: 'エラー',
        warning: '警告',
        info: '情報'
    };

    const toastHtml = `
        <div class="toast ${type}" id="${toastId}">
            <div class="toast-header">
                <div class="toast-title">
                    <i class="${icons[type]}"></i>
                    ${titles[type]}
                </div>
                <button class="toast-close" onclick="removeToast('${toastId}')">&times;</button>
            </div>
            <div class="toast-message">${escapeHtml(message)}</div>
            <div class="toast-progress ${type}"></div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);

    // 自動削除
    setTimeout(() => {
        removeToast(toastId);
    }, duration);
}

// トーストメッセージ削除関数
function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

// グローバルUI管理インスタンス
window.uiManager = new UIManager();