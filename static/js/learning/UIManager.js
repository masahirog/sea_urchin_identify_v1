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
            const annotationBadge = item.has_annotation ? 
                '<span class="badge bg-success position-absolute top-0 end-0 m-1"><i class="fas fa-check"></i></span>' : 
                '<span class="badge bg-secondary position-absolute top-0 end-0 m-1"><i class="fas fa-plus"></i></span>';
            
            return `
                <div class="image-card sample-card ${genderClass}" 
                     data-path="${item.path}" 
                     onclick="selectImageForAnnotation('${item.path}')"
                     title="クリックして詳細表示・編集">
                    ${annotationBadge}
                    <img src="${item.url}" alt="${item.filename}" class="image-preview">
                    <div class="image-info">
                        <i class="${genderIcon} me-1"></i>
                        ${truncateFilename(item.filename, 20)}
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
                const label = type === 'evaluation' ? '学習評価' : 'アノテーション分析';
                const accuracy = (accuracies[type] * 100).toFixed(1);
                return `<strong>${label}:</strong> ${accuracy}%`;
            }).join(' / ');
            
            const typeIcon = relatedItems.some(i => i.type === 'evaluation') ? 'fa-chart-line' : 'fa-tags';
            
            // 履歴アイテムHTML
            historyListHTML += `
                <div class="border-bottom py-2 history-item" style="cursor: pointer;" 
                     onclick="window.unifiedLearningSystem.loadHistoricalResult('${timestamp}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>
                            <i class="fas ${typeIcon} me-2"></i>
                            ${typeLabels}
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
            'detailed_analysis': 'step-detailed-analysis'
        };
        
        Object.entries(stepMap).forEach(([phase, stepId]) => {
            const element = document.getElementById(stepId);
            if (element) {
                const icon = element.querySelector('i');
                if (completedPhases.includes(phase)) {
                    element.classList.add('active');
                    icon.className = 'fas fa-check-circle text-success me-2';
                } else if (phase === currentPhase) {
                    element.classList.add('current');
                    icon.className = 'fas fa-spinner fa-spin text-warning me-2';
                } else {
                    element.classList.remove('active', 'current');
                    icon.className = 'fas fa-circle-notch text-muted me-2';
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
}