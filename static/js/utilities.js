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
 * 成功メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
export function showSuccessMessage(message, duration = 3000) {
    showSystemNotification(message, 'success', duration);
}

/**
 * エラーメッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
export function showErrorMessage(message, duration = 5000) {
    showSystemNotification(message, 'danger', duration);
}

/**
 * 警告メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
export function showWarningMessage(message, duration = 4000) {
    showSystemNotification(message, 'warning', duration);
}

/**
 * 情報メッセージを表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（ミリ秒）
 */
export function showInfoMessage(message, duration = 3000) {
    showSystemNotification(message, 'info', duration);
}

// ===========================================================
// ローディング表示ユーティリティ
// ===========================================================

/**
 * ローディングオーバーレイを表示（進捗なし）
 * @param {string} message - 表示するメッセージ
 */
export function showLoading(message = '処理中...') {
    showLoadingWithProgress(message, -1); // -1は進捗バーを非表示にする指示
}

/**
 * ローディングオーバーレイを非表示
 */
export function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

/**
 * 進捗付きローディングオーバーレイを表示
 * @param {string} message - 表示するメッセージ
 * @param {number} progress - 進捗（0-100）
 */
export function showLoadingWithProgress(message = '処理中...', progress = 0) {
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
export function updateLoadingProgress(progress, message = null) {
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

// ===========================================================
// セッション・ローカルストレージユーティリティ
// ===========================================================

/**
 * セッションストレージにデータを保存
 * @param {string} key - キー
 * @param {any} value - 値
 */
export function saveToSession(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('セッションストレージ保存エラー:', e);
    }
}

/**
 * セッションストレージからデータを取得
 * @param {string} key - キー
 * @param {any} defaultValue - デフォルト値
 * @returns {any} 取得した値、存在しない場合はデフォルト値
 */
export function getFromSession(key, defaultValue = null) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('セッションストレージ取得エラー:', e);
        return defaultValue;
    }
}

/**
 * ローカルストレージにデータを保存
 * @param {string} key - キー
 * @param {any} value - 値
 */
export function saveToLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('ローカルストレージ保存エラー:', e);
    }
}

/**
 * ローカルストレージからデータを取得
 * @param {string} key - キー
 * @param {any} defaultValue - デフォルト値
 * @returns {any} 取得した値、存在しない場合はデフォルト値
 */
export function getFromLocal(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('ローカルストレージ取得エラー:', e);
        return defaultValue;
    }
}

// ===========================================================
// データ操作ユーティリティ
// ===========================================================

/**
 * 画像をBase64形式からサイズ（バイト数）を計算
 * @param {string} base64String - Base64形式の画像データ
 * @returns {number} サイズ（バイト数）
 */
export function calculateImageSize(base64String) {
    if (!base64String) return 0;
    
    // Base64文字列からヘッダを除去
    const base64 = base64String.split(',')[1] || base64String;
    
    // Base64文字列のバイト数を計算
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return (base64.length * 3 / 4) - padding;
}

/**
 * ネストされたオブジェクトから安全に値を取得
 * @param {Object} obj - 対象オブジェクト
 * @param {string} path - ドット区切りのパス
 * @param {any} defaultValue - デフォルト値
 * @returns {any} 取得した値、存在しない場合はデフォルト値
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
// YOLOバウンディングボックス操作ユーティリティ
// ===========================================================

/**
 * YOLOバウンディングボックスをXY座標に変換
 * @param {Object} yoloBox - YOLO形式のバウンディングボックス（中心x, 中心y, 幅, 高さ）
 * @param {number} imgWidth - 画像の幅
 * @param {number} imgHeight - 画像の高さ
 * @returns {Object} X1Y1X2Y2形式のバウンディングボックス
 */
export function yoloToXY(yoloBox, imgWidth, imgHeight) {
    const [centerX, centerY, width, height] = yoloBox;
    
    // 中心座標と幅・高さを実際のピクセル値に変換
    const x_center = centerX * imgWidth;
    const y_center = centerY * imgHeight;
    const w = width * imgWidth;
    const h = height * imgHeight;
    
    // 左上と右下の座標を計算
    return {
        x1: Math.max(0, x_center - w / 2),
        y1: Math.max(0, y_center - h / 2),
        x2: Math.min(imgWidth, x_center + w / 2),
        y2: Math.min(imgHeight, y_center + h / 2)
    };
}

/**
 * XY座標をYOLOバウンディングボックスに変換
 * @param {Object} xyBox - X1Y1X2Y2形式のバウンディングボックス
 * @param {number} imgWidth - 画像の幅
 * @param {number} imgHeight - 画像の高さ
 * @returns {Array} YOLO形式のバウンディングボックス（中心x, 中心y, 幅, 高さ）
 */
export function xyToYolo(xyBox, imgWidth, imgHeight) {
    const { x1, y1, x2, y2 } = xyBox;
    
    // 中心座標と幅・高さを計算
    const width = (x2 - x1) / imgWidth;
    const height = (y2 - y1) / imgHeight;
    const centerX = (x1 + (x2 - x1) / 2) / imgWidth;
    const centerY = (y1 + (y2 - y1) / 2) / imgHeight;
    
    return [centerX, centerY, width, height];
}

