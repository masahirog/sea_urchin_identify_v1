/**
 * ウニ生殖乳頭分析システム - システム全体の共通機能
 * システム状態監視、通知、ローディング表示などの機能を提供
 */

/**
 * システム状態監視クラス
 * ナビゲーションのステータス表示と通知を管理
 */
class SystemStatusMonitor {
    constructor() {
        this.updateInterval = 30000; // 30秒間隔
        this.statusElement = document.getElementById('system-status');
        this.badgeElement = document.getElementById('learning-status-badge');
        this.notificationArea = document.getElementById('system-notifications');
        this.yoloBadgeElement = document.getElementById('yolo-status-badge');
        
        this.startMonitoring();
    }
    
    async startMonitoring() {
        await this.updateStatus();
        setInterval(() => this.updateStatus(), this.updateInterval);
    }
    
    async updateStatus() {
        try {
            const response = await fetch('/api/system-status');
            if (!response.ok) throw new Error('ステータス取得失敗');
            
            const status = await response.json();
            this.updateStatusDisplay(status);
            this.updateLearningBadge(status);
            this.updateYoloBadge(status);
            
            // トースト通知（必要な場合のみ）
            this.showNotifications(status);
            
        } catch (error) {
            console.error('システム状態監視エラー:', error);
            this.showOfflineStatus();
        }
    }
    
    updateStatusDisplay(status) {
        if (!this.statusElement) return;
        
        const isHealthy = status.system?.status === 'healthy';
        const hasActiveTasks = status.tasks?.active > 0;
        
        if (hasActiveTasks) {
            this.statusElement.innerHTML = `
                <i class="fas fa-sync fa-spin text-warning me-1"></i>
                処理中 (${status.tasks.active}件)
            `;
        } else if (isHealthy) {
            this.statusElement.innerHTML = `
                <i class="fas fa-circle text-success me-1"></i>
                システム正常
            `;
        } else {
            this.statusElement.innerHTML = `
                <i class="fas fa-exclamation-triangle text-danger me-1"></i>
                要確認
            `;
        }
    }
    
    updateLearningBadge(status) {
        if (!this.badgeElement) return;
        
        const totalData = status.dataset?.total_count || 0;
        
        if (totalData > 0) {
            this.badgeElement.textContent = totalData;
            this.badgeElement.classList.remove('d-none');
            
            // データ量に応じてバッジ色を変更
            this.badgeElement.className = 'badge ms-1 ' + 
                (totalData >= 20 ? 'bg-success' : 
                 totalData >= 10 ? 'bg-warning' : 'bg-secondary');
        } else {
            this.badgeElement.classList.add('d-none');
        }
    }
    
    updateYoloBadge(status) {
        if (!this.yoloBadgeElement) return;
        
        // YOLOモデル情報を確認
        const hasYoloModel = status.models?.yolo?.exists || false;
        const yoloTrainingActive = status.tasks?.yolo_training_active || false;
        
        if (hasYoloModel || yoloTrainingActive) {
            this.yoloBadgeElement.classList.remove('d-none');
            
            // ステータスに応じてバッジを設定
            if (yoloTrainingActive) {
                this.yoloBadgeElement.className = 'badge ms-1 bg-warning';
                this.yoloBadgeElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.yoloBadgeElement.title = 'YOLOトレーニング実行中';
            } else if (hasYoloModel) {
                this.yoloBadgeElement.className = 'badge ms-1 bg-success';
                this.yoloBadgeElement.innerHTML = '<i class="fas fa-check"></i>';
                this.yoloBadgeElement.title = 'YOLOモデル使用可能';
            }
        } else {
            this.yoloBadgeElement.classList.add('d-none');
        }
    }
    
    showOfflineStatus() {
        if (this.statusElement) {
            this.statusElement.innerHTML = `
                <i class="fas fa-wifi text-muted me-1"></i>
                <span class="text-muted">オフライン</span>
            `;
        }
    }
    
    showNotifications(status) {
        // 通知が必要な場合のみ表示（例：重要なイベントが発生した場合）
        const notifications = status.notifications || [];
        
        notifications.forEach(notification => {
            if (notification.important) {
                showSystemNotification(
                    notification.message,
                    notification.type || 'info',
                    notification.duration || 5000
                );
            }
        });
    }
}

/**
 * グローバル通知を表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 通知タイプ（'info', 'success', 'danger', 'warning'）
 * @param {number} duration - 表示時間（ミリ秒）、0は手動で閉じるまで表示
 */
function showSystemNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('system-notifications');
    if (!container) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    
    // タイプに応じたアイコンを選択
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
    
    // 自動削除
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

/**
 * 進捗付きローディングオーバーレイを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} progress - 進捗（0-100）
 */
