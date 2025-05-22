/**
 * ウニ生殖乳頭分析システム - 評価共通ユーティリティ
 * 評価機能で使用される共通関数とヘルパー関数
 */

/**
 * 評価ステータスの更新
 * @param {string} elementId - ステータス要素のID
 * @param {string} alertClass - アラートのクラス
 * @param {string} message - 表示するメッセージ
 */
function updateEvaluationStatus(elementId, alertClass, message) {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) return;
    
    statusElement.classList.remove('d-none');
    statusElement.className = 'alert ' + alertClass;
    statusElement.textContent = message;
}

/**
 * プログレスバーの表示
 * @param {string} containerId - プログレスバーコンテナのID
 * @param {string} barId - プログレスバー要素のID
 * @param {number} progress - 進捗値（0-100）
 */
function showProgressBar(containerId, barId, progress) {
    const container = document.getElementById(containerId);
    const bar = document.getElementById(barId);
    
    if (!container || !bar) return;
    
    container.classList.remove('d-none');
    updateProgressBar(barId, progress);
}

/**
 * プログレスバーの更新
 * @param {string} barId - プログレスバー要素のID
 * @param {number} progress - 進捗値（0-100）
 */
function updateProgressBar(barId, progress) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    
    bar.style.width = progress + '%';
    bar.textContent = Math.round(progress) + '%';
}

/**
 * 成功メッセージの表示
 * @param {string} message - 表示するメッセージ
 */
function showSuccessMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-success alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        <i class="fas fa-check-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        
        // 自動的に閉じる
        setTimeout(() => {
            try {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            } catch (e) {
                // フォールバック（Bootstrapが使えない場合）
                alertElement.remove();
            }
        }, 5000);
    }
}

/**
 * エラーメッセージの表示
 * @param {string} message - 表示するメッセージ
 */
function showErrorMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        
        // 自動的に閉じる
        setTimeout(() => {
            try {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            } catch (e) {
                // フォールバック
                alertElement.remove();
            }
        }, 5000);
    }
}

/**
 * 指定されたIDの要素にメトリクスの値を設定する
 * @param {string} elementId - 要素ID
 * @param {number} value - 設定する値
 * @param {boolean} isPercent - パーセント表示するかどうか（デフォルト: true）
 */
function setMetricText(elementId, value, isPercent = true) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (value === undefined || value === null) {
        element.textContent = 'N/A';
    } else {
        if (isPercent) {
            element.textContent = (value * 100).toFixed(1) + '%';
        } else {
            element.textContent = value;
        }
    }
}

/**
 * 要素にテキストを設定
 * @param {string} elementId - 要素ID
 * @param {string|number} text - 設定するテキスト
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * 画像を設定し、読み込みエラーの場合はフォールバック表示する
 * @param {string} imageId - 画像要素ID
 * @param {string} src - 画像URL
 */
function setImageWithFallback(imageId, src) {
    const imageElement = document.getElementById(imageId);
    if (!imageElement) return;
   
    // 元のエラーハンドラを保持
    const originalOnerror = imageElement.onerror;
   
    // エラーハンドラを設定
    imageElement.onerror = function() {
        // 画像が読み込めない場合は代替テキストとスタイルを設定
        this.style.backgroundColor = '#f8f9fa';
        this.style.padding = '20px';
        this.style.border = '1px solid #dee2e6';
        this.style.borderRadius = '4px';
        this.alt = 'グラフは利用できません';
       
        // 画像の代わりに表示するテキスト要素を作成
        const parentElement = this.parentElement;
        if (parentElement) {
            // 既存の画像を非表示
            this.style.display = 'none';
           
            // プレースホルダーDiv作成（存在しない場合のみ）
            if (!parentElement.querySelector('.image-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder text-center p-4 bg-light border rounded';
                placeholder.innerHTML = `
                    <i class="fas fa-image text-muted mb-2" style="font-size: 2rem;"></i>
                    <p class="mb-0 text-muted">グラフデータはありません</p>
                `;
                parentElement.appendChild(placeholder);
            }
        }
       
        // 元のエラーハンドラを呼び出す
        if (originalOnerror) originalOnerror.call(this);
    };
   
    // 新しいURLを設定
    imageElement.src = src;
}

/**
 * 評価タイムスタンプを日付形式に変換
 * @param {string} timestamp - YYYYMMdd_HHmmss形式のタイムスタンプ
 * @returns {string} フォーマットされた日付文字列
 */
function formatEvaluationDate(timestamp) {
    if (!timestamp || timestamp.length < 15) return 'Invalid date';
    
    try {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = timestamp.substring(9, 11);
        const minute = timestamp.substring(11, 13);
        const second = timestamp.substring(13, 15);
        
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        return date.toLocaleString();
    } catch (e) {
        console.error('日付変換エラー:', e);
        return timestamp;
    }
}