/**
 * YOLOフォーマットの文字列を解析
 * @param {string} yoloStr - YOLO形式の文字列（"class_id center_x center_y width height"）
 * @returns {Object} 解析されたオブジェクト
 */
export function parseYoloFormat(yoloStr) {
    const parts = yoloStr.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error('不正なYOLO形式文字列です');
    }
    
    return {
        classId: parseInt(parts[0]),
        centerX: parseFloat(parts[1]),
        centerY: parseFloat(parts[2]),
        width: parseFloat(parts[3]),
        height: parseFloat(parts[4])
    };
}

/**
 * YOLOフォーマットの文字列を生成
 * @param {number} classId - クラスID
 * @param {number} centerX - 中心X座標（0-1）
 * @param {number} centerY - 中心Y座標（0-1）
 * @param {number} width - 幅（0-1）
 * @param {number} height - 高さ（0-1）
 * @returns {string} YOLO形式の文字列
 */
export function formatYolo(classId, centerX, centerY, width, height) {
    return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
}

/**
 * バウンディングボックスのIoU（Intersection over Union）を計算
 * @param {Object} box1 - 1つ目のバウンディングボックス（x1, y1, x2, y2）
 * @param {Object} box2 - 2つ目のバウンディングボックス（x1, y1, x2, y2）
 * @returns {number} IoU値（0-1）
 */
export function calculateIoU(box1, box2) {
    // 交差領域の計算
    const xOverlap = Math.max(0, Math.min(box1.x2, box2.x2) - Math.max(box1.x1, box2.x1));
    const yOverlap = Math.max(0, Math.min(box1.y2, box2.y2) - Math.max(box1.y1, box2.y1));
    const intersectionArea = xOverlap * yOverlap;
    
    // 各ボックスの面積
    const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
    const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
    
    // 合併領域の計算
    const unionArea = box1Area + box2Area - intersectionArea;
    
    // IoUの計算
    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * 検出結果の信頼度に基づく色を取得
 * @param {number} confidence - 信頼度（0-1）
 * @returns {string} 色のRGBA文字列
 */
export function getConfidenceColor(confidence) {
    if (confidence >= 0.7) {
        return 'rgba(40, 167, 69, 0.7)'; // 緑（高信頼度）
    } else if (confidence >= 0.5) {
        return 'rgba(255, 193, 7, 0.7)'; // 黄色（中信頼度）
    } else {
        return 'rgba(220, 53, 69, 0.7)'; // 赤（低信頼度）
    }
}

/**
 * ランダムなRGB色を生成
 * @param {number} alpha - 不透明度（0-1）
 * @returns {string} RGBA文字列
 */
export function getRandomColor(alpha = 0.7) {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ===========================================================
// YOLO関連API通信ユーティリティ
// ===========================================================

/**
 * YOLOデータセットの準備状況を確認
 * @returns {Promise<Object>} データセット情報
 */
export async function checkYoloDatasetStatus() {
    try {
        const response = await fetch('/yolo/dataset-status');
        if (!response.ok) throw new Error('データセット状態の取得に失敗しました');
        
        return await response.json();
    } catch (error) {
        console.error('YOLOデータセット確認エラー:', error);
        return {
            status: 'error',
            message: error.message,
            images: { train: 0, val: 0 },
            labels: { train: 0, val: 0 }
        };
    }
}

/**
 * YOLO検出の実行
 * @param {File} imageFile - 画像ファイル
 * @param {number} confidence - 信頼度閾値
 * @returns {Promise<Object>} 検出結果
 */
export async function detectWithYolo(imageFile, confidence = 0.25) {
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

// ===========================================================
// システム状態モニタリング
// ===========================================================

/**
 * システム状態監視クラス
 * ナビゲーションのステータス表示と通知を管理
 */
export class SystemStatusMonitor {
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

// ===========================================================
// パフォーマンスモニタリング
// ===========================================================

/**
 * パフォーマンス監視
 * 開発時のみ使用（本番環境では無効化可能）
 */
export function monitorPagePerformance() {
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
export function adjustResponsiveElements() {
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

// ===========================================================
// システム初期化
// ===========================================================

/**
 * YOLOモデルの状態をチェック
 * @returns {Promise<Object>} モデル状態
 */
export async function checkYoloModelStatus() {
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
export function updateYoloUiVisibility(modelExists) {
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

/**
 * システム共通の初期化処理
 */
export function initSystemCommon() {
    // 画面サイズ変更時の処理
    window.addEventListener('resize', adjustResponsiveElements);
    
    // 初回の調整
    adjustResponsiveElements();
    
    // YOLOモデル状態チェック
    checkYoloModelStatus()
        .then(status => {
            // YOLOモデルが利用可能かを更新
            window.hasYoloModel = status.exists;
            
            // UI要素の更新
            updateYoloUiVisibility(status.exists);
        })
        .catch(error => {
            console.error('YOLOモデル状態チェックエラー:', error);
        });
}

// グローバル関数として公開（旧サポート用）
if (typeof window !== 'undefined') {
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
}

// DOMロード時の初期化
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // システム状態監視を開始
        new SystemStatusMonitor();
        
        // システム共通の初期化
        initSystemCommon();
    });

    // ページ読み込み完了時のパフォーマンス監視
    window.addEventListener('load', monitorPagePerformance);
}