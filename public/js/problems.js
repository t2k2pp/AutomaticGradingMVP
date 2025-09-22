// 問題管理システム

class ProblemManager {
    constructor() {
        this.problems = [];
        this.filteredProblems = [];
        this.currentEditingProblem = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadProblems();
    }

    bindEvents() {
        // 問題追加ボタン
        const addButton = document.getElementById('add-problem');
        if (addButton) {
            addButton.addEventListener('click', () => this.showAddProblemModal());
        }

        // モーダル関連
        const modal = document.getElementById('problem-modal');
        if (modal) {
            // モーダルクローズボタン
            const closeButtons = modal.querySelectorAll('.modal-close');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.hideModal());
            });

            // モーダル外クリック
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });

            // ESCキー
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    this.hideModal();
                }
            });
        }

        // フォーム関連
        const saveButton = document.getElementById('save-problem');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveProblem());
        }

        const cancelButton = document.getElementById('cancel-problem');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.hideModal());
        }

        // 文字数制限の自動入力
        const charLimitInput = document.getElementById('problem-char-limit');
        if (charLimitInput) {
            charLimitInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (value && value > 0) {
                    // 妥当性チェック
                    if (value > 1000) {
                        e.target.value = 1000;
                        showToast('文字数制限は1000文字以下で設定してください', 'warning');
                    }
                }
            });
        }

        // アプリケーションイベント
        appEvents.on('problemAdded', () => {
            this.loadProblems();
        });

        appEvents.on('problemUpdated', () => {
            this.loadProblems();
        });

        appEvents.on('problemDeleted', () => {
            this.loadProblems();
        });
    }

    // 問題一覧の読み込み
    async loadProblems() {
        try {
            this.problems = await dbManager.getAllProblems();
            this.filteredProblems = [...this.problems];
            this.renderProblems();
        } catch (error) {
            handleError(error, 'loadProblems');
        }
    }

    // 問題一覧の表示
    renderProblems() {
        const container = document.getElementById('problems-list');
        if (!container) return;

        if (this.filteredProblems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>問題がありません</h3>
                    <p>新しい問題を追加してください</p>
                    <button class="btn btn-primary" onclick="window.problemManager.showAddProblemModal()">
                        <i class="fas fa-plus"></i>
                        問題追加
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredProblems.map(problem => this.renderProblemCard(problem)).join('');
    }

    // 問題カードの表示
    renderProblemCard(problem) {
        const charLimit = problem.constraints?.char_limit || 40;
        const createdDate = formatDate(problem.created_at);

        return `
            <div class="problem-item" data-id="${problem.id}">
                <div class="problem-header">
                    <div>
                        <h3 class="problem-title">${escapeHtml(problem.year)} ${escapeHtml(problem.question_group)}</h3>
                        <p class="problem-subtitle">${escapeHtml(problem.question_number)}</p>
                    </div>
                    <div class="problem-actions">
                        <button class="btn btn-ghost btn-sm" onclick="window.problemManager.editProblem(${problem.id})" title="編集">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="window.problemManager.duplicateProblem(${problem.id})" title="複製">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="window.problemManager.deleteProblem(${problem.id})" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="problem-content">
                    <div class="problem-section">
                        <h4>問題文</h4>
                        <p>${this.truncateText(escapeHtml(problem.context), 200)}</p>
                    </div>

                    <div class="problem-section">
                        <h4>設問</h4>
                        <p>${this.truncateText(escapeHtml(problem.prompt), 150)}</p>
                    </div>

                    <div class="problem-section">
                        <h4>模範解答</h4>
                        <p>${this.truncateText(escapeHtml(problem.model_answer), 150)}</p>
                    </div>
                </div>

                <div class="problem-stats">
                    <span><i class="fas fa-ruler-horizontal"></i> 文字数制限: ${charLimit}文字</span>
                    <span><i class="fas fa-calendar"></i> 作成日: ${createdDate}</span>
                    <span><i class="fas fa-code-branch"></i> バージョン: ${escapeHtml(problem.prompt_version || 'v1.0.0')}</span>
                </div>
            </div>
        `;
    }

    // テキストの省略
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    // 問題追加モーダルの表示
    showAddProblemModal() {
        this.currentEditingProblem = null;
        this.clearForm();
        this.showModal('問題追加');
    }

    // 問題編集
    async editProblem(problemId) {
        try {
            const problem = await dbManager.getProblem(problemId);
            if (!problem) {
                showToast('問題が見つかりません', 'error');
                return;
            }

            this.currentEditingProblem = problem;
            this.fillForm(problem);
            this.showModal('問題編集');

        } catch (error) {
            handleError(error, 'editProblem');
        }
    }

    // 問題複製
    async duplicateProblem(problemId) {
        try {
            const problem = await dbManager.getProblem(problemId);
            if (!problem) {
                showToast('問題が見つかりません', 'error');
                return;
            }

            // 複製用のデータを作成（IDと日付を除く）
            const duplicateData = { ...problem };
            delete duplicateData.id;
            delete duplicateData.created_at;
            delete duplicateData.updated_at;

            // タイトルに「(コピー)」を追加
            duplicateData.question_number = duplicateData.question_number + ' (コピー)';

            this.currentEditingProblem = null;
            this.fillForm(duplicateData);
            this.showModal('問題複製');

        } catch (error) {
            handleError(error, 'duplicateProblem');
        }
    }

    // 問題削除
    async deleteProblem(problemId) {
        if (!confirm('この問題を削除しますか？\n関連する採点履歴も削除されます。')) {
            return;
        }

        try {
            // 関連する履歴も削除
            const histories = await dbManager.getHistoriesByProblem(problemId);
            for (const history of histories) {
                await dbManager.deleteHistory(history.id);
            }

            await dbManager.deleteProblem(problemId);
            showToast('問題を削除しました', 'success');

        } catch (error) {
            handleError(error, 'deleteProblem');
        }
    }

    // モーダルの表示
    showModal(title) {
        const modal = document.getElementById('problem-modal');
        const titleElement = modal.querySelector('.modal-header h3');

        if (titleElement) {
            titleElement.textContent = title;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // 最初の入力フィールドにフォーカス
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    // モーダルの非表示
    hideModal() {
        const modal = document.getElementById('problem-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        this.clearForm();
        this.currentEditingProblem = null;
    }

    // フォームのクリア
    clearForm() {
        const form = document.getElementById('problem-form');
        if (form) {
            form.reset();
        }
    }

    // フォームへのデータ入力
    fillForm(problem) {
        const fields = [
            'year', 'question_group', 'question_number',
            'context', 'prompt', 'model_answer', 'intent'
        ];

        fields.forEach(field => {
            const element = document.getElementById(`problem-${field}`);
            if (element && problem[field]) {
                element.value = problem[field];
            }
        });

        // 文字数制限
        const charLimitElement = document.getElementById('problem-char-limit');
        if (charLimitElement) {
            charLimitElement.value = problem.constraints?.char_limit || 40;
        }
    }

    // 問題の保存
    async saveProblem() {
        try {
            const formData = this.collectFormData();
            this.validateFormData(formData);

            if (this.currentEditingProblem) {
                // 更新
                await dbManager.updateProblem(this.currentEditingProblem.id, formData);
                showToast('問題を更新しました', 'success');
            } else {
                // 新規追加
                await dbManager.addProblem(formData);
                showToast('問題を追加しました', 'success');
            }

            this.hideModal();

        } catch (error) {
            if (error.name === 'ValidationError') {
                showToast(error.message, 'warning');
            } else {
                handleError(error, 'saveProblem');
            }
        }
    }

    // フォームデータの収集
    collectFormData() {
        const data = {};

        const fields = [
            'year', 'question_group', 'question_number',
            'context', 'prompt', 'model_answer', 'intent'
        ];

        fields.forEach(field => {
            const element = document.getElementById(`problem-${field}`);
            if (element) {
                data[field] = element.value.trim();
            }
        });

        // 文字数制限
        const charLimitElement = document.getElementById('problem-char-limit');
        if (charLimitElement) {
            const charLimit = parseInt(charLimitElement.value) || 40;
            data.constraints = { char_limit: charLimit };
        }

        // バージョン情報
        data.prompt_version = 'v1.0.0';
        data.model_version = 'gpt-4o-mini';

        return data;
    }

    // フォームデータの検証
    validateFormData(data) {
        const error = (message) => {
            const err = new Error(message);
            err.name = 'ValidationError';
            throw err;
        };

        if (!data.year) error('年度を入力してください');
        if (!data.question_group) error('問題群を入力してください');
        if (!data.question_number) error('設問を入力してください');
        if (!data.context) error('問題文を入力してください');
        if (!data.prompt) error('設問を入力してください');
        if (!data.model_answer) error('模範解答を入力してください');
        if (!data.intent) error('出題趣旨を入力してください');

        if (data.constraints?.char_limit <= 0) {
            error('文字数制限は1以上の数値を入力してください');
        }

        if (data.context.length > 10000) {
            error('問題文は10000文字以内で入力してください');
        }

        if (data.prompt.length > 1000) {
            error('設問は1000文字以内で入力してください');
        }

        if (data.model_answer.length > 2000) {
            error('模範解答は2000文字以内で入力してください');
        }

        if (data.intent.length > 1000) {
            error('出題趣旨は1000文字以内で入力してください');
        }
    }

    // フィルタリング機能
    filterProblems(filters) {
        this.filteredProblems = filterArray(this.problems, filters);
        this.renderProblems();
    }

    // 検索機能
    searchProblems(query) {
        if (!query.trim()) {
            this.filteredProblems = [...this.problems];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredProblems = this.problems.filter(problem => {
                return (
                    problem.year.toLowerCase().includes(lowerQuery) ||
                    problem.question_group.toLowerCase().includes(lowerQuery) ||
                    problem.question_number.toLowerCase().includes(lowerQuery) ||
                    problem.context.toLowerCase().includes(lowerQuery) ||
                    problem.prompt.toLowerCase().includes(lowerQuery) ||
                    problem.model_answer.toLowerCase().includes(lowerQuery) ||
                    problem.intent.toLowerCase().includes(lowerQuery)
                );
            });
        }
        this.renderProblems();
    }

    // 問題のインポート
    async importProblems(problemsData) {
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const problemData of problemsData) {
                try {
                    await dbManager.addProblem(problemData);
                    successCount++;
                } catch (error) {
                    console.error('問題インポートエラー:', error);
                    errorCount++;
                }
            }

            showToast(
                `インポートが完了しました（成功: ${successCount}件、エラー: ${errorCount}件）`,
                errorCount === 0 ? 'success' : 'warning'
            );

        } catch (error) {
            handleError(error, 'importProblems');
        }
    }

    // 問題のエクスポート
    async exportProblems(format = 'json') {
        try {
            const problems = await dbManager.getAllProblems();

            if (problems.length === 0) {
                showToast('エクスポートする問題がありません', 'warning');
                return;
            }

            let content;
            let filename;
            let mimeType;

            if (format === 'csv') {
                content = this.convertToCSV(problems);
                filename = `problems_${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
            } else {
                content = JSON.stringify(problems, null, 2);
                filename = `problems_${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
            }

            downloadFile(content, filename, mimeType);
            showToast('問題をエクスポートしました', 'success');

        } catch (error) {
            handleError(error, 'exportProblems');
        }
    }

    // CSV変換
    convertToCSV(problems) {
        const headers = [
            '年度', '問題群', '設問', '問題文', '設問内容',
            '模範解答', '出題趣旨', '文字数制限', '作成日'
        ];

        const rows = problems.map(problem => [
            problem.year,
            problem.question_group,
            problem.question_number,
            problem.context,
            problem.prompt,
            problem.model_answer,
            problem.intent,
            problem.constraints?.char_limit || 40,
            formatDate(problem.created_at)
        ].map(escapeCsv));

        return [headers.map(escapeCsv), ...rows]
            .map(row => row.join(','))
            .join('\n');
    }

    // 統計情報の取得
    async getStatistics() {
        try {
            const problems = await dbManager.getAllProblems();

            const stats = {
                totalProblems: problems.length,
                yearDistribution: {},
                questionGroupDistribution: {},
                averageCharLimit: 0
            };

            problems.forEach(problem => {
                // 年度別分布
                const year = problem.year;
                stats.yearDistribution[year] = (stats.yearDistribution[year] || 0) + 1;

                // 問題群別分布
                const group = problem.question_group;
                stats.questionGroupDistribution[group] = (stats.questionGroupDistribution[group] || 0) + 1;

                // 文字数制限の平均
                stats.averageCharLimit += problem.constraints?.char_limit || 40;
            });

            if (problems.length > 0) {
                stats.averageCharLimit = Math.round(stats.averageCharLimit / problems.length);
            }

            return stats;

        } catch (error) {
            throw new Error(`統計情報の取得エラー: ${error.message}`);
        }
    }
}

// グローバル問題管理インスタンス
window.problemManager = new ProblemManager();