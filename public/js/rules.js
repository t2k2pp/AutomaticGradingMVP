// ルールベース評価システム

class RuleBasedEvaluator {
    constructor() {
        this.rules = [
            {
                id: 'character_limit_check',
                name: '文字数制限チェック',
                description: '指定文字数の200%を超える場合は△に固定',
                priority: 1,
                evaluate: this.checkCharacterLimit.bind(this)
            },
            {
                id: 'copy_paste_check',
                name: 'コピペ検出',
                description: '問題文との重複率が60%以上の場合は✕に固定',
                priority: 2,
                evaluate: this.checkCopyPaste.bind(this)
            },
            {
                id: 'sentence_structure_check',
                name: '文章構成チェック',
                description: '単語の羅列で文章として成立していない場合は✕に固定',
                priority: 3,
                evaluate: this.checkSentenceStructure.bind(this)
            }
        ];
    }

    // メインの評価関数
    async evaluate(answer, problem) {
        const results = {
            passed: true,
            ruleOverride: false,
            fixedScore: null,
            violations: [],
            details: []
        };

        // 各ルールを優先度順に評価
        for (const rule of this.rules.sort((a, b) => a.priority - b.priority)) {
            try {
                const ruleResult = await rule.evaluate(answer, problem);

                results.details.push({
                    rule: rule.id,
                    name: rule.name,
                    ...ruleResult
                });

                if (ruleResult.violated) {
                    results.violations.push({
                        rule: rule.id,
                        name: rule.name,
                        reason: ruleResult.reason,
                        severity: ruleResult.severity || 'high'
                    });

                    // 高優先度の違反があった場合、スコアを固定
                    if (ruleResult.severity === 'high' && ruleResult.fixedScore) {
                        results.passed = false;
                        results.ruleOverride = true;
                        results.fixedScore = ruleResult.fixedScore;

                        // 高優先度の違反があった場合、以降のルールは評価しない
                        break;
                    }
                }
            } catch (error) {
                console.error(`Rule evaluation error for ${rule.id}:`, error);
                results.details.push({
                    rule: rule.id,
                    name: rule.name,
                    error: error.message,
                    violated: false
                });
            }
        }

        return results;
    }

    // 文字数制限チェック
    checkCharacterLimit(answer, problem) {
        const charLimit = problem.constraints?.char_limit || 40;
        const charCount = countCharacters(answer);
        const percentage = (charCount / charLimit) * 100;

        const result = {
            violated: false,
            charCount,
            charLimit,
            percentage: Math.round(percentage * 10) / 10,
            severity: 'medium'
        };

        if (percentage > 200) {
            result.violated = true;
            result.severity = 'high';
            result.fixedScore = '△';
            result.reason = `文字数が制限の200%を超過しています（${charCount}文字 / ${charLimit}文字制限）`;
        } else if (percentage > 150) {
            result.violated = true;
            result.severity = 'medium';
            result.reason = `文字数が制限の150%を超過しています（${charCount}文字 / ${charLimit}文字制限）`;
        } else if (percentage < 20) {
            result.violated = true;
            result.severity = 'low';
            result.reason = `文字数が極端に少ない可能性があります（${charCount}文字 / ${charLimit}文字制限）`;
        }

        return result;
    }

    // コピペ検出チェック
    checkCopyPaste(answer, problem) {
        const sourceTexts = [
            problem.context,
            problem.prompt,
            problem.model_answer
        ].filter(text => text);

        let maxSimilarity = 0;
        let mostSimilarSource = '';

        for (const sourceText of sourceTexts) {
            const similarity = this.calculateTextSimilarity(answer, sourceText);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                mostSimilarSource = sourceText.substring(0, 50) + '...';
            }
        }

        const result = {
            violated: false,
            similarity: Math.round(maxSimilarity * 1000) / 10, // 小数点1桁
            threshold: 60,
            severity: 'medium'
        };

        if (maxSimilarity >= 0.6) {
            result.violated = true;
            result.severity = 'high';
            result.fixedScore = '✕';
            result.reason = `問題文との重複率が${result.similarity}%で閾値(60%)を超過しています`;
        } else if (maxSimilarity >= 0.4) {
            result.violated = true;
            result.severity = 'medium';
            result.reason = `問題文との重複率が${result.similarity}%でやや高い傾向にあります`;
        }

