/**
 * ウニ生殖乳頭分析システム - 共通ユーティリティ関数
 * アプリケーション全体で使用される共通関数
 */

/**
 * ローディングオーバーレイを表示する
 */
export function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('d-none');
    }
}

/**
 * ローディングオーバーレイを非表示にする
 */
export function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

/**
 * 成功メッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} [duration=3000] - 表示時間（ミリ秒）
 */
export function showSuccessMessage(message, duration = 3000) {
    showUserMessage(message, 'success', duration);
}

/**
 * エラーメッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} [duration=5000] - 表示時間（ミリ秒）
 */
export function showErrorMessage(message, duration = 5000) {
    showUserMessage(message, 'danger', duration);
}

/**
 * 警告メッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} [duration=4000] - 表示時間（ミリ秒）
 */
export function showWarningMessage(message, duration = 4000) {
    showUserMessage(message, 'warning', duration);
}

/**
 * ユーザーメッセージの表示
 * @param {string} message - メッセージ
 * @param {string} type - メッセージタイプ（'success', 'danger', 'warning', 'info'）
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showUserMessage(message, type, duration) {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    
    // タイプに応じたアイコンを選択
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'danger' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    alertElement.innerHTML = `
        <i class="fas fa-${icon} me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        
        if (duration > 0) {
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, duration);
        }
    }
}

/**
 * DOM要素のテキストを更新
 * @param {string} elementId - 要素ID
 * @param {*} text - 設定するテキスト
 * @returns {boolean} 成功したかどうか
 */
export function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

/**
 * DOM要素を表示
 * @param {string} elementId - 要素ID
 * @returns {boolean} 成功したかどうか
 */
export function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('d-none');
        return true;
    }
    return false;
}

/**
 * DOM要素を非表示
 * @param {string} elementId - 要素ID
 * @returns {boolean} 成功したかどうか
 */
export function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('d-none');
        return true;
    }
    return false;
}

/**
 * ファイル名を省略表示
 * @param {string} filename - ファイル名
 * @param {number} maxLength - 最大長
 * @returns {string} 省略したファイル名
 */
export function truncateFilename(filename, maxLength = 20) {
    if (!filename || filename.length <= maxLength) return filename;
    const lastDotIndex = filename.lastIndexOf('.');
    const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
    const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
    const availableLength = maxLength - extension.length - 3;
    if (availableLength <= 0) return filename.substring(0, maxLength - 3) + '...';
    return name.substring(0, availableLength) + '...' + extension;
}

/**
 * 性別に応じたクラス名を取得
 * @param {string} category - カテゴリ（'male', 'female', 'unknown'）
 * @returns {string} クラス名
 */
export function getGenderClass(category) {
    switch (category) {
        case 'male': return 'border-primary';
        case 'female': return 'border-danger';
        default: return 'border-secondary';
    }
}

/**
 * 性別に応じたアイコンを取得
 * @param {string} category - カテゴリ（'male', 'female', 'unknown'）
 * @returns {string} アイコンクラス
 */
export function getGenderIcon(category) {
    switch (category) {
        case 'male': return 'fas fa-mars text-primary';
        case 'female': return 'fas fa-venus text-danger';
        default: return 'fas fa-question text-secondary';
    }
}

/**
 * ステータスに応じたアラートクラスを取得
 * @param {string} status - ステータス
 * @returns {string} アラートクラス
 */
export function getStatusAlertClass(status) {
    switch (status) {
        case 'completed':
        case 'success': return 'alert-success';
        case 'failed':
        case 'error': return 'alert-danger';
        case 'warning': return 'alert-warning';
        default: return 'alert-info';
    }
}

/**
 * 準備完了度に応じたアラートクラス取得
 * @param {string} status - 準備状況
 * @returns {string} アラートクラス
 */
export function getReadinessAlertClass(status) {
    switch (status) {
        case 'excellent': return 'alert-success';
        case 'good': return 'alert-info';
        case 'fair': return 'alert-warning';
        default: return 'alert-danger';
    }
}

/**
 * Base64エンコードされた画像データのサイズを計算（KB単位）
 * @param {string} base64String - Base64エンコードされた画像データ
 * @returns {string} サイズ（KB単位、小数点以下2桁）
 */
export function calculateImageSize(base64String) {
    if (!base64String) return '0.00';
    
    // Base64のヘッダー部分を削除
    const base64Data = base64String.includes(',') ? 
        base64String.split(',')[1] : base64String;
    
    // Base64のデータサイズを計算（バイト単位）
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    // KB単位に変換（小数点以下2桁）
    return (sizeInBytes / 1024).toFixed(2);
}

/**
 * セッションストレージに値を保存する
 * @param {string} key - 保存するキー
 * @param {*} value - 保存する値
 * @returns {boolean} 保存の成功/失敗
 */
export function saveToSession(key, value) {
    try {
        if (!key) throw new Error('キーが指定されていません');
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('セッションストレージへの保存エラー:', e);
        return false;
    }
}

/**
 * セッションストレージから値を取得する
 * @param {string} key - 取得するキー
 * @returns {*} 保存されている値（存在しない場合はnull）
 */
export function getFromSession(key) {
    try {
        if (!key) return null;
        const value = sessionStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        console.error('セッションストレージからの取得エラー:', e);
        return null;
    }
}

/**
 * ネストされたオブジェクトから安全に値を取得するヘルパー関数
 * @param {Object} obj - 対象オブジェクト
 * @param {string} path - ドット区切りのパス（例: 'a.b.c'）
 * @returns {*} - 取得した値、存在しない場合はundefined
 */
export function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    
    return current;
}

/**
 * 日付をフォーマット（YYYY-MM-DD HH:MM:SS）
 * @param {Date} [date=new Date()] - フォーマットする日付
 * @returns {string} フォーマットされた日付文字列
 */
export function formatDate(date) {
    const d = date || new Date();
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * URLパラメータを取得する
 * @param {string} name - 取得するパラメータ名
 * @returns {string|null} パラメータの値（存在しない場合はnull）
 */
export function getUrlParameter(name) {
    if (!name) return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * 指定された要素が存在するかチェックする
 * @param {string} elementId - チェックする要素のID
 * @returns {boolean} 要素が存在するかどうか
 */
export function elementExists(elementId) {
    return !!document.getElementById(elementId);
}

/**
 * 安全にイベントリスナーを追加する（要素が存在する場合のみ）
 * @param {string} elementId - イベントを追加する要素のID
 * @param {string} eventType - イベントタイプ（'click'など）
 * @param {Function} handler - イベントハンドラ関数
 * @returns {boolean} 追加の成功/失敗
 */
export function addSafeEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, handler);
        return true;
    }
    return false;
}