/**
 * ウニ生殖乳頭分析システム - UIマネージャー
 * UI表示に関する処理を集約
 */

import {
    showSuccessMessage,
    showErrorMessage,
    showWarningMessage,
    showInfoMessage,
    setElementText,
    showElement,
    hideElement,
    getGenderClass,
    getGenderIcon,
    truncateFilename,
    getStatusAlertClass,
    getReadinessAlertClass
} from '../utilities.js';

/**
 * UIマネージャークラス
 * UI要素の更新を担当
 */
export class UIManager {
    /**
     * コンストラクタ
     * @param {Object} parent - 親クラス（UnifiedLearningSystem）への参照
     */
    constructor(parent) {
        this.parent = parent;
        this.isMobile = window.innerWidth < 768;
        
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth < 768;
            
            if (wasMobile !== this.isMobile) {
                this.adjustLayoutForViewport();
            }
        });
    }

    /**
     * UI初期化
     */
    initializeUI() {
        this.updatePhaseDisplay();
        
        showElement('data-preparation-section');
        hideElement('training-section');
        hideElement('analysis-section');
        showElement('results-placeholder');
        
        this.initYoloUI();
        this.adjustLayoutForViewport();
    }
    
    /**
     * YOLO関連UIの初期化
     */
    initYoloUI() {
        const yoloSection = document.getElementById('yolo-training-section');
        if (yoloSection) {
            const batchSizeInput = document.getElementById('yolo-batch-size');
            if (batchSizeInput) {
                batchSizeInput.value = this.isMobile ? '8' : '16';
            }
            
            hideElement('yolo-results-section');
        }
    }
    
    /**
     * ビューポートに応じたレイアウト調整
     */
    adjustLayoutForViewport() {
        if (this.isMobile) {
            document.querySelectorAll('.image-card').forEach(card => {
                card.style.maxWidth = '100%';
            });
            
            document.querySelectorAll('.card-body').forEach(body => {
                body.classList.add('p-2');
            });
            
            document.querySelectorAll('.metric-card').forEach(card => {
                card.style.padding = '0.5rem';
            });
        } else {
            document.querySelectorAll('.image-card').forEach(card => {
                card.style.maxWidth = '';
            });
            
            document.querySelectorAll('.card-body').forEach(body => {
                body.classList.remove('p-2');
            });
            
            document.querySelectorAll('.metric-card').forEach(card => {
                card.style.padding = '1rem';
            });
        }
    }

    /**
     * フェーズ表示の更新
     */
    updatePhaseDisplay() {
        Object.keys(this.parent.phases).forEach(phase => {
            const element = document.getElementById(`phase-${phase}`);
            if (element) {
                element.classList.remove('active', 'current-phase', 'completed');
                
                if (phase === this.parent.currentPhase) {
                    element.classList.add('current-phase');
                } else if (this.isPhaseCompleted(phase)) {
                    element.classList.add('completed');
                }
                
                element.style.opacity = '1';
                element.style.pointerEvents = 'auto';
                
                const progressDot = element.querySelector('.progress-dot');
                if (progressDot) {
                    progressDot.classList.remove('active');
                    if (phase === this.parent.currentPhase || this.isPhaseCompleted(phase)) {
                        progressDot.classList.add('active');
                    }
                }
            }
        });
        
        this.showPhaseSection();
    }

    /**
     * フェーズが完了しているかチェック
     * @param {string} phase - チェックするフェーズ名
     * @returns {boolean} 完了しているかどうか
     */
    isPhaseCompleted(phase) {
        switch (phase) {
            case 'preparation':
                const total = (this.parent.datasetStats.male_count || 0) + (this.parent.datasetStats.female_count || 0);
                return total >= 1;
            case 'training':
                return this.parent.learningResults != null;
            case 'analysis':
                return false;
            default:
                return false;
        }
    }

    /**
     * フェーズセクション表示
     */
    showPhaseSection() {
        ['data-preparation-section', 'training-section', 'analysis-section'].forEach(sectionId => {
            hideElement(sectionId);
        });
        
        let sectionId;
        switch (this.parent.currentPhase) {
            case 'training':
                sectionId = 'training-section';
                break;
            case 'analysis':
                sectionId = 'analysis-section';
                break;
            default:
                sectionId = 'data-preparation-section';
                break;
        }
        
        showElement(sectionId);
        
        if (this.parent.currentPhase === 'analysis' && this.parent.learningResults) {
            hideElement('results-placeholder');
        } else if (this.parent.currentPhase !== 'analysis') {
            showElement('results-placeholder');
        }
    }

    /**
     * データセット統計表示の更新
     */
    updateDatasetStatsDisplay() {
        const stats = this.parent.datasetStats;
        
        setElementText('dataset-male-count', stats.male_count || 0);
        setElementText('dataset-female-count', stats.female_count || 0);
        setElementText('dataset-annotated-count', stats.annotation_count || 0);
        
        const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
        const annotationRate = totalCount > 0 ? (stats.annotation_count || 0) / totalCount * 100 : 0;
        setElementText('dataset-annotation-rate', annotationRate.toFixed(1) + '%');
        
        if (stats.yolo) {
            this.updateYoloDatasetStats(stats.yolo);
        }
    }
    
    /**
     * YOLOデータセット統計の更新
     * @param {Object} yoloStats - YOLOデータセット統計
     */
    updateYoloDatasetStats(yoloStats) {
        setElementText('yolo-train-count', yoloStats.train_count || 0);
        setElementText('yolo-val-count', yoloStats.val_count || 0);
        
        const yoloDatasetReady = (yoloStats.train_count > 0);
        const yoloReadinessElement = document.getElementById('yolo-dataset-readiness');
        if (yoloReadinessElement) {
            if (yoloDatasetReady) {
                yoloReadinessElement.className = 'alert alert-success';
                yoloReadinessElement.innerHTML = `<i class="fas fa-check-circle me-2"></i>YOLOデータセットが準備されています`;
            } else {
                yoloReadinessElement.className = 'alert alert-warning';
                yoloReadinessElement.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>YOLOデータセットの準備が必要です`;
            }
        }
    }
    
    /**
     * YOLOデータセット状態の更新
     * @param {Object} status - データセット状態
     */
    updateYoloDatasetStatus(status) {
        const statusElement = document.getElementById('yolo-dataset-status');
        if (!statusElement) return;
        
        if (status.error) {
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${status.message || 'データセット確認中にエラーが発生しました'}`;
            return;
        }
        
        const trainCount = status.images?.train || 0;
        const valCount = status.images?.val || 0;
        const trainLabelCount = status.labels?.train || 0;
        
        let alertClass = 'alert-warning';
        let message = '';
        let icon = 'fas fa-exclamation-triangle';
        
        if (trainCount > 0 && trainLabelCount > 0) {
            alertClass = 'alert-success';
            icon = 'fas fa-check-circle';
            message = `YOLOデータセットが準備完了（訓練: ${trainCount}枚, 検証: ${valCount}枚）`;
        } else if (trainCount > 0 && trainLabelCount === 0) {
            alertClass = 'alert-warning';
            message = `画像はありますが、アノテーションが必要です（${trainCount}枚）`;
        } else {
            alertClass = 'alert-secondary';
            icon = 'fas fa-info-circle';
            message = 'YOLOデータセットが準備されていません';
        }
        
        statusElement.className = `alert ${alertClass}`;
        statusElement.innerHTML = `<i class="${icon} me-2"></i>${message}`;
        
        setElementText('yolo-train-count', trainCount);
        setElementText('yolo-val-count', valCount);
        setElementText('yolo-annotation-count', trainLabelCount);
    }

    /**
     * 準備完了度表示の更新
     * @param {Object} readiness - 準備完了度データ
     */
    updateReadinessDisplay(readiness) {
        setElementText('dataset-readiness', readiness.readiness_percentage + '%');
        
        const checkElement = document.getElementById('readiness-check');
        const messageElement = document.getElementById('readiness-message');
        
        if (checkElement && messageElement) {
            checkElement.className = 'alert ' + getReadinessAlertClass(readiness.status);
            messageElement.textContent = readiness.message;
        }
        
        const startBtn = document.getElementById('start-unified-training-btn');
        if (startBtn) {
            const totalCount = (this.parent.datasetStats.male_count || 0) + (this.parent.datasetStats.female_count || 0);
            if (totalCount > 0) {
                startBtn.classList.remove('d-none');
            } else {
                startBtn.classList.add('d-none');
            }
        }
        
        const startYoloBtn = document.getElementById('start-yolo-training-btn');
        if (startYoloBtn) {
            const annotationCount = this.parent.datasetStats.annotation_count || 0;
            if (annotationCount > 3) {
                startYoloBtn.disabled = false;
                startYoloBtn.title = 'YOLOトレーニングを開始';
            } else {
                startYoloBtn.disabled = true;
                startYoloBtn.title = 'トレーニングには3枚以上のアノテーション画像が必要です';
            }
        }
    }

    /**
     * 学習データの表示
     * @param {Object} data - 学習データ
     */
    displayLearningData(data) {
        const container = document.getElementById('learning-data-container');
        if (!container) return;
        
        const allImages = [...(data.male || []), ...(data.female || []), ...(data.unknown || [])];
        
        if (allImages.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-database fa-3x mb-3"></i>
                    <p>学習データをアップロードすると、ここに表示されます</p>
                    <small class="text-muted">画像をクリックすると詳細を確認できます</small>
                </div>
            `;
            return;
        }
        
        const imageCards = allImages.map(item => {
            const genderClass = getGenderClass(item.category);
            const genderIcon = getGenderIcon(item.category);
            
            let annotationBadge = '';
            if (item.has_annotation && item.has_yolo) {
                annotationBadge = '<span class="badge bg-success position-absolute top-0 end-0 m-1" title="アノテーション済み・YOLO形式あり"><i class="fas fa-check"></i></span>';
            } else if (item.has_annotation) {
                annotationBadge = '<span class="badge bg-success position-absolute top-0 end-0 m-1" title="アノテーション済み"><i class="fas fa-check"></i></span>';
            } else if (item.has_yolo) {
                annotationBadge = '<span class="badge bg-info position-absolute top-0 end-0 m-1" title="YOLO形式あり"><i class="fas fa-object-group"></i></span>';
            } else {
                annotationBadge = '<span class="badge bg-secondary position-absolute top-0 end-0 m-1" title="未アノテーション"><i class="fas fa-plus"></i></span>';
            }
            
            return `
                <div class="image-card sample-card ${genderClass}" 
                     data-path="${item.path}" 
                     onclick="selectImageForAnnotation('${item.path}')"
                     title="クリックして詳細表示・編集">
                    ${annotationBadge}
                    <img src="${item.url}" alt="${item.filename}" class="image-preview">
                    <div class="image-info">
                        <i class="${genderIcon} me-1"></i>
                        ${truncateFilename(item.filename, this.isMobile ? 15 : 20)}
                        <div class="small text-muted mt-1">
                            ${item.has_annotation ? 'アノテーション済み' : '未アノテーション'}
                        </div>
                    </div>
                    <div class="delete-btn" onclick="event.stopPropagation(); showQuickDeleteConfirm('${item.path}')"
                         title="画像を削除">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = imageCards;
    }

    /**
     * サマリーメトリクス更新
     */
    updateSummaryMetrics() {
        const result = this.parent.learningResults || {};
        
        let accuracy = 0;
        let precision = 0;
        let recall = 0;
        
        let maleAnnotated = 0;
        let femaleAnnotated = 0;
        
        if (result.evaluation && result.evaluation.details) {
            const details = result.evaluation.details;
            
            if (details.cv_mean !== undefined) {
                accuracy = Number(details.cv_mean);
            } else if (result.evaluation.accuracy !== undefined) {
                accuracy = Number(result.evaluation.accuracy);
            }
            
            if (details.classification_report && details.classification_report['weighted avg']) {
                const report = details.classification_report['weighted avg'];
                precision = Number(report.precision || 0);
                recall = Number(report.recall || 0);
            }
        } else if (result.evaluation) {
            accuracy = Number(result.evaluation.accuracy || 0);
        }

        maleAnnotated = this.parent.datasetStats.male_count;
        femaleAnnotated = this.parent.datasetStats.female_count;

        if (result.summary) {
            if (result.summary.overall_accuracy > 0) 
                accuracy = Number(result.summary.overall_accuracy);
            if (result.summary.precision > 0) 
                precision = Number(result.summary.precision);
            if (result.summary.recall > 0) 
                recall = Number(result.summary.recall);
        }
        
        setElementText('final-accuracy', (accuracy * 100).toFixed(1) + '%');
        setElementText('final-precision', (precision * 100).toFixed(1) + '%');
        setElementText('final-recall', (recall * 100).toFixed(1) + '%');
        
        setElementText('male-annotation-count', maleAnnotated);
        setElementText('female-annotation-count', femaleAnnotated);
        
        if (result.yolo_results && result.yolo_results.metrics) {
            const yoloMetrics = result.yolo_results.metrics;
            
            setElementText('yolo-map50', (yoloMetrics.mAP50 * 100).toFixed(1) + '%');
            setElementText('yolo-precision', (yoloMetrics.precision * 100).toFixed(1) + '%');
            setElementText('yolo-recall', (yoloMetrics.recall * 100).toFixed(1) + '%');
            
            showElement('yolo-results-section');
        }
    }

    /**
     * 学習フェーズでの案内表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     */
    showTrainingGuidance(title, message) {
        const statusElement = document.getElementById('unified-status');
        if (statusElement) {
            statusElement.className = 'alert alert-info';
            statusElement.innerHTML = `
                <i class="fas fa-info-circle me-2"></i>
                <strong>${title}</strong><br>
                ${message}
            `;
            statusElement.classList.remove('d-none');
        }
    }

    /**
     * 分析フェーズでの案内表示
     */
    showAnalysisGuidance() {
        showElement('results-placeholder');
        
        const container = document.getElementById('unified-results-content');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>分析結果について</strong><br>
                    学習を実行すると、ここに詳細な分析結果が表示されます。
                    現在利用可能な学習履歴は下記をご確認ください。
                </div>
            `;
        }
        
        this.showSuccess('分析フェーズに移動しました。学習を実行すると結果が表示されます。');
    }

    /**
     * 学習履歴の表示
     * @param {Array} history - 履歴データ
     */
    displayLearningHistory(history) {
        const container = document.getElementById('unified-learning-history');
        if (!container) {
            console.error('履歴表示コンテナが見つかりません');
            return;
        }
        
        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-history fa-2x mb-2"></i>
                    <p>学習履歴がありません</p>
                </div>
            `;
            return;
        }
        
        const displayedTimestamps = new Set();
        let historyListHTML = '';
        
        history.forEach((item) => {
            const timestamp = item.timestamp || '';
            if (displayedTimestamps.has(timestamp)) {
                return;
            }
            
            displayedTimestamps.add(timestamp);
            
            const relatedItems = history.filter(h => h.timestamp === timestamp);
            
            const accuracies = {};
            relatedItems.forEach(relItem => {
                const itemType = relItem.type || '';
                const itemAccuracy = typeof relItem.accuracy === 'number' ? relItem.accuracy : 0;
                
                if (!accuracies[itemType] || itemAccuracy > accuracies[itemType]) {
                    accuracies[itemType] = itemAccuracy;
                }
            });
            
            const date = item.date || '日時不明';
            const typeLabels = Object.keys(accuracies).map(type => {
                const label = type === 'evaluation' ? '学習評価' : 
                             type === 'annotation' ? 'アノテーション分析' : 
                             type === 'yolo' ? 'YOLO検出' : type;
                const accuracy = (accuracies[type] * 100).toFixed(1);
                return `<strong>${label}:</strong> ${accuracy}%`;
            }).join(' / ');
            
            const typeIcon = relatedItems.some(i => i.type === 'yolo') ? 'fa-object-ungroup' :
                            relatedItems.some(i => i.type === 'evaluation') ? 'fa-chart-line' : 'fa-tags';
            
            const yoloBadge = relatedItems.some(i => i.type === 'yolo') ? 
                `<span class="badge bg-info ms-1">YOLO</span>` : '';
            
            historyListHTML += `
                <div class="border-bottom py-2 history-item" style="cursor: pointer;" 
                     onclick="window.unifiedLearningSystem.loadHistoricalResult('${timestamp}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>
                            <i class="fas ${typeIcon} me-2"></i>
                            ${typeLabels}
                            ${yoloBadge}
                        </span>
                        <small class="text-muted">${date}</small>
                    </div>
                    <div class="text-end">
                        <small class="text-primary">クリックして詳細を表示</small>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = historyListHTML;
    }

    /**
     * 空の履歴表示
     */
    displayEmptyHistory() {
        const container = document.getElementById('unified-learning-history');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-history fa-2x mb-2"></i>
                    <p>学習履歴がありません</p>
                </div>
            `;
        }
    }

    /**
     * 学習ステップの更新
     * @param {string} currentPhase - 現在のフェーズ
     * @param {Array} completedPhases - 完了済みフェーズの配列
     */
    updateTrainingSteps(currentPhase, completedPhases) {
        const stepMap = {
            'feature_extraction': 'step-feature-extraction',
            'model_training': 'step-model-training', 
            'basic_evaluation': 'step-basic-evaluation',
            'detailed_analysis': 'step-detailed-analysis',
            'yolo_preparation': 'step-yolo-preparation',
            'yolo_training': 'step-yolo-training'
        };
        
        Object.entries(stepMap).forEach(([phase, stepId]) => {
            const element = document.getElementById(stepId);
            if (element) {
                const icon = element.querySelector('i');
                if (completedPhases.includes(phase)) {
                    element.classList.add('active');
                    element.classList.remove('current');
                    if (icon) icon.className = 'fas fa-check-circle text-success me-2';
                } else if (phase === currentPhase) {
                    element.classList.remove('active');
                    element.classList.add('current');
                    if (icon) icon.className = 'fas fa-spinner fa-spin text-warning me-2';
                } else {
                    element.classList.remove('active', 'current');
                    if (icon) icon.className = 'fas fa-circle-notch text-muted me-2';
                }
            }
        });
    }

    /**
     * 訓練進捗の更新
     * @param {number} progress - 進捗（0-100）
     * @param {string} message - メッセージ
     */
    updateTrainingProgress(progress, message) {
        const bar = document.getElementById('training-progress-bar');
        const text = document.getElementById('training-status-text');
        
        if (bar) {
            bar.style.width = `${progress}%`;
            bar.textContent = `${Math.round(progress)}%`;
            
            if (progress >= 100) {
                bar.classList.remove('progress-bar-animated');
            } else {
                bar.classList.add('progress-bar-animated');
            }
        }
        
        if (text) text.textContent = message;
    }

    /**
     * 状態の更新
     * @param {string} message - メッセージ
     * @param {string} alertClass - アラートクラス
     * @param {number} progress - 進捗（0-100）
     */
    updateStatus(message, alertClass, progress) {
        const statusElement = document.getElementById('unified-status');
        if (statusElement) {
            statusElement.className = `alert ${alertClass}`;
            statusElement.textContent = message;
            statusElement.classList.remove('d-none');
        }
        
        const progressBar = document.getElementById('unified-progress-bar');
        const progressContainer = document.getElementById('unified-progress');
        
        if (progressBar && progressContainer) {
            progressContainer.classList.remove('d-none');
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${Math.round(progress)}%`;
            
            if (progress >= 100) {
                progressBar.classList.remove('progress-bar-animated');
            } else {
                progressBar.classList.add('progress-bar-animated');
            }
        }
    }

    /**
     * アップロード進捗の表示
     * @param {number} progress - 進捗（0-100）
     */
    showUploadProgress(progress) {
        const container = document.getElementById('upload-progress');
        const bar = document.getElementById('upload-progress-bar');
        if (container && bar) {
            container.classList.remove('d-none');
            bar.style.width = `${progress}%`;
            
            if (progress >= 100) {
                bar.classList.remove('progress-bar-animated');
            } else {
                bar.classList.add('progress-bar-animated');
            }
        }
    }

    /**
     * アップロード進捗の非表示
     */
    hideUploadProgress() {
        const container = document.getElementById('upload-progress');
        if (container) container.classList.add('d-none');
    }

    /**
     * トレーニング詳細の更新
     */
    updateTrainingDetails() {
        const stats = this.parent.datasetStats;
        setElementText('training-male-count', stats.male_count || 0);
        setElementText('training-female-count', stats.female_count || 0);
        setElementText('training-annotated-count', stats.annotation_count || 0);
        
        const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
        const annotationRate = totalCount > 0 ? (stats.annotation_count || 0) / totalCount * 100 : 0;
        setElementText('training-annotation-rate', annotationRate.toFixed(1) + '%');
    }

    /**
     * トレーニングフェーズの表示
     */
    showTrainingPhase() {
        hideElement('data-preparation-section');
        showElement('training-section');
        hideElement('analysis-section');
    }

    /**
     * 分析フェーズの表示
     */
    showAnalysisPhase() {
        hideElement('data-preparation-section');
        hideElement('training-section');  
        showElement('analysis-section');
    }

    /**
     * 成功メッセージの表示
     * @param {string} message - メッセージ
     */
    showSuccess(message) {
        showSuccessMessage(message);
    }

    /**
     * エラーメッセージの表示
     * @param {string} message - メッセージ
     */
    showError(message) {
        console.error('エラー:', message);
        showErrorMessage(message);
    }
    
    /**
     * ステータスアラートクラスの取得
     * @param {string} status - ステータス
     * @returns {string} アラートクラス
     */
    getStatusAlertClass(status) {
        return getStatusAlertClass(status);
    }
}