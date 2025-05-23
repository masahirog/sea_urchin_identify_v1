/**
 * ウニ生殖乳頭分析システム - 共通ユーティリティ
 * システム全体で使用する共通機能、ユーティリティ関数を提供
 */

// ===========================================================
// DOM操作ユーティリティ
// ===========================================================

/**
 * 要素のテキストを設定
 * @param {string} elementId - 要素のID
 * @param {string|number} text - 設定するテキスト
 */
export function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * 要素を表示する
 * @param {string} elementId - 要素のID
 */
export function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('d-none');
    }
}

/**
 * 要素を非表示にする
 * @param {string} elementId - 要素のID
 */
export function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('d-none');
    }
}

/**
 * ファイル名を省略表示用に短縮
 * @param {string} filename - ファイル名
 * @param {number} maxLength - 最大文字数
 * @returns {string} 短縮されたファイル名
 */
export function truncateFilename(filename, maxLength = 20) {
    if (!filename) return '';
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const name = filename.substring(0, filename.length - extension.length - 1);
    
    if (name.length <= maxLength - 3) return filename;
    
    return name.substring(0, maxLength - 3) + '...' + (extension ? '.' + extension : '');
}

// ===========================================================
// 通知・メッセージユーティリティ
// ===========================================================

/**
 * グローバル通知を表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 通知タイプ（'info', 'success', 'danger', 'warning'）
 * @param {number} duration - 表示時間（ミリ秒）、0は手動で閉じるまで表示
 */
export function showSystemNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('system-notifications');
    if (!container) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    
    const iconMap = {
        'info': 'info-circle',
        'success': 'check-circle',
        'danger': 'exclamation-circle',
        'warning': 'exclamation-triangle'
    };
    const icon = iconMap[type] || 'info-circle';
    
    alertDiv.innerHTML = `
        <i class="fas fa-${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alertDiv);
    
    if (duration > 0) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                    const bsAlert = new bootstrap.Alert(alertDiv);
                    bsAlert.close();
                } else {
                    alertDiv.remove();
                }
            }
        }, duration);
    }
}

export function showSuccessMessage(message, duration = 3000) {
    showSystemNotification(message, 'success', duration);
}

export function showErrorMessage(message, duration = 5000) {
    showSystemNotification(message, 'danger', duration);
}

export function showWarningMessage(message, duration = 4000) {
    showSystemNotification(message, 'warning', duration);
}

export function showInfoMessage(message, duration = 3000) {
    showSystemNotification(message, 'info', duration);
}

// ===========================================================
// ローディング表示ユーティリティ
// ===========================================================

let loadingCounter = 0;

/**
 * ローディングオーバーレイを表示
 * @param {string} message - 表示するメッセージ
 */
export function showLoading(message = '処理中...') {
    loadingCounter++;
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.querySelector('.loading-message');
    const progressContainer = document.querySelector('.loading-progress');
    
    if (overlay) {
        overlay.classList.remove('d-none');
        if (messageEl) messageEl.textContent = message;
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

/**
 * ローディングオーバーレイを非表示
 */
export function hideLoading() {
    loadingCounter--;
    if (loadingCounter <= 0) {
        loadingCounter = 0;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    }
}

/**
 * 進捗付きローディングオーバーレイを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} progress - 進捗（0-100）
 */
export function showLoadingWithProgress(message = '処理中...', progress = 0) {
    loadingCounter++;
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.querySelector('.loading-message');
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');
    const progressContainer = document.querySelector('.loading-progress');
    
    if (overlay) {
        overlay.classList.remove('d-none');
        if (messageEl) messageEl.textContent = message;
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${Math.round(progress)}%`;
        }
        if (progressText) progressText.textContent = `${Math.round(progress)}%`;
    }
}

/**
 * ローディング進捗を更新
 * @param {number} progress - 進捗（0-100）
 * @param {string} message - 表示するメッセージ（nullの場合は更新しない）
 */
