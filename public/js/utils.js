// ユーティリティ関数

// 一意なIDを生成
function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

// 日付フォーマット
function formatDate(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 文字数カウント
function countCharacters(text) {
    return text.replace(/\s/g, '').length;
}

// 文字数制限チェック
function checkCharacterLimit(text, limit) {
    const count = countCharacters(text);
    const percentage = (count / limit) * 100;

    return {
        count,
        limit,
        percentage,
        isOverLimit: count > limit,
        isNearLimit: percentage > 90,
        isOverDoubleLimit: percentage > 200
    };
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// スロットル関数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// エスケープHTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// スコアの数値変換
function scoreToNumeric(score) {
    switch (score) {
        case '〇': return 1;
        case '△': return 0.5;
        case '✕': return 0;
        default: return 0;
    }
}

// 数値からスコアへの変換
function numericToScore(numeric) {
    if (numeric === 1) return '〇';
    if (numeric === 0.5) return '△';
    if (numeric === 0) return '✕';
    return '✕';
}

// CSVエスケープ
function escapeCsv(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    // ダブルクォートをエスケープ
    value = value.replace(/"/g, '""');

    // カンマ、改行、ダブルクォートが含まれている場合はダブルクォートで囲む
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
    }

    return value;
}

// JSONLエスケープ
function escapeJsonl(obj) {
    return JSON.stringify(obj);
}

// 匿名化処理
function anonymizeData(data, fields = ['rater_id']) {
    const anonymized = { ...data };

    fields.forEach(field => {
        if (anonymized[field]) {
            anonymized[field] = `anonymous_${hashString(anonymized[field])}`;
        }
    });

    return anonymized;
}

// 簡単なハッシュ関数
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
}

// ファイルダウンロード
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// 配列のフィルタリング
function filterArray(array, filters) {
    return array.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
            if (!value) return true; // 空の値はフィルタしない

            if (typeof value === 'string') {
                return String(item[key]).toLowerCase().includes(value.toLowerCase());
            }

            return item[key] === value;
        });
    });
}

// 配列のソート
function sortArray(array, key, direction = 'asc') {
    return [...array].sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];

        // 日付の場合
        if (key === 'timestamp') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }

        // 数値の場合
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // 文字列の場合
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return direction === 'asc'
                ? aVal.localeCompare(bVal, 'ja')
                : bVal.localeCompare(aVal, 'ja');
        }

        // 日付の場合
        if (aVal instanceof Date && bVal instanceof Date) {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
    });
}

// エラーハンドリング
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);

    // ユーザーフレンドリーなエラーメッセージを生成
    let userMessage = 'エラーが発生しました。';

    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        userMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
    } else if (error.name === 'ValidationError') {
        userMessage = `入力データに問題があります: ${error.message}`;
    } else if (error.name === 'DatabaseError') {
        userMessage = 'データベースエラーが発生しました。データの保存に失敗した可能性があります。';
    }

    // showToastが利用可能な場合のみ呼び出し
    if (typeof showToast === 'function') {
        showToast(userMessage, 'error');
    } else {
        console.warn('showToast function not available:', userMessage);
    }
    return userMessage;
}

// ローカルストレージの管理
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    },

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
};

// バリデーション関数
const validation = {
    required(value, fieldName) {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            throw new Error(`${fieldName}は必須です`);
        }
        return true;
    },

    maxLength(value, max, fieldName) {
        if (value && value.length > max) {
            throw new Error(`${fieldName}は${max}文字以内で入力してください`);
        }
        return true;
    },

    minLength(value, min, fieldName) {
        if (value && value.length < min) {
            throw new Error(`${fieldName}は${min}文字以上で入力してください`);
        }
        return true;
    },

    isNumber(value, fieldName) {
        if (value && isNaN(Number(value))) {
            throw new Error(`${fieldName}は数値で入力してください`);
        }
        return true;
    },

    isPositive(value, fieldName) {
        if (value && Number(value) <= 0) {
            throw new Error(`${fieldName}は正の数で入力してください`);
        }
        return true;
    }
};

// パフォーマンス測定
function measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
}

// 非同期パフォーマンス測定
async function measureAsyncPerformance(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
}

// イベントエミッター
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;

        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    emit(event, ...args) {
        if (!this.events[event]) return;

        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    once(event, callback) {
        const onceCallback = (...args) => {
            callback(...args);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }
}

// グローバルイベントエミッター
window.appEvents = new EventEmitter();

// プロミスのリトライ機能
async function retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    throw lastError;
}