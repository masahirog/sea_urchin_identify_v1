/**
 * ウニ生殖乳頭分析システム - UIマネージャー
 * UI表示に関する処理を集約
 */

import {
    showSuccessMessage,
    showErrorMessage,
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
        this.isMobile = window.innerWidth < 768; // モバイル表示かどうか
        
        // ウィンドウリサイズ時の処理
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth < 768;
            
            // モバイル/デスクトップの切り替わり時のみレイアウト調整
            if (wasMobile !== this.isMobile) {
                this.adjustLayoutForViewport();
            }
        });
    }

    /**
     * UI初期化
     */
    initializeUI() {
        // フェーズインジケーターの初期化
        this.updatePhaseDisplay();
        
        // 初期状態の設定
        showElement('data-preparation-section');
        hideElement('training-section');
        hideElement('analysis-section');
        showElement('results-placeholder');
        
        // YOLO関連セクションの初期化
        this.initYoloUI();
        
        // ビューポートに応じたレイアウト調整
        this.adjustLayoutForViewport();
    }
    
    /**
     * YOLO関連UIの初期化
     */
    initYoloUI() {
        // YOLOトレーニングセクションの初期化
        const yoloSection = document.getElementById('yolo-training-section');
        if (yoloSection) {
            // トレーニング設定の初期値を設定
            const batchSizeInput = document.getElementById('yolo-batch-size');
            if (batchSizeInput) {
                // モバイルデバイスの場合は小さい値を設定
                batchSizeInput.value = this.isMobile ? '8' : '16';
            }
            
            // 結果セクションを非表示にしておく
            hideElement('yolo-results-section');
        }
    }
    
    /**
     * ビューポートに応じたレイアウト調整
     */
    adjustLayoutForViewport() {
        // モバイル用の特別なレイアウト調整
        if (this.isMobile) {
            // フォント・画像サイズの調整
            document.querySelectorAll('.image-card').forEach(card => {
                card.style.maxWidth = '100%';
            });
            
            // カード内の内容調整
            document.querySelectorAll('.card-body').forEach(body => {
                body.classList.add('p-2');
            });
            
            // 統計カードのレイアウト調整
            document.querySelectorAll('.metric-card').forEach(card => {
                card.style.padding = '0.5rem';
            });
        } else {
            // デスクトップ用のレイアウト復元
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
        // フェーズインジケーター更新
        Object.keys(this.parent.phases).forEach(phase => {
            const element = document.getElementById(`phase-${phase}`);
            if (element) {
                // 既存のクラスをクリア
                element.classList.remove('active', 'current-phase', 'completed');
                
                // フェーズ状態に応じてクラスを設定
                if (phase === this.parent.currentPhase) {
                    element.classList.add('current-phase');
                } else if (this.isPhaseCompleted(phase)) {
                    element.classList.add('completed');
                }
                
                // 全フェーズを常にクリック可能に設定
                element.style.opacity = '1';
                element.style.pointerEvents = 'auto';
                
                // 進捗ドットの更新
                const progressDot = element.querySelector('.progress-dot');
                if (progressDot) {
                    progressDot.classList.remove('active');
                    if (phase === this.parent.currentPhase || this.isPhaseCompleted(phase)) {
                        progressDot.classList.add('active');
                    }
                }
            }
        });
        
        // セクション表示切り替え
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
                return false; // 分析フェーズは常に継続可能
            default:
                return false;
        }
    }

    /**
     * フェーズセクション表示
     */
    showPhaseSection() {
        // 全セクション非表示
        ['data-preparation-section', 'training-section', 'analysis-section'].forEach(sectionId => {
            hideElement(sectionId);
        });
        
        // 現在フェーズのセクション表示
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
        
        // results-placeholderの表示制御
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
        
        // 基本カウンター更新
        setElementText('dataset-male-count', stats.male_count || 0);
        setElementText('dataset-female-count', stats.female_count || 0);
        setElementText('dataset-annotated-count', stats.annotation_count || 0);
        
        // アノテーション率の計算と表示
        const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
        const annotationRate = totalCount > 0 ? (stats.annotation_count || 0) / totalCount * 100 : 0;
        setElementText('dataset-annotation-rate', annotationRate.toFixed(1) + '%');
        
        // YOLO関連の統計表示（存在する場合）
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
        
        // YOLOデータセット準備状況の更新
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
        // YOLOデータセット状態表示要素
        const statusElement = document.getElementById('yolo-dataset-status');
        if (!statusElement) return;
        
        if (status.error) {
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${status.message || 'データセット確認中にエラーが発生しました'}`;
            return;
        }
        
        // 画像数の取得
        const trainCount = status.images?.train || 0;
        const valCount = status.images?.val || 0;
        
        // ラベル数の取得
        const trainLabelCount = status.labels?.train || 0;
        
        // 準備状況の判定
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
        
        // 統計表示も更新
        setElementText('yolo-train-count', trainCount);
        setElementText('yolo-val-count', valCount);
        setElementText('yolo-annotation-count', trainLabelCount);
    }

    /**
     * 準備完了度表示の更新
     * @param {Object} readiness - 準備完了度データ
     */
    updateReadinessDisplay(readiness) {
        // 準備完了度パーセンテージ
        setElementText('dataset-readiness', readiness.readiness_percentage + '%');
        
        // ステータスメッセージ
        const checkElement = document.getElementById('readiness-check');
        const messageElement = document.getElementById('readiness-message');
        
        if (checkElement && messageElement) {
            // ステータスに応じたスタイル設定
            checkElement.className = 'alert ' + getReadinessAlertClass(readiness.status);
            messageElement.textContent = readiness.message;
        }
        
        // 学習開始ボタンの表示制御（緩和）
        const startBtn = document.getElementById('start-unified-training-btn');
        if (startBtn) {
            const totalCount = (this.parent.datasetStats.male_count || 0) + (this.parent.datasetStats.female_count || 0);
            if (totalCount > 0) {
                startBtn.classList.remove('d-none');
            } else {
                startBtn.classList.add('d-none');
            }
        }
        
        // YOLOトレーニングボタンの表示制御
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
        
        // 画像カードの生成
        const imageCards = allImages.map(item => {
            const genderClass = getGenderClass(item.category);
            const genderIcon = getGenderIcon(item.category);
            
            // アノテーション状態に応じたバッジ
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
        // サマリー情報の取得
        const result = this.parent.learningResults || {};
        
        // 基本値を設定
        let accuracy = 0;
        let precision = 0;
        let recall = 0;
        
        // アノテーション枚数情報
        let maleAnnotated = 0;
        let femaleAnnotated = 0;
        
        // evaluation → details からの抽出
        if (result.evaluation && result.evaluation.details) {
            const details = result.evaluation.details;
            
            // CV平均（精度）
            if (details.cv_mean !== undefined) {
                accuracy = Number(details.cv_mean);
            } else if (result.evaluation.accuracy !== undefined) {
                accuracy = Number(result.evaluation.accuracy);
            }
            
            // 分類レポートから適合率と再現率を抽出
            if (details.classification_report && details.classification_report['weighted avg']) {
                const report = details.classification_report['weighted avg'];
                precision = Number(report.precision || 0);
                recall = Number(report.recall || 0);
            }
        } else if (result.evaluation) {
            // evaluation直接からの抽出（フォールバック）
            accuracy = Number(result.evaluation.accuracy || 0);
        }

        maleAnnotated = this.parent.datasetStats.male_count;
        femaleAnnotated = this.parent.datasetStats.female_count;

        // summary直接参照（優先）- ただし0以外の値の場合のみ
        if (result.summary) {
            if (result.summary.overall_accuracy > 0) 
                accuracy = Number(result.summary.overall_accuracy);
            if (result.summary.precision > 0) 
                precision = Number(result.summary.precision);
            if (result.summary.recall > 0) 
                recall = Number(result.summary.recall);
        }
        
        // 精度と適合率、再現率の表示更新
        setElementText('final-accuracy', (accuracy * 100).toFixed(1) + '%');
        setElementText('final-precision', (precision * 100).toFixed(1) + '%');
        setElementText('final-recall', (recall * 100).toFixed(1) + '%');
        
        // アノテーション情報の表示更新
        setElementText('male-annotation-count', maleAnnotated);
        setElementText('female-annotation-count', femaleAnnotated);
        
        // YOLOメトリクスの更新（存在する場合）
        if (result.yolo_results && result.yolo_results.metrics) {
            const yoloMetrics = result.yolo_results.metrics;
            
            setElementText('yolo-map50', (yoloMetrics.mAP50 * 100).toFixed(1) + '%');
            setElementText('yolo-precision', (yoloMetrics.precision * 100).toFixed(1) + '%');
            setElementText('yolo-recall', (yoloMetrics.recall * 100).toFixed(1) + '%');
            
            // YOLOセクションを表示
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
        // プレースホルダーを表示
        showElement('results-placeholder');
        
        // 案内メッセージ
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
        
        // 既に表示されたタイムスタンプを追跡
        const displayedTimestamps = new Set();
        
        // 履歴リストを生成（重複するタイムスタンプは統合）
        let historyListHTML = '';
        
        history.forEach((item) => {
            // タイムスタンプが既に表示されていればスキップ
            const timestamp = item.timestamp || '';
            if (displayedTimestamps.has(timestamp)) {
                return;
            }
            
            // タイムスタンプを追跡リストに追加
            displayedTimestamps.add(timestamp);
            
            // 同じタイムスタンプを持つすべての項目を取得
            const relatedItems = history.filter(h => h.timestamp === timestamp);
            
            // 項目タイプ毎の最高精度を計算
            const accuracies = {};
            relatedItems.forEach(relItem => {
                const itemType = relItem.type || '';
                const itemAccuracy = typeof relItem.accuracy === 'number' ? relItem.accuracy : 0;
                
                if (!accuracies[itemType] || itemAccuracy > accuracies[itemType]) {
                    accuracies[itemType] = itemAccuracy;
                }
            });
            
            // 表示用のアイテム情報を準備
            const date = item.date || '日時不明';
            const typeLabels = Object.keys(accuracies).map(type => {
                const label = type === 'evaluation' ? '学習評価' : 
                             type === 'annotation' ? 'アノテーション分析' : 
                             type === 'yolo' ? 'YOLO検出' : type;
                const accuracy = (accuracies[type] * 100).toFixed(1);
                return `<strong>${label}:</strong> ${accuracy}%`;
            }).join(' / ');
            
            // アイコン選択
            const typeIcon = relatedItems.some(i => i.type === 'yolo') ? 'fa-object-ungroup' :
                            relatedItems.some(i => i.type === 'evaluation') ? 'fa-chart-line' : 'fa-tags';
            
            // YOLOバッジの追加
            const yoloBadge = relatedItems.some(i => i.type === 'yolo') ? 
                `<span class="badge bg-info ms-1">YOLO</span>` : '';
            
            // 履歴アイテムHTML
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
            
            // 進捗完了時にアニメーションを停止
            if (progress >= 100) {
                bar.classList.remove('progress-bar-animated');
            } else {
                bar.classList.add('progress-bar-animated');
            }
        }
        
        if (text) text.textContent = message;
    }
    
    /**
     * YOLOトレーニング進捗の更新
     * @param {Object} status - ステータスデータ
     */
    updateYoloTrainingProgress(status) {
        const bar = document.getElementById('yolo-progress-bar');
        const text = document.getElementById('yolo-status-text');
        const container = document.getElementById('yolo-progress-container');
        
        if (!bar || !text || !container) return;
        
        // 進捗表示
        if (status.status === 'not_started') {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        // 進捗バーの更新
        bar.style.width = `${status.progress || 0}%`;
        bar.textContent = `${Math.round(status.progress || 0)}%`;
        
        // 進捗完了時にアニメーションを停止
        if ((status.progress || 0) >= 100 || status.status === 'completed') {
            bar.classList.remove('progress-bar-animated');
        } else {
            bar.classList.add('progress-bar-animated');
        }
        
        // ステータステキストの更新
        text.textContent = status.message || '';
        
        // メトリクスの更新
        if (status.metrics) {
            this.updateYoloMetrics(status.metrics);
        }
        
        // トレーニング詳細の更新
        this.updateYoloTrainingDetails(status);
        
        // 結果画像の更新
        if (status.result_images) {
            this.updateYoloResultImages(status.result_images);
        }
    }
    
    /**
     * YOLOメトリクスの更新
     * @param {Object} metrics - メトリクスデータ
     */
    updateYoloMetrics(metrics) {
        // Box Loss
        if (metrics.box_loss && metrics.box_loss.length > 0) {
            setElementText('yolo-box-loss', metrics.box_loss[metrics.box_loss.length - 1].toFixed(4));
        }
        
        // Object Loss
        if (metrics.obj_loss && metrics.obj_loss.length > 0) {
            setElementText('yolo-obj-loss', metrics.obj_loss[metrics.obj_loss.length - 1].toFixed(4));
        }
        
        // mAP50
        if (metrics.mAP50 && metrics.mAP50.length > 0) {
            setElementText('yolo-map50', metrics.mAP50[metrics.mAP50.length - 1].toFixed(4));
        }
    }
    
    /**
     * YOLOトレーニング詳細の更新
     * @param {Object} status - ステータスデータ
     */
    updateYoloTrainingDetails(status) {
        setElementText('yolo-elapsed-time', status.elapsed_time || '-');
        setElementText('yolo-current-epoch', status.current_epoch || '-');
        setElementText('yolo-total-epochs', status.total_epochs || '-');
        
        // ステータステキストの更新
        const statusElement = document.getElementById('yolo-training-status');
        if (statusElement) {
            let alertClass = 'alert-secondary';
            
            switch (status.status) {
                case 'running':
                    alertClass = 'alert-primary';
                    break;
                case 'completed':
                    alertClass = 'alert-success';
                    break;
                case 'stopped':
                    alertClass = 'alert-warning';
                    break;
                case 'failed':
                case 'error':
                    alertClass = 'alert-danger';
                    break;
            }
            
            statusElement.className = `alert ${alertClass}`;
            statusElement.textContent = status.message || '状態不明';
        }
    }
    
    /**
     * YOLO結果画像の更新
     * @param {Object} images - 画像データ
     */
    updateYoloResultImages(images) {
        const container = document.getElementById('yolo-training-images');
        if (!container) return;
        
        if (Object.keys(images).length === 0) {
            container.innerHTML = '<p class="text-muted text-center">トレーニング画像はまだありません</p>';
            return;
        }
        
        let html = '';
        
        // バッチ画像
        if (images.train_batch) {
            html += `
                <div class="mb-3">
                    <h6>トレーニングバッチ:</h6>
                    <img src="${images.train_batch}" alt="トレーニングバッチ" class="img-fluid rounded">
                </div>
            `;
        }
        
        // ラベル分布
        if (images.labels) {
            html += `
                <div class="mb-3">
                    <h6>ラベル分布:</h6>
                    <img src="${images.labels}" alt="ラベル分布" class="img-fluid rounded">
                </div>
            `;
        }
        
        // 結果プロット
        if (images.results) {
            html += `
                <div class="mb-3">
                    <h6>学習曲線:</h6>
                    <img src="${images.results}" alt="学習結果" class="img-fluid rounded">
                </div>
            `;
        }
        
        // 混同行列
        if (images.confusion_matrix) {
            html += `
                <div class="mb-3">
                    <h6>混同行列:</h6>
                    <img src="${images.confusion_matrix}" alt="混同行列" class="img-fluid rounded">
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    /**
     * 状態の更新
     * @param {string} message - メッセージ
     * @param {string} alertClass - アラートクラス
     * @param {number} progress - 進捗（0-100）
     */
    updateStatus(message, alertClass, progress) {
        // 統一ステータス更新
        const statusElement = document.getElementById('unified-status');
        if (statusElement) {
            statusElement.className = `alert ${alertClass}`;
            statusElement.textContent = message;
            statusElement.classList.remove('d-none');
        }
        
        // プログレスバー更新
        const progressBar = document.getElementById('unified-progress-bar');
        const progressContainer = document.getElementById('unified-progress');
        
        if (progressBar && progressContainer) {
            progressContainer.classList.remove('d-none');
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${Math.round(progress)}%`;
            
            // 進捗完了時にアニメーションを停止
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
            
            // 進捗が100%の場合はアニメーションを停止
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
        
        // アノテーション率の計算と表示
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
     * YOLOフォームのパラメータを取得
     * @returns {Object} パラメータオブジェクト
     */
    getYoloTrainingParams() {
        return {
            weights: document.getElementById('yolo-weights')?.value || 'yolov5s.pt',
            batch_size: parseInt(document.getElementById('yolo-batch-size')?.value || '16'),
            epochs: parseInt(document.getElementById('yolo-epochs')?.value || '100'),
            img_size: parseInt(document.getElementById('yolo-img-size')?.value || '640')
        };
    }
}