export function updateLoadingProgress(progress, message = null) {
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');
    const messageEl = document.querySelector('.loading-message');
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
    }
    if (progressText) progressText.textContent = `${Math.round(progress)}%`;
    if (message && messageEl) messageEl.textContent = message;
}

// ===========================================================
// API通信ユーティリティ
// ===========================================================

/**
 * APIリクエストのラッパー
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @returns {Promise<Object>} レスポンスデータ
 */
export async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`APIエラー: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('APIリクエストエラー:', error);
        throw error;
    }
}

/**
 * フォームデータのAPIリクエスト
 * @param {string} url - リクエストURL
 * @param {FormData} formData - フォームデータ
 * @returns {Promise<Object>} レスポンスデータ
 */
export async function apiRequestFormData(url, formData) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`APIエラー: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('APIリクエストエラー:', error);
        throw error;
    }
}

// ===========================================================
// データ操作ユーティリティ
// ===========================================================

/**
 * ネストされたオブジェクトから安全に値を取得
 * @param {Object} obj - 対象オブジェクト
 * @param {string} path - ドット区切りのパス
 * @param {any} defaultValue - デフォルト値
 * @returns {any} 取得した値
 */
export function getNestedValue(obj, path, defaultValue = null) {
    if (!obj || !path) return defaultValue;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return defaultValue;
        }
        current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
}

/**
 * オブジェクトの深いコピーを作成
 * @param {any} obj - コピー対象
 * @returns {any} コピーされたオブジェクト
 */
export function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export function debounce(func, wait) {
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

// ===========================================================
// UI要素ユーティリティ
// ===========================================================

/**
 * 性別に応じたCSSクラスを取得
 * @param {string} gender - 性別（'male', 'female', 'unknown'）
 * @returns {string} CSSクラス
 */
export function getGenderClass(gender) {
    switch (gender?.toLowerCase()) {
        case 'male':
            return 'gender-male';
        case 'female':
            return 'gender-female';
        default:
            return 'gender-unknown';
    }
}

/**
 * 性別に応じたアイコンクラスを取得
 * @param {string} gender - 性別（'male', 'female', 'unknown'）
 * @returns {string} アイコンクラス
 */
export function getGenderIcon(gender) {
    switch (gender?.toLowerCase()) {
        case 'male':
            return 'fas fa-mars text-primary';
        case 'female':
            return 'fas fa-venus text-danger';
        default:
            return 'fas fa-question-circle text-muted';
    }
}

/**
 * ステータスに応じたアラートクラスを取得
 * @param {string} status - ステータス
 * @returns {string} アラートクラス
 */
export function getStatusAlertClass(status) {
    switch (status) {
        case 'success':
        case 'completed':
            return 'alert-success';
        case 'warning':
        case 'pending':
            return 'alert-warning';
        case 'error':
        case 'failed':
            return 'alert-danger';
        case 'running':
        case 'processing':
            return 'alert-info';
        default:
            return 'alert-secondary';
    }
}

/**
 * 準備完了度に応じたアラートクラスを取得
 * @param {string} status - 準備完了度ステータス
 * @returns {string} アラートクラス
 */
export function getReadinessAlertClass(status) {
    switch (status) {
        case 'ready':
            return 'alert-success';
        case 'partial':
            return 'alert-warning';
        case 'not_ready':
            return 'alert-danger';
        default:
            return 'alert-secondary';
    }
}

// ===========================================================
// システム初期化
// ===========================================================

// DOMロード時の初期化
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // グローバル関数として公開
        window.showLoading = showLoading;
        window.hideLoading = hideLoading;
        window.showLoadingWithProgress = showLoadingWithProgress;
        window.updateLoadingProgress = updateLoadingProgress;
        window.showSuccessMessage = showSuccessMessage;
        window.showErrorMessage = showErrorMessage;
        window.showWarningMessage = showWarningMessage;
        window.showInfoMessage = showInfoMessage;
    });
}