function showLoadingWithProgress(message = '処理中...', progress = 0) {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.querySelector('.loading-message');
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');
    
    if (overlay) {
        overlay.classList.remove('d-none');
        if (messageEl) messageEl.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${Math.round(progress)}%`;
        
        // 進捗がない場合はプログレスバーを非表示
        const progressContainer = document.querySelector('.loading-progress');
        if (progressContainer) {
            progressContainer.style.display = progress >= 0 ? 'block' : 'none';
        }
    }
}

/**
 * ローディング進捗を更新
 * @param {number} progress - 進捗（0-100）
 * @param {string} message - 表示するメッセージ（nullの場合は更新しない）
 */
function updateLoadingProgress(progress, message = null) {
    const progressBar = document.getElementById('loading-progress-bar');
    const progressText = document.getElementById('loading-progress-text');
    const messageEl = document.querySelector('.loading-message');
    
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${Math.round(progress)}%`;
    if (message && messageEl) messageEl.textContent = message;
    
    // 進捗バーのアニメーション制御
    if (progressBar) {
        if (progress >= 100) {
            progressBar.classList.remove('progress-bar-animated');
        } else {
            progressBar.classList.add('progress-bar-animated');
        }
    }
}

/**
 * ローディングオーバーレイを表示（進捗なし）
 * @param {string} message - 表示するメッセージ
 */
function showLoading(message = '処理中...') {
    showLoadingWithProgress(message, -1); // -1は進捗バーを非表示にする指示
}

/**
 * ローディングオーバーレイを非表示
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

/**
 * 成功メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showSuccessMessage(message, duration = 3000) {
    showSystemNotification(message, 'success', duration);
}

/**
 * エラーメッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showErrorMessage(message, duration = 5000) {
    showSystemNotification(message, 'danger', duration);
}

/**
 * 警告メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showWarningMessage(message, duration = 4000) {
    showSystemNotification(message, 'warning', duration);
}

/**
 * 情報メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showInfoMessage(message, duration = 3000) {
    showSystemNotification(message, 'info', duration);
}

/**
 * パフォーマンス監視
 * 開発時のみ使用（本番環境では無効化可能）
 */
function monitorPagePerformance() {
    try {
        // パフォーマンスAPIが使用可能かチェック
        if (typeof performance !== 'undefined' && performance.timing) {
            const timing = performance.timing;
            
            // 各タイミングが有効な値かチェック
            if (timing.loadEventEnd > 0 && timing.navigationStart > 0 && 
                timing.loadEventEnd > timing.navigationStart) {
                
                const loadTime = timing.loadEventEnd - timing.navigationStart;
                
                // 異常値のチェック（10秒以上は異常とみなす）
                if (loadTime > 0 && loadTime < 10000) {
                    console.log(`ページロード時間: ${loadTime}ms`);
                    
                    if (loadTime > 3000) {
                        console.warn('ページロードが遅いです。最適化を検討してください。');
                    }
                }
            }
        }
    } catch (error) {
        console.error('パフォーマンス測定エラー:', error);
    }
}

/**
 * 画面サイズに応じたレスポンシブ調整
 */
function adjustResponsiveElements() {
    // モバイルかどうかを判定
    const isMobile = window.innerWidth < 768;
    
    // モバイル向けの調整
    document.body.classList.toggle('mobile-view', isMobile);
    
    // 特定の要素の調整（必要に応じて）
    const elements = document.querySelectorAll('.responsive-element');
    elements.forEach(el => {
        if (isMobile) {
            el.classList.add('mobile');
        } else {
            el.classList.remove('mobile');
        }
    });
}

/**
 * YOLO検出の実行
 * @param {File} imageFile - 画像ファイル
 * @param {number} confidence - 信頼度閾値
 * @returns {Promise<Object>} 検出結果
 */
async function detectWithYolo(imageFile, confidence = 0.25) {
    if (!imageFile) {
        throw new Error('画像が選択されていません');
    }
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('confidence', confidence);
    
    // API呼び出し
    const response = await fetch('/yolo/detect', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * システム共通の初期化処理
 */
function initSystemCommon() {
    // 画面サイズ変更時の処理
    window.addEventListener('resize', adjustResponsiveElements);
    
    // 初回の調整
    adjustResponsiveElements();
    
    // YOLOモデル状態チェック
    checkYoloModelStatus()
        .then(status => {
            // YOLOモデルが利用可能かを更新
            window.hasYoloModel = status.exists;
            
            // UI要素の更新（オプション）
            updateYoloUiVisibility(status.exists);
        })
        .catch(error => {
            console.error('YOLOモデル状態チェックエラー:', error);
        });
}

/**
 * YOLOモデルの状態をチェック
 * @returns {Promise<Object>} モデル状態
 */
async function checkYoloModelStatus() {
    try {
        const response = await fetch('/yolo/model-status');
        if (!response.ok) {
            throw new Error('モデル状態取得に失敗しました');
        }
        
        return await response.json();
    } catch (error) {
        console.error('YOLOモデル状態チェックエラー:', error);
        return { exists: false, message: error.message };
    }
}

/**
 * YOLOモデルの状態に応じてUI要素の表示を更新
 * @param {boolean} modelExists - モデルが存在するかどうか
 */
function updateYoloUiVisibility(modelExists) {
    // YOLOモデル依存の機能の表示・非表示
    const yoloElements = document.querySelectorAll('.yolo-dependent');
    yoloElements.forEach(el => {
        if (modelExists) {
            el.classList.remove('d-none');
            el.classList.remove('disabled');
            if (el.tagName === 'BUTTON') {
                el.disabled = false;
            }
        } else {
            // 非表示または無効化
            if (el.classList.contains('hide-if-no-model')) {
                el.classList.add('d-none');
            } else {
                el.classList.add('disabled');
                if (el.tagName === 'BUTTON') {
                    el.disabled = true;
                }
            }
        }
    });
}

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // システム状態監視を開始
    new SystemStatusMonitor();
    
    // システム共通の初期化
    initSystemCommon();
});

// ページ読み込み完了時のパフォーマンス監視
window.addEventListener('load', monitorPagePerformance);

// グローバル関数のエクスポート
window.showSystemNotification = showSystemNotification;
window.showLoadingWithProgress = showLoadingWithProgress;
window.updateLoadingProgress = updateLoadingProgress;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage;
window.showWarningMessage = showWarningMessage;
window.showInfoMessage = showInfoMessage;
window.detectWithYolo = detectWithYolo;