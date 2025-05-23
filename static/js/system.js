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
    
    showOfflineStatus() {
        if (this.statusElement) {
            this.statusElement.innerHTML = `
                <i class="fas fa-wifi text-muted me-1"></i>
                <span class="text-muted">オフライン</span>
            `;
        }
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
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alertDiv);
    
    // 自動削除
    if (duration > 0) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
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
}

/**
 * パフォーマンス監視
 * 開発時のみ使用（本番環境では無効化可能）
 */
function monitorPagePerformance() {
    try {
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

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // システム状態監視を開始
    new SystemStatusMonitor();
});

// ページ読み込み完了時のパフォーマンス監視
window.addEventListener('load', monitorPagePerformance);

// グローバル関数のエクスポート
window.showSystemNotification = showSystemNotification;
window.showLoadingWithProgress = showLoadingWithProgress;
window.updateLoadingProgress = updateLoadingProgress;