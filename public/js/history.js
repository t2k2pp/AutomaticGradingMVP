// 採点履歴管理システム

class HistoryManager {
    constructor() {
        this.histories = [];
        this.filteredHistories = [];
        this.currentFilters = {};
        this.currentSort = { key: 'timestamp', direction: 'desc' };

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHistories();
    }

    bindEvents() {
        // フィルターイベント
        const filterYear = document.getElementById('filter-year');
        if (filterYear) {
            filterYear.addEventListener('change', () => this.applyFilters());
        }

        const filterScore = document.getElementById('filter-score');
        if (filterScore) {
            filterScore.addEventListener('change', () => this.applyFilters());
        }

        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) {
            const debouncedSearch = debounce(() => this.applyFilters(), 300);
            filterSearch.addEventListener('input', debouncedSearch);
        }

        // アプリケーションイベント
        appEvents.on('historyAdded', () => {
            this.loadHistories();
        });

        appEvents.on('historyUpdated', () => {
            this.loadHistories();
        });

        appEvents.on('historyDeleted', () => {
            this.loadHistories();
        });

        appEvents.on('problemDeleted', () => {
            this.loadHistories();
        });
    }

    // 履歴一覧の読み込み
    async loadHistories() {
        try {
            this.histories = await dbManager.getAllHistories();
            this.updateFilterOptions();
            this.applyFilters();
        } catch (error) {
            handleError(error, 'loadHistories');
        }
    }

    // フィルターオプションの更新
    updateFilterOptions() {
        this.updateYearFilter();
    }

    // 年度フィルターの更新
    async updateYearFilter() {
        const filterYear = document.getElementById('filter-year');
        if (!filterYear) return;

        try {
            const problems = await dbManager.getAllProblems();
            const years = [...new Set(problems.map(p => p.year))].sort();

            const currentValue = filterYear.value;
            filterYear.innerHTML = '<option value="">全年度</option>';

            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                filterYear.appendChild(option);
            });

            // 現在の選択を復元
            if (currentValue && years.includes(currentValue)) {
                filterYear.value = currentValue;
            }

        } catch (error) {
            console.error('年度フィルター更新エラー:', error);
        }
    }

    // フィルターの適用
    applyFilters() {
        this.collectFilters();
        this.filterHistories();
        this.sortHistories();
        this.renderHistories();
    }

    // フィルター条件の収集
    collectFilters() {
        const filterYear = document.getElementById('filter-year');
        const filterScore = document.getElementById('filter-score');
        const filterSearch = document.getElementById('filter-search');

        this.currentFilters = {};

        if (filterYear?.value) {
            this.currentFilters.year = filterYear.value;
        }

        if (filterScore?.value) {
            this.currentFilters.score = filterScore.value;
        }

        if (filterSearch?.value.trim()) {
            this.currentFilters.search = filterSearch.value.trim();
        }
    }

    // 履歴のフィルタリング
    async filterHistories() {
        try {
            this.filteredHistories = [];

            for (const history of this.histories) {
                let include = true;

                // 年度フィルター
                if (this.currentFilters.year) {
                    const problem = await dbManager.getProblem(history.problem_id);
                    if (!problem || problem.year !== this.currentFilters.year) {
                        include = false;
                    }
                }

                // スコアフィルター
                if (include && this.currentFilters.score) {
                    if (history.final_score !== this.currentFilters.score) {
                        include = false;
                    }
                }

                // 検索フィルター
                if (include && this.currentFilters.search) {
                    const searchLower = this.currentFilters.search.toLowerCase();
                    const searchTargets = [
                        history.student_answer,
                        history.ai_reason,
                        history.final_comment
                    ].filter(text => text);

                    const found = searchTargets.some(text =>
                        text.toLowerCase().includes(searchLower)
                    );

                    if (!found) {
                        include = false;
                    }
                }

                if (include) {
                    this.filteredHistories.push(history);
                }
            }

        } catch (error) {
            console.error('履歴フィルタリングエラー:', error);
            this.filteredHistories = [...this.histories];
        }
    }

    // 履歴のソート
    sortHistories() {
        this.filteredHistories = sortArray(
            this.filteredHistories,
            this.currentSort.key,
            this.currentSort.direction
        );
    }

    // 履歴一覧の表示
    renderHistories() {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (this.filteredHistories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>採点履歴がありません</h3>
                    <p>採点を実行すると履歴が表示されます</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredHistories
            .map(history => this.renderHistoryCard(history))
            .join('');
    }

    // 履歴カードの表示
    renderHistoryCard(history) {
        const timestamp = formatDate(history.timestamp);
        const hasScoreChange = history.ai_score !== history.final_score;

        return `
            <div class="history-item" data-id="${history.id}">
                <div class="history-header">
                    <h3 class="history-title">履歴 #${history.id}</h3>
                    <span class="history-timestamp">${timestamp}</span>
                </div>

                <div class="history-scores">
                    <div class="score-comparison">
                        <span class="label">AI評価:</span>
                        <span class="score-badge ${this.getScoreClass(history.ai_score)}">${history.ai_score}</span>
                        ${hasScoreChange ? `
                            <i class="fas fa-arrow-right score-arrow"></i>
                            <span class="label">最終評価:</span>
                            <span class="score-badge ${this.getScoreClass(history.final_score)}">${history.final_score}</span>
                        ` : ''}
                    </div>

                    ${history.rule_override ? `
                        <span class="rule-indicator">
                            <i class="fas fa-exclamation-triangle"></i>
                            ルール適用
                        </span>
                    ` : ''}
                </div>

                <div class="history-content">
                    <div class="answer-section">
                        <h4>受験者解答</h4>
                        <p>${this.formatText(escapeHtml(history.student_answer), 200)}</p>
                    </div>

                    <div class="reason-section">
                        <h4>AI評価理由</h4>
                        <p>${this.formatText(escapeHtml(history.ai_reason), 150)}</p>
                    </div>

                    ${history.final_comment ? `
                        <div class="comment-section">
                            <h4>最終コメント</h4>
                            <p>${this.formatText(escapeHtml(history.final_comment), 150)}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="history-meta">
                    <span><i class="fas fa-clock"></i> 処理時間: ${history.latency_ms || 0}ms</span>
                    ${history.token_usage?.total ? `<span><i class="fas fa-coins"></i> トークン: ${history.token_usage.total}</span>` : ''}
                    <span><i class="fas fa-user"></i> 採点者: ${escapeHtml(history.rater_id)}</span>
                    <span><i class="fas fa-check-circle"></i> JSON有効: ${history.json_valid ? '✓' : '✗'}</span>
                </div>

                <div class="history-actions">
                    <button class="btn btn-ghost btn-sm" onclick="window.historyManager.viewDetail(${history.id})" title="詳細表示">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="window.historyManager.exportHistory(${history.id})" title="エクスポート">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="window.historyManager.deleteHistory(${history.id})" title="削除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // テキストのフォーマット
    formatText(text, maxLength) {
        if (text.length <= maxLength) {
            return text.replace(/\n/g, '<br>');
        }
        return text.substring(0, maxLength).replace(/\n/g, '<br>') + '...';
    }

    // スコアに応じたCSSクラス
    getScoreClass(score) {
        switch (score) {
            case '〇': return 'score-excellent';
            case '△': return 'score-good';
            case '✕': return 'score-poor';
            default: return 'score-unknown';
        }
    }

    // 履歴詳細の表示
    async viewDetail(historyId) {
        try {
            const history = await dbManager.getHistory(historyId);
            if (!history) {
                showToast('履歴が見つかりません', 'error');
                return;
            }

            const problem = await dbManager.getProblem(history.problem_id);

            this.showDetailModal(history, problem);

        } catch (error) {
            handleError(error, 'viewDetail');
        }
    }

    // 詳細モーダルの表示
    showDetailModal(history, problem) {
        const modalHtml = `
            <div class="modal active" id="history-detail-modal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3>採点履歴詳細 #${history.id}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this.renderHistoryDetail(history, problem)}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="this.closest('.modal').remove()">閉じる</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';

        const modal = document.getElementById('history-detail-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                modal.remove();
                document.body.style.overflow = '';
            }
        });
    }

    // 履歴詳細の内容
    renderHistoryDetail(history, problem) {
        return `
            <div class="history-detail">
                ${problem ? `
                    <section class="detail-section">
                        <h4>問題情報</h4>
                        <div class="problem-meta">
                            <div class="problem-meta-item">
                                <span class="label">年度</span>
                                <span class="value">${escapeHtml(problem.year)}</span>
                            </div>
                            <div class="problem-meta-item">
                                <span class="label">問題群</span>
                                <span class="value">${escapeHtml(problem.question_group)}</span>
                            </div>
                            <div class="problem-meta-item">
                                <span class="label">設問</span>
                                <span class="value">${escapeHtml(problem.question_number)}</span>
                            </div>
                        </div>
                    </section>
                ` : ''}

                <section class="detail-section">
                    <h4>受験者解答</h4>
                    <div class="answer-display">
                        ${escapeHtml(history.student_answer).replace(/\n/g, '<br>')}
                    </div>
                </section>

                <section class="detail-section">
                    <h4>評価結果</h4>
                    <div class="score-comparison-detail">
                        <div class="score-item">
                            <span class="label">AI評価</span>
                            <span class="score-badge ${this.getScoreClass(history.ai_score)}">${history.ai_score}</span>
                        </div>
                        <div class="score-item">
                            <span class="label">最終評価</span>
                            <span class="score-badge ${this.getScoreClass(history.final_score)}">${history.final_score}</span>
                        </div>
                    </div>
                </section>

                <section class="detail-section">
                    <h4>AI評価理由</h4>
                    <div class="reason-display">
                        ${escapeHtml(history.ai_reason).replace(/\n/g, '<br>')}
                    </div>
                </section>

                ${history.ai_feedback && (history.ai_feedback.positive_points?.length || history.ai_feedback.negative_points?.length) ? `
                    <section class="detail-section">
                        <h4>フィードバック</h4>
                        <div class="feedback-detail">
                            ${history.ai_feedback.positive_points?.length ? `
                                <div class="feedback-positive">
                                    <h5>良い点</h5>
                                    <ul>
                                        ${history.ai_feedback.positive_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${history.ai_feedback.negative_points?.length ? `
                                <div class="feedback-negative">
                                    <h5>改善点</h5>
                                    <ul>
                                        ${history.ai_feedback.negative_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}

                ${history.final_comment ? `
                    <section class="detail-section">
                        <h4>最終コメント</h4>
                        <div class="comment-display">
                            ${escapeHtml(history.final_comment).replace(/\n/g, '<br>')}
                        </div>
                    </section>
                ` : ''}

                <section class="detail-section">
                    <h4>処理情報</h4>
                    <div class="metadata-grid">
                        <div class="meta-item">
                            <span class="label">処理時間</span>
                            <span class="value">${history.latency_ms || 0}ms</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">採点者ID</span>
                            <span class="value">${escapeHtml(history.rater_id)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">ルール適用</span>
                            <span class="value">${history.rule_override ? 'あり' : 'なし'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">JSON有効性</span>
                            <span class="value">${history.json_valid ? '有効' : '無効'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">作成日時</span>
                            <span class="value">${formatDate(history.timestamp)}</span>
                        </div>
                        ${history.token_usage?.total ? `
                            <div class="meta-item">
                                <span class="label">トークン使用量</span>
                                <span class="value">${history.token_usage.total}</span>
                            </div>
                        ` : ''}
                    </div>
                </section>
            </div>
        `;
    }

    // 履歴の個別エクスポート
    async exportHistory(historyId) {
        try {
            const history = await dbManager.getHistory(historyId);
            if (!history) {
                showToast('履歴が見つかりません', 'error');
                return;
            }

            const problem = await dbManager.getProblem(history.problem_id);

            const exportData = {
                history,
                problem,
                exported_at: new Date().toISOString()
            };

            const content = JSON.stringify(exportData, null, 2);
            const filename = `history_${historyId}_${new Date().toISOString().split('T')[0]}.json`;

            downloadFile(content, filename, 'application/json');
            showToast('履歴をエクスポートしました', 'success');

        } catch (error) {
            handleError(error, 'exportHistory');
        }
    }

    // 履歴の削除
    async deleteHistory(historyId) {
        if (!confirm('この履歴を削除しますか？')) {
            return;
        }

        try {
            await dbManager.deleteHistory(historyId);
            showToast('履歴を削除しました', 'success');
        } catch (error) {
            handleError(error, 'deleteHistory');
        }
    }

    // 統計情報の取得
    async getStatistics() {
        try {
            const histories = await dbManager.getAllHistories();

            const stats = {
                totalHistories: histories.length,
                scoreDistribution: {
                    excellent: histories.filter(h => h.final_score === '〇').length,
                    good: histories.filter(h => h.final_score === '△').length,
                    poor: histories.filter(h => h.final_score === '✕').length
                },
                aiAccuracy: {
                    matches: histories.filter(h => h.ai_score === h.final_score).length,
                    total: histories.length
                },
                ruleOverrides: histories.filter(h => h.rule_override).length,
                averageLatency: histories.length > 0
                    ? Math.round(histories.reduce((sum, h) => sum + (h.latency_ms || 0), 0) / histories.length)
                    : 0,
                recentActivity: this.getRecentActivity(histories)
            };

            stats.aiAccuracy.percentage = stats.aiAccuracy.total > 0
                ? Math.round((stats.aiAccuracy.matches / stats.aiAccuracy.total) * 100)
                : 0;

            return stats;

        } catch (error) {
            throw new Error(`履歴統計の取得エラー: ${error.message}`);
        }
    }

    // 最近のアクティビティ取得
    getRecentActivity(histories) {
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        return histories.filter(history => {
            const historyDate = new Date(history.timestamp);
            return historyDate >= sevenDaysAgo;
        }).length;
    }

    // フィルターのクリア
    clearFilters() {
        document.getElementById('filter-year').value = '';
        document.getElementById('filter-score').value = '';
        document.getElementById('filter-search').value = '';
        this.applyFilters();
    }

    // ソート順の変更
    changeSort(key, direction = null) {
        if (direction) {
            this.currentSort = { key, direction };
        } else {
            // 現在のキーと同じ場合は方向を反転、違う場合はdescに設定
            if (this.currentSort.key === key) {
                this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSort = { key, direction: 'desc' };
            }
        }

        this.sortHistories();
        this.renderHistories();
    }
}

// グローバル履歴管理インスタンス
window.historyManager = new HistoryManager();