        return result;
    }

    // 文章構成チェック
    checkSentenceStructure(answer, problem) {
        const result = {
            violated: false,
            severity: 'medium'
        };

        // 基本的な文章構成チェック
        const issues = [];

        // 1. 単語の羅列チェック（句読点や助詞の極端な不足）
        const punctuationCount = (answer.match(/[、。！？]/g) || []).length;
        const particleCount = (answer.match(/[はがをにへとでからまで]/g) || []).length;
        const charCount = countCharacters(answer);

        if (charCount > 20) {
            const punctuationRatio = punctuationCount / charCount;
            const particleRatio = particleCount / charCount;

            if (punctuationRatio < 0.02) {
                issues.push('句読点が極端に少ない');
            }

            if (particleRatio < 0.05) {
                issues.push('助詞が極端に少ない');
            }
        }

        // 2. 過度な記号や特殊文字の使用
        const symbolCount = (answer.match(/[!@#$%^&*()_+=\[\]{}|;:'"<>?\/\\~`]/g) || []).length;
        if (symbolCount > charCount * 0.1) {
            issues.push('記号や特殊文字の使用が過度');
        }

        // 3. 同じ文字・単語の過度な繰り返し
        const repeatedChars = this.findRepeatedPatterns(answer);
        if (repeatedChars.length > 0) {
            issues.push(`過度な繰り返しパターンを検出: ${repeatedChars.join(', ')}`);
        }

        // 4. 極端に短い「解答」（意味のない内容）
        if (charCount < 5) {
            issues.push('解答が極端に短い');
        }

        // 5. 数字や英字のみの解答
        const onlyNumbersOrLetters = /^[0-9a-zA-Z\s]*$/.test(answer);
        if (onlyNumbersOrLetters && charCount > 5) {
            issues.push('数字や英字のみで構成されている');
        }

        if (issues.length >= 2) {
            result.violated = true;
            result.severity = 'high';
            result.fixedScore = '✕';
            result.reason = `文章として成立していない可能性があります: ${issues.join(', ')}`;
        } else if (issues.length === 1) {
            result.violated = true;
            result.severity = 'medium';
            result.reason = `文章構成に問題がある可能性があります: ${issues[0]}`;
        }

        result.issues = issues;
        return result;
    }

    // テキスト類似度計算（N-gramベース）
    calculateTextSimilarity(text1, text2) {
        // 正規化
        const normalize = (text) => {
            return text
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[、。！？]/g, '');
        };

        const normalizedText1 = normalize(text1);
        const normalizedText2 = normalize(text2);

        if (normalizedText1.length === 0 || normalizedText2.length === 0) {
            return 0;
        }

        // 3-gramで類似度を計算
        const n = 3;
        const ngrams1 = this.generateNGrams(normalizedText1, n);
        const ngrams2 = this.generateNGrams(normalizedText2, n);

        if (ngrams1.size === 0 || ngrams2.size === 0) {
            return 0;
        }

        // Jaccard係数を計算
        const intersection = new Set();
        for (const ngram of ngrams1) {
            if (ngrams2.has(ngram)) {
                intersection.add(ngram);
            }
        }

        const union = new Set([...ngrams1, ...ngrams2]);
        return intersection.size / union.size;
    }

    // N-gram生成
    generateNGrams(text, n) {
        const ngrams = new Set();
        for (let i = 0; i <= text.length - n; i++) {
            ngrams.add(text.substring(i, i + n));
        }
        return ngrams;
    }

    // 繰り返しパターンの検出
    findRepeatedPatterns(text) {
        const patterns = [];

        // 同じ文字の連続（3文字以上）
        const charRepeats = text.match(/(.)\1{2,}/g);
        if (charRepeats) {
            patterns.push(...charRepeats.map(p => `"${p}"`));
        }

        // 同じ単語の連続（2回以上）
        const words = text.match(/[ひらがなカタカナ漢字a-zA-Z0-9]+/g) || [];
        for (let i = 0; i < words.length - 1; i++) {
            if (words[i] === words[i + 1] && words[i].length > 1) {
                const pattern = words[i];
                if (!patterns.includes(`"${pattern}"`)) {
                    patterns.push(`"${pattern}"`);
                }
            }
        }

        return patterns;
    }

    // ルールの有効化/無効化
    enableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = true;
        }
    }

    disableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = false;
        }
    }

    // カスタムルールの追加
    addCustomRule(rule) {
        if (!rule.id || !rule.name || typeof rule.evaluate !== 'function') {
            throw new Error('Invalid rule format');
        }

        this.rules.push({
            ...rule,
            priority: rule.priority || 999,
            enabled: rule.enabled !== false
        });
    }

    // ルール設定の取得
    getRuleSettings() {
        return this.rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            enabled: rule.enabled !== false
        }));
    }

    // ルール設定の更新
    updateRuleSettings(settings) {
        settings.forEach(setting => {
            const rule = this.rules.find(r => r.id === setting.id);
            if (rule) {
                rule.enabled = setting.enabled;
                rule.priority = setting.priority;
            }
        });

        // 優先度順にソート
        this.rules.sort((a, b) => a.priority - b.priority);
    }

    // 評価結果のサマリー生成
    generateSummary(evaluationResult) {
        const summary = {
            status: evaluationResult.passed ? 'passed' : 'failed',
            ruleOverride: evaluationResult.ruleOverride,
            fixedScore: evaluationResult.fixedScore,
            violationCount: evaluationResult.violations.length,
            severity: 'none'
        };

        if (evaluationResult.violations.length > 0) {
            const severities = evaluationResult.violations.map(v => v.severity);
            if (severities.includes('high')) {
                summary.severity = 'high';
            } else if (severities.includes('medium')) {
                summary.severity = 'medium';
            } else {
                summary.severity = 'low';
            }
        }

        summary.message = this.generateSummaryMessage(summary, evaluationResult);
        return summary;
    }

    // サマリーメッセージの生成
    generateSummaryMessage(summary, evaluationResult) {
        if (summary.status === 'passed') {
            return 'ルールベース評価をクリアしました。AI採点を実行します。';
        }

        if (summary.ruleOverride) {
            const violation = evaluationResult.violations.find(v => v.severity === 'high');
            return `ルール違反により評価が「${summary.fixedScore}」に固定されました。理由: ${violation.reason}`;
        }

        const violationNames = evaluationResult.violations.map(v => v.name);
        return `以下のルール違反が検出されました: ${violationNames.join(', ')}`;
    }
}

// グローバルルール評価インスタンス
window.ruleEvaluator = new RuleBasedEvaluator();

// ルール評価の便利関数
window.evaluateRules = async function(answer, problem) {
    try {
        const result = await window.ruleEvaluator.evaluate(answer, problem);
        const summary = window.ruleEvaluator.generateSummary(result);

        return {
            ...result,
            summary
        };
    } catch (error) {
        console.error('Rule evaluation error:', error);
        return {
            passed: true,
            ruleOverride: false,
            fixedScore: null,
            violations: [],
            details: [],
            summary: {
                status: 'error',
                message: 'ルール評価中にエラーが発生しました'
            }
        };
    }
};