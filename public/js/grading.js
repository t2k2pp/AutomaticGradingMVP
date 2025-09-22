// AI採点システム

class GradingSystem {
    constructor() {
        this.currentProblem = null;
        this.currentAnswer = '';
        this.currentResult = null;
        this.isGrading = false;
        this.gradingHistory = [];

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.refreshProblemSelector();
        await this.loadCurrentState();
    }

    bindEvents() {
        // 採点ボタンのイベント
        const gradeButton = document.getElementById('grade-answer');
        if (gradeButton) {
            gradeButton.addEventListener('click', () => this.executeGrading());
        }

        // 解答クリアボタンのイベント
        const clearButton = document.getElementById('clear-answer');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearAnswer());
        }

        // 評価保存ボタンのイベント
        const saveButton = document.getElementById('save-evaluation');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveEvaluation());
        }

        // 解答テキストエリアのイベント
        const answerTextarea = document.getElementById('student-answer');
        if (answerTextarea) {
            answerTextarea.addEventListener('input', (e) => {
                this.currentAnswer = e.target.value;
                this.updateCharacterCount();
                this.saveCurrentState();
            });

            answerTextarea.addEventListener('paste', () => {
                // ペースト後の処理のため少し遅らせる
                setTimeout(() => {
                    this.currentAnswer = answerTextarea.value;
                    this.updateCharacterCount();
                    this.saveCurrentState();
                }, 100);
            });
        }

        // 問題選択のイベント
        const problemSelector = document.getElementById('problem-selector');
        if (problemSelector) {
            problemSelector.addEventListener('change', (e) => {
                const problemId = parseInt(e.target.value);
                if (problemId) {
                    this.loadProblem(problemId);
                } else {
                    this.clearProblem();
                }
            });
        }

        // 最終スコア選択のイベント
        const scoreRadios = document.querySelectorAll('input[name="final-score"]');
        scoreRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateFinalScore();
            });
        });

        // アプリケーションイベント
        appEvents.on('problemAdded', (problem) => {
            this.refreshProblemSelector();
        });

        appEvents.on('problemUpdated', (problem) => {
            if (this.currentProblem && this.currentProblem.id === problem.id) {
                this.currentProblem = problem;
                this.displayProblem();
            }
            this.refreshProblemSelector();
        });

        appEvents.on('problemDeleted', (problemId) => {
            if (this.currentProblem && this.currentProblem.id === problemId) {
                this.clearProblem();
            }
            this.refreshProblemSelector();
        });
    }

    // 問題の読み込み
    async loadProblem(problemId) {
        try {
            this.currentProblem = await dbManager.getProblem(problemId);
            if (this.currentProblem) {
                this.displayProblem();
                this.clearResult();
                this.saveCurrentState();
                showToast('問題を読み込みました', 'success');
            } else {
                showToast('問題が見つかりません', 'error');
            }
        } catch (error) {
            handleError(error, 'loadProblem');
        }
    }

    // 問題の表示
    displayProblem() {
        const problemInfo = document.getElementById('problem-info');
        if (!problemInfo || !this.currentProblem) return;

        const problem = this.currentProblem;

        problemInfo.innerHTML = `
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
                <div class="problem-meta-item">
                    <span class="label">文字数制限</span>
                    <span class="value">${problem.constraints?.char_limit || 40}文字</span>
                </div>
            </div>

            <div class="problem-detail">
                <h4>問題文</h4>
                <p>${escapeHtml(problem.context).replace(/\n/g, '<br>')}</p>
            </div>

            <div class="problem-detail">
                <h4>設問</h4>
                <p>${escapeHtml(problem.prompt).replace(/\n/g, '<br>')}</p>
            </div>

            <div class="problem-detail">
                <h4>模範解答</h4>
                <p>${escapeHtml(problem.model_answer).replace(/\n/g, '<br>')}</p>
            </div>

            <div class="problem-detail">
                <h4>出題趣旨</h4>
                <p>${escapeHtml(problem.intent).replace(/\n/g, '<br>')}</p>
            </div>
        `;

        // 文字数カウンターの更新
        this.updateCharacterCount();
    }

    // 問題のクリア
    clearProblem() {
        this.currentProblem = null;
        this.clearAnswer();
        this.clearResult();

        const problemInfo = document.getElementById('problem-info');
        if (problemInfo) {
            problemInfo.innerHTML = '<p class="text-muted">問題を選択してください</p>';
        }

        const problemSelector = document.getElementById('problem-selector');
        if (problemSelector) {
            problemSelector.value = '';
        }

        this.saveCurrentState();
    }

    // 解答のクリア
    clearAnswer() {
        this.currentAnswer = '';
        const answerTextarea = document.getElementById('student-answer');
        if (answerTextarea) {
            answerTextarea.value = '';
        }
        this.updateCharacterCount();
        this.clearResult();
        this.saveCurrentState();
    }

    // 結果のクリア
    clearResult() {
        this.currentResult = null;

        const resultArea = document.getElementById('grading-result');
        if (resultArea) {
            resultArea.innerHTML = '<p class="text-muted">採点を実行してください</p>';
        }

        // 最終評価のリセット
        this.clearFinalEvaluation();
    }

    // 最終評価のクリア
    clearFinalEvaluation() {
        const scoreRadios = document.querySelectorAll('input[name="final-score"]');
        scoreRadios.forEach(radio => {
            radio.checked = false;
        });

        const commentTextarea = document.getElementById('final-comment');
        if (commentTextarea) {
            commentTextarea.value = '';
        }
    }

    // 文字数カウンターの更新
    updateCharacterCount() {
        const charCountElement = document.getElementById('char-count');
        if (!charCountElement) return;

        const count = countCharacters(this.currentAnswer);
        charCountElement.textContent = count;

        // 制限チェック
        if (this.currentProblem && this.currentProblem.constraints?.char_limit) {
            const limit = this.currentProblem.constraints.char_limit;
            const checkResult = checkCharacterLimit(this.currentAnswer, limit);

            charCountElement.className = 'char-count';
            if (checkResult.isOverDoubleLimit) {
                charCountElement.classList.add('error');
            } else if (checkResult.isNearLimit) {
                charCountElement.classList.add('warning');
            }
        }
    }

    // 採点の実行
    async executeGrading() {
        if (this.isGrading) {
            showToast('採点実行中です', 'warning');
            return;
        }

        if (!this.currentProblem) {
            showToast('問題を選択してください', 'warning');
            return;
        }

        if (!this.currentAnswer.trim()) {
            showToast('解答を入力してください', 'warning');
            return;
        }

        this.isGrading = true;
        this.showLoadingOverlay(true);

        try {
            // 1. ルールベース評価
            const ruleResult = await evaluateRules(this.currentAnswer, this.currentProblem);

            // ルール違反で評価が確定した場合
            if (ruleResult.ruleOverride) {
                this.currentResult = {
                    ai_score: ruleResult.fixedScore,
                    ai_reason: ruleResult.summary.message,
                    ai_feedback: {
                        positive_points: [],
                        negative_points: ruleResult.violations.map(v => v.reason)
                    },
                    rule_override: true,
                    rule_details: ruleResult.details,
                    metadata: {
                        problem_id: this.currentProblem.id,
                        latency_ms: 0,
                        json_valid: true,
                        timestamp: new Date().toISOString()
                    }
                };
            } else {
                // 2. AI採点実行
                const gradingData = {
                    context: this.currentProblem.context,
                    prompt: this.currentProblem.prompt,
                    model_answer: this.currentProblem.model_answer,
                    intent: this.currentProblem.intent,
                    student_answer: this.currentAnswer,
                    problem_id: this.currentProblem.id,
                    rater_id: storage.get('rater_id') || 'anonymous'
                };

                this.currentResult = await apiClient.gradeAnswer(gradingData);
                this.currentResult.rule_override = false;
                this.currentResult.rule_details = ruleResult.details;
            }

            // 結果の表示
            this.displayResult();

            // 最終スコアの初期設定
            this.setFinalScore(this.currentResult.ai_score);

            showToast('採点が完了しました', 'success');

        } catch (error) {
            handleError(error, 'executeGrading');
            this.currentResult = null;
        } finally {
            this.isGrading = false;
            this.showLoadingOverlay(false);
        }
    }

    // 結果の表示
    displayResult() {
        const resultArea = document.getElementById('grading-result');
        if (!resultArea || !this.currentResult) return;

        const result = this.currentResult;
        const isRuleOverride = result.rule_override;

        resultArea.innerHTML = `
            <div class="score-display">
                <div class="score-badge ${this.getScoreClass(result.ai_score)}">
                    ${result.ai_score}
                </div>
                ${isRuleOverride ? '<span class="rule-indicator"><i class="fas fa-exclamation-triangle"></i>ルール適用</span>' : ''}
            </div>

            <div class="ai-reason">
                <h4><i class="fas fa-robot"></i> AI評価理由</h4>
                <p>${escapeHtml(result.ai_reason)}</p>
            </div>

            ${this.renderFeedback(result.ai_feedback)}

            ${this.renderMetadata(result.metadata)}

            ${this.renderRuleDetails(result.rule_details)}
        `;
    }

    // フィードバックの表示
    renderFeedback(feedback) {
        if (!feedback || (!feedback.positive_points?.length && !feedback.negative_points?.length)) {
            return '';
        }

        return `
            <div class="feedback-section">
                ${feedback.positive_points?.length ? `
                    <div class="feedback-positive">
                        <h4><i class="fas fa-thumbs-up"></i> 良い点</h4>
                        <ul class="feedback-list">
                            ${feedback.positive_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${feedback.negative_points?.length ? `
                    <div class="feedback-negative">
                        <h4><i class="fas fa-thumbs-down"></i> 改善点</h4>
                        <ul class="feedback-list">
                            ${feedback.negative_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // メタデータの表示
    renderMetadata(metadata) {
        if (!metadata) return '';

        return `
            <div class="metadata-section">
                <h4><i class="fas fa-info-circle"></i> 処理情報</h4>
                <div class="metadata-grid">
                    ${metadata.latency_ms ? `<span>処理時間: ${metadata.latency_ms}ms</span>` : ''}
                    ${metadata.token_usage?.total ? `<span>トークン使用量: ${metadata.token_usage.total}</span>` : ''}
                    ${metadata.llm_params?.model ? `<span>モデル: ${metadata.llm_params.model}</span>` : ''}
                    <span>JSON有効性: ${metadata.json_valid ? '✓' : '✗'}</span>
                </div>
            </div>
        `;
    }

    // ルール詳細の表示
    renderRuleDetails(ruleDetails) {
        if (!ruleDetails || !ruleDetails.length) return '';

        return `
            <div class="rule-details-section">
                <h4><i class="fas fa-gavel"></i> ルール評価詳細</h4>
                <div class="rule-details-list">
                    ${ruleDetails.map(detail => `
                        <div class="rule-detail-item ${detail.violated ? 'violated' : 'passed'}">
                            <span class="rule-name">${escapeHtml(detail.name)}</span>
                            <span class="rule-status">${detail.violated ? '✗' : '✓'}</span>
                            ${detail.reason ? `<span class="rule-reason">${escapeHtml(detail.reason)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
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

    // 最終スコアの設定
    setFinalScore(score) {
        const scoreRadios = document.querySelectorAll('input[name="final-score"]');
        scoreRadios.forEach(radio => {
            radio.checked = radio.value === score;
        });
    }

    // 最終スコアの更新
    updateFinalScore() {
        const selectedRadio = document.querySelector('input[name="final-score"]:checked');
        if (selectedRadio && this.currentResult) {
            // 何らかの追加処理があればここに記述
        }
    }

    // 評価の保存
    async saveEvaluation() {
        if (!this.currentProblem || !this.currentAnswer || !this.currentResult) {
            showToast('採点結果がありません', 'warning');
            return;
        }

        const selectedRadio = document.querySelector('input[name="final-score"]:checked');
        if (!selectedRadio) {
            showToast('最終スコアを選択してください', 'warning');
            return;
        }

        const finalComment = document.getElementById('final-comment').value;
        const finalScore = selectedRadio.value;

        // AI評価と最終評価が異なる場合のコメント必須チェック
        if (this.currentResult.ai_score !== finalScore && !finalComment.trim()) {
            showToast('AI評価と異なる場合はコメントが必須です', 'warning');
            return;
        }

        try {
            const historyData = {
                problem_id: this.currentProblem.id,
                student_answer: this.currentAnswer,
                ai_score: this.currentResult.ai_score,
                ai_reason: this.currentResult.ai_reason,
                ai_feedback: this.currentResult.ai_feedback,
                final_score: finalScore,
                final_comment: finalComment,
                rule_override: this.currentResult.rule_override,
                json_valid: this.currentResult.metadata?.json_valid || true,
                llm_params: this.currentResult.metadata?.llm_params || {},
                latency_ms: this.currentResult.metadata?.latency_ms || 0,
                token_usage: this.currentResult.metadata?.token_usage || {},
                rater_id: storage.get('rater_id') || 'anonymous'
            };

            await dbManager.addHistory(historyData);

            showToast('評価を保存しました', 'success');

            // 状態のクリア
            this.clearAnswer();
            this.clearResult();

        } catch (error) {
            handleError(error, 'saveEvaluation');
        }
    }

    // 問題セレクターの更新
    async refreshProblemSelector() {
        const selector = document.getElementById('problem-selector');
        if (!selector) return;

        try {
            const problems = await dbManager.getAllProblems();

            // 現在の選択を保持
            const currentValue = selector.value;

            selector.innerHTML = '<option value="">問題を選択してください</option>';

            problems.forEach(problem => {
                const option = document.createElement('option');
                option.value = problem.id;
                option.textContent = `${problem.year} ${problem.question_group} ${problem.question_number}`;
                selector.appendChild(option);
            });

            // 選択を復元
            if (currentValue) {
                selector.value = currentValue;
            }

        } catch (error) {
            console.error('問題セレクター更新エラー:', error);
        }
    }

    // ローディングオーバーレイの表示/非表示
    showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }

    // 現在の状態を保存
    saveCurrentState() {
        const state = {
            problemId: this.currentProblem?.id || null,
            answer: this.currentAnswer,
            timestamp: new Date().toISOString()
        };
        storage.set('grading_current_state', state);
    }

    // 現在の状態を読み込み
    async loadCurrentState() {
        const state = storage.get('grading_current_state');
        if (state) {
            if (state.problemId) {
                try {
                    await this.loadProblem(state.problemId);
                    const selector = document.getElementById('problem-selector');
                    if (selector) {
                        selector.value = state.problemId;
                    }
                } catch (error) {
                    console.warn('保存された問題の読み込みに失敗:', error);
                }
            }

            if (state.answer) {
                this.currentAnswer = state.answer;
                const answerTextarea = document.getElementById('student-answer');
                if (answerTextarea) {
                    answerTextarea.value = state.answer;
                }
                this.updateCharacterCount();
            }
        }
    }
}

// グローバル採点システムインスタンス
window.gradingSystem = new GradingSystem();