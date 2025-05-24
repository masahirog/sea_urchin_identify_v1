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

import { YoloAnnotator } from './YoloAnnotator.js';
import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    apiRequest,
    apiRequestFormData
} from '../utilities.js';

/**
 * YOLOトレーニング管理クラス（拡張版）
 */
export class YoloTrainingManager {
    constructor(parent) {
        this.parent = parent;
        this.isTraining = false;
        this.statusCheckInterval = null;
        
        // ワークフロー用の新規プロパティ
        this.workflowMode = false;
        this.currentStep = 1;
        this.uploadedImages = [];
        this.currentImageIndex = 0;
        this.annotations = {};
        this.annotator = null;
    }

    /**
     * 初期化
     */
    initialize() {
        this.setupEventListeners();
        this.checkInitialStatus();
    }
    
    /**
     * ワークフローモードを有効化
     */
    enableWorkflowMode() {
        this.workflowMode = true;
        this.setupWorkflowEventListeners();
        this.updateWorkflowUI();
    }
    
    /**
     * ワークフロー用イベントリスナー設定
     */
    setupWorkflowEventListeners() {
        // 画像アップロードフォーム
        const uploadForm = document.getElementById('imageUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWorkflowImageUpload();
            });
        }
        
        // アノテーション関連ボタン
        document.getElementById('clearAnnotations')?.addEventListener('click', () => this.clearCurrentAnnotations());
        document.getElementById('saveAnnotations')?.addEventListener('click', () => this.saveAndNext());
        
        // クラス選択
        document.querySelectorAll('input[name="classType"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateCurrentClass());
        });
        
        // 既存のstartTrainingボタンはそのまま活用
        const workflowStartBtn = document.getElementById('startTraining');
        if (workflowStartBtn) {
            workflowStartBtn.removeEventListener('click', this.startTraining); // 既存のリスナーを削除
            workflowStartBtn.addEventListener('click', () => this.startWorkflowTraining());
        }
    }
    
    /**
     * ワークフロー用画像アップロード処理
     */
    async handleWorkflowImageUpload() {
        const fileInput = document.getElementById('imageFiles');
        const files = fileInput.files;
        
        if (files.length === 0) {
            showErrorMessage('画像を選択してください');
            return;
        }
        
        try {
            showLoading('画像をアップロード中...');
            
            const formData = new FormData();
            for (let file of files) {
                formData.append('images', file);
            }
            formData.append('gender', 'unknown');
            
            const data = await apiRequestFormData('/learning/upload-data', formData);
            
            hideLoading();
            
            if (data.error) {
                showErrorMessage(data.error);
                return;
            }
            
            this.uploadedImages = data.uploaded_files || [];
            document.getElementById('uploadedCount').textContent = this.uploadedImages.length;
            
            showSuccessMessage(`${this.uploadedImages.length}枚の画像をアップロードしました`);
            
            this.moveToStep(2);
            this.startAnnotation();
            
        } catch (error) {
            hideLoading();
            showErrorMessage('アップロードエラー: ' + error.message);
        }
    }
    
    /**
     * アノテーション開始
     */
    startAnnotation() {
        if (this.uploadedImages.length === 0) return;
        
        this.currentImageIndex = 0;
        this.showAnnotationArea();
        this.loadImageForAnnotation(this.uploadedImages[this.currentImageIndex]);
        this.updateAnnotationProgress();
    }
    
    /**
     * 画像をアノテーション用に読み込み
     */
    async loadImageForAnnotation(imageInfo) {
        const canvas = document.getElementById('annotationCanvas');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            
            this.annotator = new YoloAnnotator(canvas, img);
            this.annotator.setMode('create');
            this.updateCurrentClass();
            
            document.getElementById('currentImageName').textContent = imageInfo.filename;
            
            if (this.annotations[imageInfo.path]) {
                this.annotator.loadAnnotations(this.annotations[imageInfo.path]);
            }
            
            this.updateAnnotationStats();
        };
        
        img.src = `/sample/${imageInfo.path}`;
    }
    
    /**
     * 現在のクラスを更新
     */
    updateCurrentClass() {
        const selectedClass = document.querySelector('input[name="classType"]:checked')?.value;
        if (this.annotator && selectedClass) {
            this.annotator.setCurrentClass(selectedClass === 'male' ? 0 : 1);
        }
    }
    
    /**
     * アノテーション統計を更新
     */
    updateAnnotationStats() {
        if (!this.annotator) return;
        
        let maleCount = 0;
        let femaleCount = 0;
        
        this.annotator.annotations.forEach(ann => {
            if (ann.class === 0) maleCount++;
            else if (ann.class === 1) femaleCount++;
        });
        
        document.getElementById('maleAnnotations').textContent = maleCount;
        document.getElementById('femaleAnnotations').textContent = femaleCount;
    }
    
    /**
     * 現在のアノテーションをクリア
     */
    clearCurrentAnnotations() {
        if (this.annotator) {
            this.annotator.clearAnnotations();
            this.updateAnnotationStats();
        }
    }
    
    /**
     * 保存して次へ
     */
    async saveAndNext() {
        if (!this.annotator || this.annotator.annotations.length === 0) {
            showErrorMessage('アノテーションを追加してください');
            return;
        }
        
        const currentImage = this.uploadedImages[this.currentImageIndex];
        this.annotations[currentImage.path] = this.annotator.annotations;
        
        await this.saveYoloAnnotation(currentImage);
        
        this.currentImageIndex++;
        
        if (this.currentImageIndex < this.uploadedImages.length) {
            this.loadImageForAnnotation(this.uploadedImages[this.currentImageIndex]);
            this.updateAnnotationProgress();
        } else {
            showSuccessMessage('全ての画像のアノテーションが完了しました');
            this.moveToStep(3);
        }
    }
    
    /**
     * YOLOアノテーションを保存
     */
    async saveYoloAnnotation(imageInfo) {
        try {
            const yoloData = this.annotator.exportToYoloFormat();
            
            await apiRequest('/yolo/save-annotation', {
                method: 'POST',
                body: JSON.stringify({
                    image_path: imageInfo.path,
                    yolo_data: yoloData
                })
            });
            
        } catch (error) {
            console.error('YOLOアノテーション保存エラー:', error);
        }
    }
    
    /**
     * アノテーション進捗を更新
     */
    updateAnnotationProgress() {
        const progress = document.getElementById('annotationProgress');
        const progressBar = progress?.querySelector('.progress-bar');
        const progressText = progress?.querySelector('.progress-text');
        
        if (progress) {
            progress.classList.remove('d-none');
            
            const percentage = ((this.currentImageIndex + 1) / this.uploadedImages.length) * 100;
            if (progressBar) {
                progressBar.style.width = percentage + '%';
            }
            if (progressText) {
                progressText.textContent = `${this.currentImageIndex + 1}/${this.uploadedImages.length}`;
            }
        }
    }
    
    /**
     * アノテーションエリアを表示
     */
    showAnnotationArea() {
        document.getElementById('annotationArea')?.classList.remove('d-none');
        document.getElementById('annotationControls')?.classList.remove('d-none');
    }
    
    /**
     * ワークフロー用トレーニング開始
     */
    async startWorkflowTraining() {
        const params = {
            epochs: parseInt(document.getElementById('epochs')?.value) || 100,
            batch_size: parseInt(document.getElementById('batchSize')?.value) || 16,
            weights: document.getElementById('modelSize')?.value || 'yolov5s.pt'
        };
        
        try {
            showLoading('YOLOトレーニングを開始中...');
            
            // データセット準備
            await apiRequest('/yolo/prepare-dataset', {
                method: 'POST'
            });
            
            // 既存のstartTrainingメソッドのロジックを活用
            const data = await this.parent.dataManager.startYoloTraining(params);
            
            hideLoading();
            
            if (data.status === 'success') {
                showSuccessMessage('トレーニングを開始しました');
                this.isTraining = true;
                this.moveToStep(4);
                this.startStatusMonitoring(); // 既存のメソッドを活用
                document.getElementById('trainingProgress')?.classList.remove('d-none');
            } else {
                showErrorMessage(data.message);
            }
            
        } catch (error) {
            hideLoading();
            showErrorMessage('トレーニング開始エラー: ' + error.message);
        }
    }
    
    /**
     * ステップ移動
     */
    moveToStep(stepNumber) {
        this.currentStep = stepNumber;
        this.updateWorkflowUI();
    }
    
    /**
     * ワークフローUIを更新
     */
    updateWorkflowUI() {
        // 全ステップをリセット
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`step-${i}`);
            if (stepEl) {
                stepEl.classList.remove('active', 'completed');
            }
        }
        
        // 完了したステップにマーク
        for (let i = 1; i < this.currentStep; i++) {
            const stepEl = document.getElementById(`step-${i}`);
            if (stepEl) {
                stepEl.classList.add('completed');
            }
        }
        
        // 現在のステップをアクティブに
        const currentStepEl = document.getElementById(`step-${this.currentStep}`);
        if (currentStepEl) {
            currentStepEl.classList.add('active');
        }
        
        // ステップ別の表示制御
        if (this.currentStep >= 3) {
            document.getElementById('trainingConfig')?.classList.remove('d-none');
        }
        
        if (this.currentStep === 4) {
            // 既存のupdateTrainingStatusメソッドを活用して結果表示
            this.showWorkflowResults();
        }
    }
    
    /**
     * ワークフロー結果表示
     */
    async showWorkflowResults() {
        document.getElementById('trainingResults')?.classList.remove('d-none');
        
        // 既存のステータス更新メカニズムを活用
        // updateTrainingStatusが自動的に結果を更新する
    }
    
    // 既存のupdateTrainingStatusメソッドをオーバーライド
    async updateTrainingStatus() {
        try {
            const status = await this.parent.dataManager.checkYoloTrainingStatus();
            
            // 既存の更新処理
            this.updateStatusDisplay(status);
            this.updateProgressDisplay(status);
            this.updateMetricsDisplay(status);
            this.updateTrainingImages(status.result_images || {});
            
            // ワークフローモードの場合の追加処理
            if (this.workflowMode && this.currentStep === 4) {
                // トレーニング進捗をワークフローUIに反映
                const progressBar = document.querySelector('#trainingProgress .progress-bar');
                const statusText = document.getElementById('trainingStatus');
                
                if (progressBar) {
                    const progress = (status.progress || 0) * 100;
                    progressBar.style.width = progress + '%';
                    progressBar.textContent = Math.round(progress) + '%';
                }
                
                if (statusText) {
                    statusText.textContent = status.message || 'トレーニング中...';
                }
                
                // 完了時の処理
                if (status.status === 'completed') {
                    await this.displayWorkflowFinalResults();
                }
            }
            
            // 元の処理を継続
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
     * ワークフロー最終結果表示
     */
    async displayWorkflowFinalResults() {
        try {
            const results = await apiRequest('/yolo/training/results');
            
            document.getElementById('accuracy').textContent = 
                results.accuracy ? (results.accuracy * 100).toFixed(1) + '%' : '-';
            document.getElementById('mAP').textContent = 
                results.mAP ? results.mAP.toFixed(3) : '-';
            document.getElementById('totalImages').textContent = 
                this.uploadedImages.length;
            document.getElementById('trainingTime').textContent = 
                results.training_time || '-';
                
        } catch (error) {
            console.error('結果取得エラー:', error);
        }
    }
}

export default YoloTrainingManager;