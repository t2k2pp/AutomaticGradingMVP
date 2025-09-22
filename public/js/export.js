// データエクスポートシステム

class ExportManager {
    constructor() {
        this.supportedFormats = ['csv', 'jsonl', 'json'];
        this.isExporting = false;

        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // エクスポートボタン
        const exportButton = document.getElementById('export-btn');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.showExportModal());
        }

        // エクスポートモーダル関連
        const modal = document.getElementById('export-modal');
        if (modal) {
            // モーダルクローズボタン
            const closeButtons = modal.querySelectorAll('.modal-close');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.hideExportModal());
            });

            // モーダル外クリック
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideExportModal();
                }
            });

            // ESCキー
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    this.hideExportModal();
                }
            });
        }

        // エクスポート実行ボタン
        const executeButton = document.getElementById('execute-export');
        if (executeButton) {
            executeButton.addEventListener('click', () => this.executeExport());
        }

        // エクスポートキャンセルボタン
        const cancelButton = document.getElementById('cancel-export');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.hideExportModal());
        }
    }

    // エクスポートモーダルの表示
    showExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // エクスポートモーダルの非表示
    hideExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // エクスポートの実行
    async executeExport() {
        if (this.isExporting) {
            showToast('エクスポート実行中です', 'warning');
            return;
        }

        try {
            this.isExporting = true;

            // エクスポート設定の取得
            const settings = this.getExportSettings();

            // データの取得とエクスポート
            await this.performExport(settings);

            this.hideExportModal();
            showToast('エクスポートが完了しました', 'success');

        } catch (error) {
            handleError(error, 'executeExport');
        } finally {
            this.isExporting = false;
        }
    }

    // エクスポート設定の取得
    getExportSettings() {
        const formatRadio = document.querySelector('input[name="export-format"]:checked');
        const anonymizeCheckbox = document.getElementById('anonymize-data');

        return {
            format: formatRadio ? formatRadio.value : 'csv',
            anonymize: anonymizeCheckbox ? anonymizeCheckbox.checked : false
        };
    }

    // エクスポートの実行
    async performExport(settings) {
        try {
            // データの取得
            const [problems, histories] = await Promise.all([
                dbManager.getAllProblems(),
                dbManager.getAllHistories()
            ]);

            if (histories.length === 0) {
                showToast('エクスポートするデータがありません', 'warning');
                return;
            }

            // 履歴に問題情報を結合
            const enrichedHistories = await this.enrichHistoriesWithProblems(histories, problems);

            // 匿名化処理
            let exportData = enrichedHistories;
            if (settings.anonymize) {
                exportData = this.anonymizeData(enrichedHistories);
            }

            // フォーマット別エクスポート
            switch (settings.format) {
                case 'csv':
                    this.exportAsCSV(exportData, settings.anonymize);
                    break;
                case 'jsonl':
                    this.exportAsJSONL(exportData, settings.anonymize);
                    break;
                case 'json':
                    this.exportAsJSON(exportData, settings.anonymize);
                    break;
                default:
                    throw new Error('サポートされていないフォーマットです');
            }

        } catch (error) {
            throw new Error(`エクスポート処理エラー: ${error.message}`);
        }
    }

    // 履歴に問題情報を結合
    async enrichHistoriesWithProblems(histories, problems) {
        const problemMap = new Map(problems.map(p => [p.id, p]));

        return histories.map(history => {
            const problem = problemMap.get(history.problem_id);
            return {
                ...history,
                problem: problem ? {
                    year: problem.year,
                    question_group: problem.question_group,
                    question_number: problem.question_number,
                    context: problem.context,
                    prompt: problem.prompt,
                    model_answer: problem.model_answer,
                    intent: problem.intent,
                    constraints: problem.constraints
                } : null
            };
        });
    }

    // データの匿名化
    anonymizeData(data) {
        return data.map(item => {
            const anonymized = { ...item };

            // 個人識別可能な情報を匿名化
            if (anonymized.rater_id) {
                anonymized.rater_id = `anonymous_${hashString(anonymized.rater_id)}`;
            }

            // 学生の解答から個人情報を除去（簡易版）
            if (anonymized.student_answer) {
                anonymized.student_answer = this.sanitizeText(anonymized.student_answer);
            }

            if (anonymized.final_comment) {
                anonymized.final_comment = this.sanitizeText(anonymized.final_comment);
            }

            return anonymized;
        });
    }

    // テキストの清浄化（個人情報の除去）
    sanitizeText(text) {
        // 電話番号パターン
        text = text.replace(/\d{2,4}-\d{2,4}-\d{4}/g, '[電話番号]');
        text = text.replace(/\d{10,11}/g, '[電話番号]');

        // メールアドレスパターン
        text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[メールアドレス]');

        // 名前らしき文字列（姓+名のパターン）
        text = text.replace(/[田中佐藤高橋山田渡辺伊藤中村小林加藤吉田山本][一-龯]{1,3}/g, '[氏名]');

        return text;
    }

    // CSV形式でエクスポート
    exportAsCSV(data, isAnonymized) {
        try {
            const headers = [
                'ID',
                '年度',
                '問題群',
                '設問',
                '受験者解答',
                'AI評価',
                'AI理由',
                '最終評価',
                '最終コメント',
                'ルール適用',
                '処理時間(ms)',
                'トークン使用量',
                '採点者ID',
                '作成日時'
            ];

            const rows = data.map(item => [
                item.id,
                item.problem?.year || '',
                item.problem?.question_group || '',
                item.problem?.question_number || '',
                item.student_answer,
                item.ai_score,
                item.ai_reason,
                item.final_score,
                item.final_comment || '',
                item.rule_override ? 'あり' : 'なし',
                item.latency_ms || 0,
                item.token_usage?.total || 0,
                item.rater_id,
                formatDate(item.timestamp)
            ].map(escapeCsv));

            const csvContent = [headers.map(escapeCsv), ...rows]
                .map(row => row.join(','))
                .join('\n');

            const filename = this.generateFilename('csv', isAnonymized);
            downloadFile(csvContent, filename, 'text/csv;charset=utf-8');

        } catch (error) {
            throw new Error(`CSV出力エラー: ${error.message}`);
        }
    }

    // JSONL形式でエクスポート
    exportAsJSONL(data, isAnonymized) {
        try {
            const jsonlContent = data
                .map(item => JSON.stringify(item))
                .join('\n');

            const filename = this.generateFilename('jsonl', isAnonymized);
            downloadFile(jsonlContent, filename, 'application/jsonl');

        } catch (error) {
            throw new Error(`JSONL出力エラー: ${error.message}`);
        }
    }

    // JSON形式でエクスポート
    exportAsJSON(data, isAnonymized) {
        try {
            const exportObject = {
                metadata: {
                    version: '1.0.0',
                    exported_at: new Date().toISOString(),
                    total_records: data.length,
                    anonymized: isAnonymized,
                    source: 'IPA PM AI Grading System'
                },
                data: data
            };

            const jsonContent = JSON.stringify(exportObject, null, 2);
            const filename = this.generateFilename('json', isAnonymized);
            downloadFile(jsonContent, filename, 'application/json');

        } catch (error) {
            throw new Error(`JSON出力エラー: ${error.message}`);
        }
    }

    // ファイル名の生成
    generateFilename(format, isAnonymized) {
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        const anonymizedSuffix = isAnonymized ? '_anonymized' : '';

        return `ipa_grading_export${anonymizedSuffix}_${date}_${time}.${format}`;
    }

    // 統計レポートのエクスポート
    async exportStatisticsReport() {
        try {
            const [problemStats, historyStats] = await Promise.all([
                problemManager.getStatistics(),
                historyManager.getStatistics()
            ]);

            const report = {
                metadata: {
                    generated_at: new Date().toISOString(),
                    report_type: 'statistics',
                    version: '1.0.0'
                },
                summary: {
                    total_problems: problemStats.totalProblems,
                    total_histories: historyStats.totalHistories,
                    ai_accuracy_percentage: historyStats.aiAccuracy.percentage,
                    rule_overrides: historyStats.ruleOverrides,
                    average_latency_ms: historyStats.averageLatency
                },
                problem_statistics: problemStats,
                history_statistics: historyStats
            };

            const content = JSON.stringify(report, null, 2);
            const filename = `statistics_report_${new Date().toISOString().split('T')[0]}.json`;

            downloadFile(content, filename, 'application/json');
            showToast('統計レポートをエクスポートしました', 'success');

        } catch (error) {
            handleError(error, 'exportStatisticsReport');
        }
    }

    // 設定のエクスポート
    async exportSettings() {
        try {
            const settings = {
                metadata: {
                    exported_at: new Date().toISOString(),
                    type: 'system_settings',
                    version: '1.0.0'
                },
                api_settings: apiSettings.getAll(),
                rule_settings: ruleEvaluator.getRuleSettings(),
                user_preferences: {
                    rater_id: storage.get('rater_id') || 'anonymous'
                }
            };

            const content = JSON.stringify(settings, null, 2);
            const filename = `system_settings_${new Date().toISOString().split('T')[0]}.json`;

            downloadFile(content, filename, 'application/json');
            showToast('設定をエクスポートしました', 'success');

        } catch (error) {
            handleError(error, 'exportSettings');
        }
    }

    // 問題のテンプレートエクスポート
    exportProblemTemplate() {
        try {
            const template = {
                year: '令和5年度',
                question_group: '午後I 問1',
                question_number: '設問1',
                context: 'ここに問題文を入力してください...',
                prompt: 'ここに設問を入力してください...',
                model_answer: 'ここに模範解答を入力してください...',
                intent: 'ここに出題趣旨を入力してください...',
                constraints: {
                    char_limit: 40
                },
                prompt_version: 'v1.0.0',
                model_version: 'gpt-4o-mini'
            };

            const templates = [template];
            const content = JSON.stringify(templates, null, 2);
            const filename = 'problem_template.json';

            downloadFile(content, filename, 'application/json');
            showToast('問題テンプレートをエクスポートしました', 'success');

        } catch (error) {
            handleError(error, 'exportProblemTemplate');
        }
    }

    // バックアップの作成
    async createFullBackup() {
        try {
            const [problems, histories] = await Promise.all([
                dbManager.getAllProblems(),
                dbManager.getAllHistories()
            ]);

            const backup = {
                metadata: {
                    created_at: new Date().toISOString(),
                    type: 'full_backup',
                    version: '1.0.0',
                    total_problems: problems.length,
                    total_histories: histories.length
                },
                problems: problems,
                histories: histories,
                settings: {
                    api_settings: apiSettings.getAll(),
                    rule_settings: ruleEvaluator.getRuleSettings()
                }
            };

            const content = JSON.stringify(backup, null, 2);
            const filename = `full_backup_${new Date().toISOString().split('T')[0]}.json`;

            downloadFile(content, filename, 'application/json');
            showToast('フルバックアップを作成しました', 'success');

        } catch (error) {
            handleError(error, 'createFullBackup');
        }
    }

    // バックアップの復元
    async restoreFromBackup(backupData) {
        try {
            if (!backupData.metadata || backupData.metadata.type !== 'full_backup') {
                throw new Error('無効なバックアップファイルです');
            }

            if (!confirm('既存のデータは全て削除されます。バックアップを復元しますか？')) {
                return;
            }

            // データベースのクリア
            await dbManager.clearDatabase();

            // 問題の復元
            if (backupData.problems && Array.isArray(backupData.problems)) {
                for (const problem of backupData.problems) {
                    delete problem.id; // 自動採番のためIDを削除
                    await dbManager.addProblem(problem);
                }
            }

            // 履歴の復元
            if (backupData.histories && Array.isArray(backupData.histories)) {
                for (const history of backupData.histories) {
                    delete history.id; // 自動採番のためIDを削除
                    await dbManager.addHistory(history);
                }
            }

            // 設定の復元
            if (backupData.settings) {
                if (backupData.settings.api_settings) {
                    apiSettings.update(backupData.settings.api_settings);
                }
                if (backupData.settings.rule_settings) {
                    ruleEvaluator.updateRuleSettings(backupData.settings.rule_settings);
                }
            }

            showToast('バックアップの復元が完了しました', 'success');

            // ページをリロード
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            handleError(error, 'restoreFromBackup');
        }
    }

    // 進捗レポートの生成
    async generateProgressReport(dateRange = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - dateRange);

            const allHistories = await dbManager.getAllHistories();
            const recentHistories = allHistories.filter(h =>
                new Date(h.timestamp) >= cutoffDate
            );

            const report = {
                period: {
                    days: dateRange,
                    start_date: cutoffDate.toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                summary: {
                    total_evaluations: recentHistories.length,
                    score_distribution: {
                        excellent: recentHistories.filter(h => h.final_score === '〇').length,
                        good: recentHistories.filter(h => h.final_score === '△').length,
                        poor: recentHistories.filter(h => h.final_score === '✕').length
                    },
                    ai_agreement_rate: this.calculateAgreementRate(recentHistories),
                    rule_overrides: recentHistories.filter(h => h.rule_override).length,
                    average_processing_time: this.calculateAverageProcessingTime(recentHistories)
                },
                daily_breakdown: this.generateDailyBreakdown(recentHistories, dateRange)
            };

            const content = JSON.stringify(report, null, 2);
            const filename = `progress_report_${dateRange}days_${new Date().toISOString().split('T')[0]}.json`;

            downloadFile(content, filename, 'application/json');
            showToast(`${dateRange}日間の進捗レポートを生成しました`, 'success');

        } catch (error) {
            handleError(error, 'generateProgressReport');
        }
    }

    // AI同意率の計算
    calculateAgreementRate(histories) {
        if (histories.length === 0) return 0;

        const agreements = histories.filter(h => h.ai_score === h.final_score).length;
        return Math.round((agreements / histories.length) * 100);
    }

    // 平均処理時間の計算
    calculateAverageProcessingTime(histories) {
        if (histories.length === 0) return 0;

        const totalTime = histories.reduce((sum, h) => sum + (h.latency_ms || 0), 0);
        return Math.round(totalTime / histories.length);
    }

    // 日別内訳の生成
    generateDailyBreakdown(histories, dateRange) {
        const breakdown = {};

        // 日付別にグループ化
        histories.forEach(history => {
            const date = new Date(history.timestamp).toISOString().split('T')[0];
            if (!breakdown[date]) {
                breakdown[date] = {
                    date,
                    count: 0,
                    scores: { excellent: 0, good: 0, poor: 0 },
                    rule_overrides: 0
                };
            }

            breakdown[date].count++;
            if (history.final_score === '〇') breakdown[date].scores.excellent++;
            if (history.final_score === '△') breakdown[date].scores.good++;
            if (history.final_score === '✕') breakdown[date].scores.poor++;
            if (history.rule_override) breakdown[date].rule_overrides++;
        });

        return Object.values(breakdown).sort((a, b) => a.date.localeCompare(b.date));
    }

    // エクスポート可能な形式の取得
    getSupportedFormats() {
        return this.supportedFormats;
    }

    // エクスポート状態の確認
    isExportInProgress() {
        return this.isExporting;
    }
}

// グローバルエクスポート管理インスタンス
window.exportManager = new ExportManager();