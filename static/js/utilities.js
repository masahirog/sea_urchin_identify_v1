/**
 * ウニ生殖乳頭分析システム - ユーティリティ関数
 * アプリケーション全体で使用される共通ユーティリティ関数
 */

/**
 * ローディングオーバーレイを表示する
 */
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('d-none');
    }
}

/**
 * ローディングオーバーレイを非表示にする
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

/**
 * Base64エンコードされた画像データのサイズを計算（KB単位）
 * @param {string} base64String - Base64エンコードされた画像データ
 * @returns {string} サイズ（KB単位、小数点以下2桁）
 */
function calculateImageSize(base64String) {
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
 * 日付をフォーマット（YYYY-MM-DD HH:MM:SS）
 * @param {Date} [date=new Date()] - フォーマットする日付
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date) {
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
 * エラーメッセージを表示する
 * @param {string} elementId - メッセージを表示する要素のID
 * @param {string} message - 表示するエラーメッセージ
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i> ${message}
            </div>
        `;
    } else {
        console.error('エラー表示要素が見つかりません:', elementId);
        alert(message);
    }
}

/**
 * 成功メッセージを表示する
 * @param {string} elementId - メッセージを表示する要素のID
 * @param {string} message - 表示する成功メッセージ
 */
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i> ${message}
            </div>
        `;
    } else {
        console.error('成功表示要素が見つかりません:', elementId);
        alert(message);
    }
}

/**
 * URLパラメータを取得する
 * @param {string} name - 取得するパラメータ名
 * @returns {string|null} パラメータの値（存在しない場合はnull）
 */
function getUrlParameter(name) {
    if (!name) return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * セッションストレージに値を保存する
 * @param {string} key - 保存するキー
 * @param {*} value - 保存する値
 * @returns {boolean} 保存の成功/失敗
 */
function saveToSession(key, value) {
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
function getFromSession(key) {
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
 * セッションストレージから値を削除する
 * @param {string} key - 削除するキー
 * @returns {boolean} 削除の成功/失敗
 */
function removeFromSession(key) {
    try {
        if (!key) return false;
        sessionStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('セッションストレージからの削除エラー:', e);
        return false;
    }
}

/**
 * 指定された要素が存在するかチェックする
 * @param {string} elementId - チェックする要素のID
 * @returns {boolean} 要素が存在するかどうか
 */
function elementExists(elementId) {
    return !!document.getElementById(elementId);
}

/**
 * 安全にイベントリスナーを追加する（要素が存在する場合のみ）
 * @param {string} elementId - イベントを追加する要素のID
 * @param {string} eventType - イベントタイプ（'click'など）
 * @param {Function} handler - イベントハンドラ関数
 * @returns {boolean} 追加の成功/失敗
 */
function addSafeEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, handler);
        return true;
    }
    return false;
}


// 画像読み込みエラー処理関数（より堅牢な版）
function handleImageError(imgElement) {
    // 現在のインデックスを取得
    let currentIndex = 0;
    // フォールバック画像パスを収集
    const fallbackPaths = [];
    
    // data-fallback-X属性から全てのフォールバックパスを取得
    for (let i = 0; i < 10; i++) { // 最大10個のフォールバックを試す
        const attr = imgElement.getAttribute(`data-fallback-${i}`);
        if (attr) {
            fallbackPaths.push(attr);
            imgElement.removeAttribute(`data-fallback-${i}`);
        }
    }
    
    if (fallbackPaths.length > 0) {
        // 次のフォールバックを試す
        imgElement.src = fallbackPaths[0];
        
        // 残りのフォールバックを再設定
        fallbackPaths.slice(1).forEach((path, idx) => {
            imgElement.setAttribute(`data-fallback-${idx}`, path);
        });
    } else {
        // 全てのフォールバックが失敗した場合
        const graphType = imgElement.getAttribute('data-graph-type');
        let message = 'グラフが利用できません。学習を実行して評価グラフを生成してください。';
        
        // アノテーション効果グラフの場合は特別なメッセージ
        if (graphType === 'annotation_impact') {
            message = 'アノテーションデータがありません。データにアノテーションを追加すると表示されます。';
        }
        
        imgElement.parentElement.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
}