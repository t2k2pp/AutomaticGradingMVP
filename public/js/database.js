// IndexedDB データベース管理クラス

class DatabaseManager {
    constructor() {
        this.dbName = 'IPAGradingSystem';
        this.dbVersion = 1;
        this.db = null;
    }

    // データベース初期化
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('データベースの初期化に失敗しました'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('データベースが正常に初期化されました');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // problemsストアの作成
                if (!db.objectStoreNames.contains('problems')) {
                    const problemsStore = db.createObjectStore('problems', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // インデックスの作成
                    problemsStore.createIndex('year', 'year', { unique: false });
                    problemsStore.createIndex('question_group', 'question_group', { unique: false });
                    problemsStore.createIndex('question_number', 'question_number', { unique: false });
                    problemsStore.createIndex('prompt_version', 'prompt_version', { unique: false });
                }

                // historiesストアの作成
                if (!db.objectStoreNames.contains('histories')) {
                    const historiesStore = db.createObjectStore('histories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // インデックスの作成
                    historiesStore.createIndex('problem_id', 'problem_id', { unique: false });
                    historiesStore.createIndex('ai_score', 'ai_score', { unique: false });
                    historiesStore.createIndex('final_score', 'final_score', { unique: false });
                    historiesStore.createIndex('rater_id', 'rater_id', { unique: false });
                    historiesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    historiesStore.createIndex('rule_override', 'rule_override', { unique: false });
                }

                console.log('データベーススキーマが作成されました');
            };
        });
    }

    // 問題データの操作
    async addProblem(problemData) {
        try {
            // バリデーション
            this.validateProblemData(problemData);

            const problem = {
                year: problemData.year,
                question_group: problemData.question_group,
                question_number: problemData.question_number,
                context: problemData.context,
                prompt: problemData.prompt,
                model_answer: problemData.model_answer,
                intent: problemData.intent,
                rubric: problemData.rubric || [],
                prompt_version: problemData.prompt_version || 'v1.0.0',
                model_version: problemData.model_version || 'gpt-4o-mini',
                constraints: problemData.constraints || { char_limit: 40 },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const transaction = this.db.transaction(['problems'], 'readwrite');
            const store = transaction.objectStore('problems');
            const request = store.add(problem);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    problem.id = request.result;
                    console.log('問題が正常に追加されました:', problem.id);
                    appEvents.emit('problemAdded', problem);
                    resolve(problem);
                };

                request.onerror = () => {
                    reject(new Error('問題の追加に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題の追加エラー: ${error.message}`);
        }
    }

    async getProblem(id) {
        try {
            const transaction = this.db.transaction(['problems'], 'readonly');
            const store = transaction.objectStore('problems');
            const request = store.get(id);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    reject(new Error('問題の取得に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題の取得エラー: ${error.message}`);
        }
    }

    async getAllProblems() {
        try {
            const transaction = this.db.transaction(['problems'], 'readonly');
            const store = transaction.objectStore('problems');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    reject(new Error('問題一覧の取得に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題一覧の取得エラー: ${error.message}`);
        }
    }

    async updateProblem(id, updateData) {
        try {
            const problem = await this.getProblem(id);
            if (!problem) {
                throw new Error('問題が見つかりません');
            }

            const updatedProblem = {
                ...problem,
                ...updateData,
                updated_at: new Date().toISOString()
            };

            const transaction = this.db.transaction(['problems'], 'readwrite');
            const store = transaction.objectStore('problems');
            const request = store.put(updatedProblem);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('問題が正常に更新されました:', id);
                    appEvents.emit('problemUpdated', updatedProblem);
                    resolve(updatedProblem);
                };

                request.onerror = () => {
                    reject(new Error('問題の更新に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題の更新エラー: ${error.message}`);
        }
    }

    async deleteProblem(id) {
        try {
            const transaction = this.db.transaction(['problems'], 'readwrite');
            const store = transaction.objectStore('problems');
            const request = store.delete(id);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('問題が正常に削除されました:', id);
                    appEvents.emit('problemDeleted', id);
                    resolve(true);
                };

                request.onerror = () => {
                    reject(new Error('問題の削除に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題の削除エラー: ${error.message}`);
        }
    }

    // 履歴データの操作
    async addHistory(historyData) {
        try {
            this.validateHistoryData(historyData);

            const history = {
                problem_id: historyData.problem_id,
                student_answer: historyData.student_answer,
                embedding: historyData.embedding || null,
                ai_score: historyData.ai_score,
                ai_reason: historyData.ai_reason,
                ai_feedback: historyData.ai_feedback,
                final_score: historyData.final_score,
                final_comment: historyData.final_comment,
                score_numeric: scoreToNumeric(historyData.final_score),
                rule_override: historyData.rule_override || false,
                json_valid: historyData.json_valid || true,
                llm_params: historyData.llm_params || {},
                latency_ms: historyData.latency_ms || 0,
                token_usage: historyData.token_usage || {},
                rater_id: historyData.rater_id || 'anonymous',
                timestamp: new Date().toISOString()
            };

            const transaction = this.db.transaction(['histories'], 'readwrite');
            const store = transaction.objectStore('histories');
            const request = store.add(history);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    history.id = request.result;
                    console.log('履歴が正常に追加されました:', history.id);
                    appEvents.emit('historyAdded', history);
                    resolve(history);
                };

                request.onerror = () => {
                    reject(new Error('履歴の追加に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`履歴の追加エラー: ${error.message}`);
        }
    }

    async getHistory(id) {
        try {
            const transaction = this.db.transaction(['histories'], 'readonly');
            const store = transaction.objectStore('histories');
            const request = store.get(id);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    reject(new Error('履歴の取得に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`履歴の取得エラー: ${error.message}`);
        }
    }

    async getAllHistories(filters = {}) {
        try {
            const transaction = this.db.transaction(['histories'], 'readonly');
            const store = transaction.objectStore('histories');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    let histories = request.result;

                    // フィルタリング
                    if (Object.keys(filters).length > 0) {
                        histories = filterArray(histories, filters);
                    }

                    // 日付順でソート（新しい順）
                    histories = sortArray(histories, 'timestamp', 'desc');

                    resolve(histories);
                };

                request.onerror = () => {
                    reject(new Error('履歴一覧の取得に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`履歴一覧の取得エラー: ${error.message}`);
        }
    }

    async getHistoriesByProblem(problemId) {
        try {
            const transaction = this.db.transaction(['histories'], 'readonly');
            const store = transaction.objectStore('histories');
            const index = store.index('problem_id');
            const request = index.getAll(problemId);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const histories = sortArray(request.result, 'timestamp', 'desc');
                    resolve(histories);
                };

                request.onerror = () => {
                    reject(new Error('問題の履歴取得に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`問題の履歴取得エラー: ${error.message}`);
        }
    }

    async updateHistory(id, updateData) {
        try {
            const history = await this.getHistory(id);
            if (!history) {
                throw new Error('履歴が見つかりません');
            }

            const updatedHistory = {
                ...history,
                ...updateData,
                score_numeric: scoreToNumeric(updateData.final_score || history.final_score),
                updated_at: new Date().toISOString()
            };

            const transaction = this.db.transaction(['histories'], 'readwrite');
            const store = transaction.objectStore('histories');
            const request = store.put(updatedHistory);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('履歴が正常に更新されました:', id);
                    appEvents.emit('historyUpdated', updatedHistory);
                    resolve(updatedHistory);
                };

                request.onerror = () => {
                    reject(new Error('履歴の更新に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`履歴の更新エラー: ${error.message}`);
        }
    }

    async deleteHistory(id) {
        try {
            const transaction = this.db.transaction(['histories'], 'readwrite');
            const store = transaction.objectStore('histories');
            const request = store.delete(id);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('履歴が正常に削除されました:', id);
                    appEvents.emit('historyDeleted', id);
                    resolve(true);
                };

                request.onerror = () => {
                    reject(new Error('履歴の削除に失敗しました'));
                };
            });
        } catch (error) {
            throw new Error(`履歴の削除エラー: ${error.message}`);
        }
    }

    // 統計情報の取得
    async getStatistics() {
        try {
            const [problems, histories] = await Promise.all([
                this.getAllProblems(),
                this.getAllHistories()
            ]);

            const stats = {
                totalProblems: problems.length,
                totalHistories: histories.length,
                scoreDistribution: {
                    excellent: histories.filter(h => h.final_score === '〇').length,
                    good: histories.filter(h => h.final_score === '△').length,
                    poor: histories.filter(h => h.final_score === '✕').length
                },
                ruleOverrides: histories.filter(h => h.rule_override).length,
                averageLatency: histories.length > 0
                    ? histories.reduce((sum, h) => sum + (h.latency_ms || 0), 0) / histories.length
                    : 0,
                yearDistribution: {}
            };

            // 年度別の分布
            problems.forEach(problem => {
                const year = problem.year;
                if (!stats.yearDistribution[year]) {
                    stats.yearDistribution[year] = 0;
                }
                stats.yearDistribution[year]++;
            });

            return stats;
        } catch (error) {
            throw new Error(`統計情報の取得エラー: ${error.message}`);
        }
    }

    // データベースのクリア
    async clearDatabase() {
        try {
            const transaction = this.db.transaction(['problems', 'histories'], 'readwrite');
            const problemsStore = transaction.objectStore('problems');
            const historiesStore = transaction.objectStore('histories');

            await Promise.all([
                new Promise((resolve, reject) => {
                    const request = problemsStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error('問題データのクリアに失敗しました'));
                }),
                new Promise((resolve, reject) => {
                    const request = historiesStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error('履歴データのクリアに失敗しました'));
                })
            ]);

            console.log('データベースが正常にクリアされました');
            appEvents.emit('databaseCleared');
            return true;
        } catch (error) {
            throw new Error(`データベースのクリアエラー: ${error.message}`);
        }
    }

    // バリデーション関数
    validateProblemData(data) {
        validation.required(data.year, '年度');
        validation.required(data.question_group, '問題群');
        validation.required(data.question_number, '設問');
        validation.required(data.context, '問題文');
        validation.required(data.prompt, '設問');
        validation.required(data.model_answer, '模範解答');
        validation.required(data.intent, '出題趣旨');

        validation.maxLength(data.year, 20, '年度');
        validation.maxLength(data.question_group, 50, '問題群');
        validation.maxLength(data.question_number, 20, '設問');

        if (data.constraints && data.constraints.char_limit) {
            validation.isNumber(data.constraints.char_limit, '文字数制限');
            validation.isPositive(data.constraints.char_limit, '文字数制限');
        }
    }

    validateHistoryData(data) {
        validation.required(data.problem_id, '問題ID');
        validation.required(data.student_answer, '受験者解答');
        validation.required(data.ai_score, 'AIスコア');
        validation.required(data.final_score, '最終スコア');

        validation.isNumber(data.problem_id, '問題ID');

        const validScores = ['〇', '△', '✕'];
        if (!validScores.includes(data.ai_score)) {
            throw new Error('AIスコアは〇、△、✕のいずれかである必要があります');
        }
        if (!validScores.includes(data.final_score)) {
            throw new Error('最終スコアは〇、△、✕のいずれかである必要があります');
        }
    }

    // データベース接続状態の確認
    isConnected() {
        return this.db !== null && this.db.readyState !== 'closed';
    }

    // データベースのクローズ
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('データベース接続をクローズしました');
        }
    }
}

// グローバルデータベースインスタンス
window.dbManager = new DatabaseManager();