/**
 * ウニ生殖乳頭分析システム - ユーティリティ関数
 * 共通で使用する便利な関数を集めたファイル
 */

// ローディングオーバーレイの表示
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('d-none');
}

// ローディングオーバーレイの非表示
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
}

// Base64エンコードされた画像データのサイズを計算（KB単位）
function calculateImageSize(base64String) {
    // Base64のヘッダー部分を削除
    const base64Data = base64String.split(',')[1];
    // Base64のデータサイズを計算（バイト単位）
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    // KB単位に変換（小数点以下2桁）
    return (sizeInBytes / 1024).toFixed(2);
}

// 日付をフォーマット（YYYY-MM-DD HH:MM:SS）
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

// エラーメッセージの表示
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

// 成功メッセージの表示
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

// URLパラメータの取得
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// セッションストレージに値を保存
function saveToSession(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('セッションストレージへの保存エラー:', e);
        return false;
    }
}

// セッションストレージから値を取得
function getFromSession(key) {
    try {
        const value = sessionStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        console.error('セッションストレージからの取得エラー:', e);
        return null;
    }
}

// セッションストレージから値を削除
function removeFromSession(key) {
    try {
        sessionStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('セッションストレージからの削除エラー:', e);
        return false;
    }
}