/**
 * ウニ生殖乳頭分析システム - YOLOトレーニング管理
 * YOLO学習機能の管理を担当
 */

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    apiRequest
} from '../utilities.js';

/**
 * YOLOトレーニング管理クラス
 */
export class YoloTrainingManager {
    constructor(parent) {
        this.parent = parent;
        this.isTraining = false;
        this.statusCheckInterval = null;
    }

    /**
     * 初期化
     */
    initialize() {
        this.setupEventListeners();
        this.checkInitialStatus();
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // データセット準備ボタン
        const prepareBtn = document.getElementById('prepare-dataset-btn');
        if (prepareBtn) {
            prepareBtn.addEventListener('click', () => this.prepareDataset());
        }
        
        // トレーニング開始ボタン
        const startBtn = document.getElementById('start-yolo-training-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startTraining());
        }
        
        // トレーニング停止ボタン
        const stopBtn = document.getElementById('stop-yolo-training-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopTraining());
        }
    }

    /**
     * 初期状態チェック
     */
    async checkInitialStatus() {
        try {
            await this.updateTrainingStatus();
            
            // 定期的な状態更新を開始
            this.startStatusMonitoring();
        } catch (error) {
            console.error('YOLO状態チェックエラー:', error);
        }
    }

    /**
     * データセット準備
     */
    async prepareDataset() {
        try {
            showLoading('データセットを準備中...');
            
            const data = await apiRequest('/yolo/prepare-dataset', {
                method: 'POST'
            });
            
            hideLoading();
            
            if (data.status === 'success') {
                showSuccessMessage(`データセットを準備しました (訓練: ${data.train_count}枚, 検証: ${data.val_count}枚)`);
                
                // データセット統計を更新
                if (this.parent.dataManager) {
                    await this.parent.dataManager.checkYoloDatasetStatus();
                }
            } else {
                showErrorMessage(`データセット準備エラー: ${data.message}`);
            }
        } catch (error) {
            hideLoading();
            showErrorMessage(`データセット準備中にエラーが発生しました: ${error.message}`);
        }
    }

    /**
     * トレーニング開始
     */
    async startTraining() {
        try {
            const params = this.getTrainingParameters();
            
            if (!this.validateParameters(params)) {
                return;
            }
            
            showLoading('トレーニングを開始中...');
            
            const data = await this.parent.dataManager.startYoloTraining(params);
            
            hideLoading();
            
            if (data.status === 'success') {
                showSuccessMessage(data.message);
                this.isTraining = true;
                this.enableTrainingUI();
            } else {
                showErrorMessage(`トレーニング開始エラー: ${data.message}`);
            }
        } catch (error) {
            hideLoading();
            showErrorMessage(`トレーニング開始中にエラーが発生しました: ${error.message}`);
        }
    }

    /**
     * トレーニング停止
     */
    async stopTraining() {
        if (!confirm('トレーニングを停止しますか？再開はできません。')) {
            return;
        }
        
        try {
            showLoading('トレーニングを停止中...');
            
            const data = await apiRequest('/yolo/training/stop', {
                method: 'POST'
            });
            
            hideLoading();
            
            if (data.status === 'success') {
                showSuccessMessage(data.message);
                this.isTraining = false;
                this.disableTrainingUI();
            } else {
                showErrorMessage(`トレーニング停止エラー: ${data.message}`);
            }
        } catch (error) {
            hideLoading();
            showErrorMessage(`トレーニング停止中にエラーが発生しました: ${error.message}`);
        }
    }

    /**
     * トレーニングパラメータ取得
     */
    getTrainingParameters() {
        return {
            weights: document.getElementById('yolo-weights')?.value || 'yolov5s.pt',
            batch_size: parseInt(document.getElementById('yolo-batch-size')?.value) || 16,
            epochs: parseInt(document.getElementById('yolo-epochs')?.value) || 100,
            img_size: parseInt(document.getElementById('yolo-img-size')?.value) || 640
        };
    }

    /**
     * パラメータ検証
     */
    validateParameters(params) {
        if (isNaN(params.batch_size) || params.batch_size < 1) {
            showErrorMessage('バッチサイズは1以上の数値を入力してください');
            return false;
        }
        
        if (isNaN(params.epochs) || params.epochs < 1) {
            showErrorMessage('エポック数は1以上の数値を入力してください');
            return false;
        }
        
        return true;
    }

    /**
     * 状態監視開始
     */
    startStatusMonitoring() {
        // 既存の監視を停止
        this.stopStatusMonitoring();
        
        // 3秒間隔で状態更新
        this.statusCheckInterval = setInterval(() => {
            this.updateTrainingStatus();
        }, 3000);
    }

    /**
     * 状態監視停止
     */
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    /**
     * トレーニング状態更新
     */
    async updateTrainingStatus() {
        try {
            const status = await this.parent.dataManager.checkYoloTrainingStatus();
            
            this.updateStatusDisplay(status);
            this.updateProgressDisplay(status);
            this.updateMetricsDisplay(status);
            this.updateTrainingImages(status.result_images || {});
            
            // 完了または失敗時の処理
            if (['completed', 'stopped', 'failed', 'error'].includes(status.status)) {
                this.isTraining = false;
                this.disableTrainingUI();
            } else if (status.status === 'running') {
                this.isTraining = true;
                this.enableTrainingUI();
            }
        } catch (error) {
            console.error('トレーニング状態取得エラー:', error);
        }
    }

    /**
     * 状態表示更新
     */
    updateStatusDisplay(status) {
        const statusElement = document.getElementById('yolo-training-status');
        if (!statusElement) return;
        
        const statusMessages = {
            'running': 'トレーニング実行中',
            'completed': 'トレーニング完了',
            'stopped': 'トレーニング停止',
            'failed': 'トレーニング失敗',
            'error': 'エラー発生',
            'not_started': 'トレーニング未開始'
        };
        
        const alertClasses = {
            'running': 'alert-primary',
            'completed': 'alert-success',
            'stopped': 'alert-warning',
            'failed': 'alert-danger',
            'error': 'alert-danger',
            'not_started': 'alert-secondary'
        };
        
        statusElement.className = `alert ${alertClasses[status.status] || 'alert-secondary'}`;
        statusElement.textContent = status.message || statusMessages[status.status] || '状態不明';
    }

    /**
     * 進捗表示更新
     */
    updateProgressDisplay(status) {
        const progressBar = document.getElementById('yolo-progress-bar');
        const progressContainer = document.getElementById('yolo-progress-container');
        const statusText = document.getElementById('yolo-status-text');
        
        if (progressBar && progressContainer) {
            if (status.status !== 'not_started') {
                progressContainer.style.display = 'block';
                progressBar.style.width = `${status.progress || 0}%`;
                progressBar.textContent = `${status.progress || 0}%`;
            } else {
                progressContainer.style.display = 'none';
            }
        }
        
        if (statusText) {
            statusText.textContent = status.message || '';
        }
        
        // 詳細情報更新
        this.updateElement('yolo-elapsed-time', status.elapsed_time || '-');
        this.updateElement('yolo-current-epoch', status.current_epoch || '-');
        this.updateElement('yolo-total-epochs', status.total_epochs || '-');
    }

    /**
     * メトリクス表示更新
     */
    updateMetricsDisplay(status) {
        const metrics = status.metrics || {};
        
        if (metrics.box_loss?.length > 0) {
            this.updateElement('yolo-box-loss', metrics.box_loss[metrics.box_loss.length - 1].toFixed(4));
        }
        
        if (metrics.obj_loss?.length > 0) {
            this.updateElement('yolo-obj-loss', metrics.obj_loss[metrics.obj_loss.length - 1].toFixed(4));
        }
        
        if (metrics.mAP50?.length > 0) {
            this.updateElement('yolo-map50', metrics.mAP50[metrics.mAP50.length - 1].toFixed(4));
        }
    }

    /**
     * トレーニング画像更新
     */
    updateTrainingImages(images) {
        const container = document.getElementById('yolo-training-images');
        if (!container) return;
        
        if (Object.keys(images).length === 0) {
            container.innerHTML = '<p class="text-muted text-center">トレーニング画像はまだありません</p>';
            return;
        }
        
        const imageTypes = [
            { key: 'train_batch', title: 'トレーニングバッチ' },
            { key: 'labels', title: 'ラベル分布' },
            { key: 'results', title: '学習曲線' },
            { key: 'confusion_matrix', title: '混同行列' }
        ];
        
        let html = '';
        imageTypes.forEach(({ key, title }) => {
            if (images[key]) {
                html += `
                    <div class="mb-3">
                        <h6>${title}:</h6>
                        <img src="${images[key]}" alt="${title}" class="img-fluid rounded">
                    </div>
                `;
            }
        });
        
        container.innerHTML = html;
    }

    /**
     * トレーニングUI有効化
     */
    enableTrainingUI() {
        const startBtn = document.getElementById('start-yolo-training-btn');
        const stopBtn = document.getElementById('stop-yolo-training-btn');
        
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
    }

    /**
     * トレーニングUI無効化
     */
    disableTrainingUI() {
        const startBtn = document.getElementById('start-yolo-training-btn');
        const stopBtn = document.getElementById('stop-yolo-training-btn');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    }

    /**
     * 要素のテキスト更新
     */
    updateElement(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }
}

export default YoloTrainingManager;