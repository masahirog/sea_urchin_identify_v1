/**
 * ウニ生殖乳頭分析システム - 統合学習システム
 * unified-learning-system.js + annotation_tools.js + evaluation/* の統合版
 * 学習管理、アノテーション、評価機能を統合
 */

// ===========================================
// 統合学習システムクラス
// ===========================================

class UnifiedLearningSystem {
    constructor() {
        this.currentPhase = 'preparation';
        this.taskId = null;
        this.statusCheckInterval = null;
        this.datasetStats = {};
        this.learningResults = null;
        
        // フェーズ定義
        this.phases = {
            'preparation': {
                name: 'データ準備',
                description: 'アップロード・アノテーション',
                icon: 'fas fa-database',
                weight: 20
            },
            'training': {
                name: 'AI学習',
                description: 'モデル訓練・基本評価', 
                icon: 'fas fa-brain',
                weight: 50
            },
            'analysis': {
                name: '結果分析',
                description: '詳細評価・改善提案',
                icon: 'fas fa-chart-line',
                weight: 30
            }
        };
        
        console.log('統合学習システム初期化');
    }

    /**
     * システム初期化
     */
    async initialize() {
        console.log('統合学習システム初期化開始');
        
        try {
            // UI初期化
            this.initializeUI();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // 初期データ読み込み
            await this.loadInitialData();
            
            // フェーズ判定
            this.determineCurrentPhase();
            
            // アノテーションコールバック設定
            this.setupAnnotationCallback();
            
            console.log('統合学習システム初期化完了');
            
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('システムの初期化に失敗しました: ' + error.message);
        }
    }

    /**
     * UI初期化
     */
    initializeUI() {
        // フェーズインジケーターの初期化
        this.updatePhaseDisplay();
        
        // 初期状態の設定
        this.showElement('data-preparation-section');
        this.hideElement('training-section');
        this.hideElement('analysis-section');
        this.showElement('results-placeholder');
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // データアップロードフォーム
        const uploadForm = document.getElementById('unifiedDataUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleDataUpload();
            });
        }

        // 統合学習開始ボタン
        const startTrainingBtn = document.getElementById('start-unified-training-btn');
        if (startTrainingBtn) {
            startTrainingBtn.addEventListener('click', () => {
                this.startUnifiedTraining();
            });
        }

        // 新しい学習開始ボタン
        const newIterationBtn = document.getElementById('start-new-iteration-btn');
        if (newIterationBtn) {
            newIterationBtn.addEventListener('click', () => {
                this.startNewIteration();
            });
        }

        // データセット更新ボタン
        const refreshBtn = document.getElementById('refresh-dataset-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshDatasetStats();
            });
        }

        // フィルターボタン
        const filterInputs = document.querySelectorAll('input[name="dataFilter"]');
        filterInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.filterLearningData(e.target.value);
            });
        });
    }

    /**
     * アノテーションコールバック設定
     */
    setupAnnotationCallback() {
        // グローバルコールバック関数を設定
        window.onAnnotationSaved = () => {
            console.log('アノテーション保存完了 - データ更新中...');
            this.refreshDatasetStats();
            this.loadLearningData();
            this.showSuccessMessage('アノテーションが保存され、統計情報を更新しました');
        };
    }

    /**
     * 初期データ読み込み
     */
    async loadInitialData() {
        try {
            // データセット統計読み込み
            await this.refreshDatasetStats();
            
            // 学習データ読み込み
            await this.loadLearningData();
            
            // 学習履歴読み込み
            await this.loadLearningHistory();
            
        } catch (error) {
            console.error('初期データ読み込みエラー:', error);
        }
    }

    /**
     * データセット統計の更新
     */
    async refreshDatasetStats() {
        try {
            const response = await fetch('/learning/dataset-stats');
            if (!response.ok) throw new Error('統計取得に失敗しました');
            
            this.datasetStats = await response.json();
            this.updateDatasetStatsDisplay();
            
            // 準備完了度チェック
            await this.checkReadiness();
            
        } catch (error) {
            console.error('データセット統計取得エラー:', error);
            this.showError('データセット統計の取得に失敗しました');
        }
    }

    /**
     * データセット統計表示の更新
     */
    updateDatasetStatsDisplay() {
        const stats = this.datasetStats;
        
        // 基本カウンター更新
        this.setElementText('dataset-male-count', stats.male_count || 0);
        this.setElementText('dataset-female-count', stats.female_count || 0);
        this.setElementText('dataset-annotated-count', stats.annotation_count || 0);
        
        // 準備完了度の更新は checkReadiness() で行う
    }

    /**
     * 準備完了度チェック
     */
    async checkReadiness() {
        try {
            const response = await fetch('/learning/readiness-check');
            if (!response.ok) throw new Error('準備完了度チェックに失敗しました');
            
            const readiness = await response.json();
            this.updateReadinessDisplay(readiness);
            
        } catch (error) {
            console.error('準備完了度チェックエラー:', error);
        }
    }

    /**
     * 準備完了度表示の更新
     */
    updateReadinessDisplay(readiness) {
        // 準備完了度パーセンテージ
        this.setElementText('dataset-readiness', readiness.readiness_percentage + '%');
        
        // ステータスメッセージ
        const checkElement = document.getElementById('readiness-check');
        const messageElement = document.getElementById('readiness-message');
        
        if (checkElement && messageElement) {
            // ステータスに応じたスタイル設定
            checkElement.className = 'alert ' + this.getReadinessAlertClass(readiness.status);
            messageElement.textContent = readiness.message;
        }
        
        // 学習開始ボタンの表示制御
        const startBtn = document.getElementById('start-unified-training-btn');
        if (startBtn) {
            if (readiness.readiness_percentage >= 60) {
                startBtn.classList.remove('d-none');
            } else {
                startBtn.classList.add('d-none');
            }
        }
    }

    /**
     * 準備完了度に応じたアラートクラス取得
     */
    getReadinessAlertClass(status) {
        switch (status) {
            case 'excellent': return 'alert-success';
            case 'good': return 'alert-info';
            case 'fair': return 'alert-warning';
            default: return 'alert-danger';
        }
    }

    /**
     * 学習データの読み込み
     */
    async loadLearningData(filter = 'all') {
        try {
            const url = filter !== 'all' ? 
                `/learning/learning-data?gender=${filter}` : 
                '/learning/learning-data';
                
            const response = await fetch(url);
            if (!response.ok) throw new Error('学習データ取得に失敗しました');
            
            const data = await response.json();
            this.displayLearningData(data);
            
        } catch (error) {
            console.error('学習データ読み込みエラー:', error);
            this.showError('学習データの読み込みに失敗しました');
        }
    }

    /**
     * 学習データの表示
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
                    <small class="text-muted">画像をクリックしてアノテーションを作成できます</small>
                </div>
            `;
            return;
        }
        
        // 画像カードの生成
        const imageCards = allImages.map(item => {
            const genderClass = this.getGenderClass(item.category);
            const genderIcon = this.getGenderIcon(item.category);
            const annotationBadge = item.has_annotation ? 
                '<span class="badge bg-success position-absolute top-0 end-0 m-1"><i class="fas fa-check"></i></span>' : '';
            
            return `
                <div class="image-card sample-card ${genderClass}" 
                     data-path="${item.path}" 
                     onclick="unifiedLearningSystem.selectImageForAnnotation('${item.path}')"
                     title="${item.filename}">
                    ${annotationBadge}
                    <img src="${item.url}" alt="${item.filename}" class="image-preview">
                    <div class="image-info">
                        <i class="${genderIcon} me-1"></i>
                        ${this.truncateFilename(item.filename, 20)}
                    </div>
                    <div class="delete-btn" onclick="event.stopPropagation(); unifiedLearningSystem.deleteImage('${item.path}')">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = imageCards;
    }

    /**
     * データアップロード処理
     */
    async handleDataUpload() {
        const fileInput = document.getElementById('dataFiles');
        const genderSelect = document.getElementById('dataGender');
        
        const files = fileInput.files;
        const gender = genderSelect.value;
        
        if (files.length === 0) {
            this.showError('画像ファイルを選択してください');
            return;
        }
        
        console.log(`データアップロード開始: ${files.length}ファイル, 性別: ${gender}`);
        
        try {
            // フォームデータ作成
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }
            formData.append('gender', gender);
            
            // アップロード進捗表示
            this.showUploadProgress(0);
            
            // アップロード実行
            const response = await fetch('/learning/upload-data', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
            
            const data = await response.json();
            this.hideUploadProgress();
            
            if (data.error) {
                this.showError('アップロードエラー: ' + data.error);
                return;
            }
            
            // 成功処理
            let message = data.message;
            if (data.error_count > 0) {
                message += ` (${data.error_count}ファイルでエラー)`;
            }
            this.showSuccessMessage(message);
            
            // フォームリセット
            fileInput.value = '';
            
            // データ更新
            await this.refreshDatasetStats();
            await this.loadLearningData();
            
        } catch (error) {
            this.hideUploadProgress();
            console.error('アップロードエラー:', error);
            this.showError('アップロード中にエラーが発生しました: ' + error.message);
        }
    }

    /**
     * 統合学習の開始
     */
    async startUnifiedTraining() {
        console.log('統合学習開始');
        
        try {
            // データセット検証
            const validation = await this.validateDataset();
            if (!validation.valid) {
                this.showError(validation.message);
                return;
            }
            
            // フェーズ切り替え
            this.currentPhase = 'training';
            this.updatePhaseDisplay();
            this.showTrainingPhase();
            
            // 統合学習API呼び出し
            const response = await fetch('/learning/start-unified-training', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            
            if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // タスクID保存
            this.taskId = data.task_id;
            
            // 進捗監視開始
            this.startProgressMonitoring();
            
            // 成功メッセージ
            this.showSuccessMessage('統合学習プロセスを開始しました');
            
            // 学習詳細の更新
            this.updateTrainingDetails();
            
        } catch (error) {
            console.error('統合学習開始エラー:', error);
            this.showError('統合学習の開始に失敗しました: ' + error.message);
            
            // エラー時はフェーズを戻す
            this.currentPhase = 'preparation';
            this.updatePhaseDisplay();
        }
    }

    /**
     * データセット検証
     */
    async validateDataset() {
        try {
            const response = await fetch('/learning/dataset-validation');
            if (!response.ok) throw new Error('検証リクエストに失敗しました');
            
            return await response.json();
            
        } catch (error) {
            console.error('データセット検証エラー:', error);
            return {
                valid: false,
                message: 'データセットの検証に失敗しました'
            };
        }
    }

    /**
     * 進捗監視の開始
     */
    startProgressMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
        
        this.statusCheckInterval = setInterval(() => {
            this.checkUnifiedStatus();
        }, 2000); // 2秒間隔
        
        console.log('進捗監視開始:', this.taskId);
    }

    /**
     * 統合ステータスチェック
     */
    async checkUnifiedStatus() {
        if (!this.taskId) return;
        
        try {
            const response = await fetch(`/learning/unified-status/${this.taskId}`);
            if (!response.ok) throw new Error('ステータス取得に失敗しました');
            
            const status = await response.json();
            this.updateUnifiedStatus(status);
            
            // 完了チェック
            if (status.status === 'completed') {
                this.handleTrainingComplete(status);
            } else if (status.status === 'failed' || status.status === 'error') {
                this.handleTrainingError(status);
            }
            
        } catch (error) {
            console.error('ステータスチェックエラー:', error);
        }
    }

    /**
     * 統合ステータス更新
     */
    updateUnifiedStatus(status) {
        // 全体進捗更新
        this.updateStatus(status.message || '処理中...', this.getStatusAlertClass(status.status), status.progress || 0);
        
        // 学習進捗詳細更新
        this.updateTrainingProgress(status.progress || 0, status.message || '');
        
        // フェーズステップ更新
        this.updateTrainingSteps(status.current_phase, status.phases_completed || []);
    }

    /**
     * 学習完了処理
     */
    async handleTrainingComplete(status) {
        console.log('統合学習完了:', status);
        
        // 進捗監視停止
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        // 結果保存
        this.learningResults = status.result;
        
        // フェーズ切り替え
        this.currentPhase = 'analysis';
        this.updatePhaseDisplay();
        this.showAnalysisPhase();
        
        // 結果表示
        this.displayUnifiedResults();
        
        // 履歴更新
        await this.loadLearningHistory();
        
        this.showSuccessMessage('統合学習プロセスが正常に完了しました！');
    }

    /**
     * 学習エラー処理
     */
    handleTrainingError(status) {
        console.error('統合学習エラー:', status);
        
        // 進捗監視停止
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        // エラー表示
        this.updateStatus(status.message || 'エラーが発生しました', 'alert-danger', 100);
        this.showError('統合学習中にエラーが発生しました: ' + (status.message || '不明なエラー'));
        
        // フェーズを戻す
        this.currentPhase = 'preparation';
        this.updatePhaseDisplay();
    }

    /**
     * 統合結果の表示
     */
    displayUnifiedResults() {
        if (!this.learningResults) return;
        
        console.log('統合結果表示:', this.learningResults);
        
        // プレースホルダー非表示
        this.hideElement('results-placeholder');
        
        // サマリーメトリクス更新
        this.updateSummaryMetrics();
        
        // 詳細結果表示
        this.displayDetailedResults();
        
        // 改善提案表示
        this.displayImprovementSuggestions();
    }

    /**
     * サマリーメトリクス更新
     */
    updateSummaryMetrics() {
        const summary = this.learningResults.summary || {};
        
        this.setElementText('final-accuracy', (summary.overall_accuracy * 100).toFixed(1) + '%');
        this.setElementText('final-precision', (summary.precision * 100).toFixed(1) + '%');
        this.setElementText('final-recall', (summary.recall * 100).toFixed(1) + '%');
        this.setElementText('annotation-effect', (summary.annotation_rate * 100).toFixed(1) + '%');
    }

    /**
     * 詳細結果表示
     */
    displayDetailedResults() {
        const container = document.getElementById('unified-results-content');
        if (!container) return;
        
        const evaluation = this.learningResults.evaluation || {};
        const timestamp = this.learningResults.metadata?.timestamp || Date.now();
        
        // グラフ画像の表示
        const graphsHTML = `
            <div class="row">
                <div class="col-md-6 mb-3">
                    <h6>学習曲線</h6>
                    <img src="/evaluation/images/learning_curve_${timestamp}.png" 
                         class="img-fluid rounded" alt="学習曲線" 
                         onerror="this.parentElement.innerHTML='<p class=text-muted>グラフが利用できません</p>'">
                </div>
                <div class="col-md-6 mb-3">
                    <h6>混同行列</h6>
                    <img src="/evaluation/images/confusion_matrix_${timestamp}.png" 
                         class="img-fluid rounded" alt="混同行列"
                         onerror="this.parentElement.innerHTML='<p class=text-muted>グラフが利用できません</p>'">
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <h6>ROCカーブ</h6>
                    <img src="/evaluation/images/roc_curve_${timestamp}.png" 
                         class="img-fluid rounded" alt="ROCカーブ"
                         onerror="this.parentElement.innerHTML='<p class=text-muted>グラフが利用できません</p>'">
                </div>
                <div class="col-md-6 mb-3">
                    <h6>アノテーション効果</h6>
                    <img src="/evaluation/images/annotation_impact_${timestamp}.png" 
                         class="img-fluid rounded" alt="アノテーション効果"
                         onerror="this.parentElement.innerHTML='<p class=text-muted>グラフが利用できません</p>'">
                </div>
            </div>
        `;
        
        container.innerHTML = graphsHTML;
    }

    /**
     * 改善提案表示
     */
    displayImprovementSuggestions() {
        const container = document.getElementById('improvement-suggestions');
        if (!container) return;
        
        const suggestions = this.learningResults.improvement_suggestions || [];
        
        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>素晴らしい結果です！</strong><br>
                    現在のモデルは良好な性能を示しています。
                </div>
            `;
            return;
        }
        
        const suggestionsHTML = suggestions.map(suggestion => {
            const priorityClass = suggestion.priority === 'high' ? 'alert-warning' : 'alert-info';
            const priorityIcon = suggestion.priority === 'high' ? 'fas fa-exclamation-triangle' : 'fas fa-lightbulb';
            
            return `
                <div class="alert ${priorityClass}">
                    <i class="${priorityIcon} me-2"></i>
                    <strong>${suggestion.category}:</strong><br>
                    ${suggestion.message}
                </div>
            `;
        }).join('');
        
        container.innerHTML = suggestionsHTML;
    }

    /**
     * フェーズ表示の更新
     */
    updatePhaseDisplay() {
        // フェーズインジケーター更新
        Object.keys(this.phases).forEach(phase => {
            const element = document.getElementById(`phase-${phase}`);
            if (element) {
                element.classList.remove('active', 'current-phase', 'completed');
                
                if (phase === this.currentPhase) {
                    element.classList.add('current-phase');
                } else if (this.isPhaseCompleted(phase)) {
                    element.classList.add('completed');
                }
            }
        });
        
        // セクション表示切り替え
        this.showPhaseSection();
    }

    /**
     * フェーズセクション表示
     */
    showPhaseSection() {
        // 全セクション非表示
        ['data-preparation-section', 'training-section', 'analysis-section'].forEach(sectionId => {
            this.hideElement(sectionId);
        });
        
        // 現在フェーズのセクション表示
        const sectionId = `${this.currentPhase === 'training' ? 'training' : 
                          this.currentPhase === 'analysis' ? 'analysis' : 
                          'data-preparation'}-section`;
        this.showElement(sectionId);
    }

    // ===== 学習データ関連のヘルパーメソッド =====
    selectImageForAnnotation(imagePath) {
        console.log('アノテーション開始:', imagePath);
        if (typeof openAnnotationModal === 'function') {
            openAnnotationModal(imagePath);
        } else {
            this.showError('アノテーション機能が利用できません');
        }
    }

    async deleteImage(imagePath) {
        if (!confirm('この学習データを削除してもよろしいですか？')) return;
        
        try {
            const response = await fetch('/learning/delete-data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({path: imagePath})
            });
            
            if (!response.ok) throw new Error('削除に失敗しました');
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            this.showSuccessMessage(data.message);
            await this.refreshDatasetStats();
            await this.loadLearningData();
            
        } catch (error) {
            console.error('削除エラー:', error);
            this.showError('削除中にエラーが発生しました: ' + error.message);
        }
    }

    filterLearningData(filter) {
        this.loadLearningData(filter);
    }

    getGenderClass(category) {
        switch (category) {
            case 'male': return 'border-primary';
            case 'female': return 'border-danger';
            default: return 'border-secondary';
        }
    }

    getGenderIcon(category) {
        switch (category) {
            case 'male': return 'fas fa-mars text-primary';
            case 'female': return 'fas fa-venus text-danger';
            default: return 'fas fa-question text-secondary';
        }
    }

    truncateFilename(filename, maxLength = 20) {
        if (!filename || filename.length <= maxLength) return filename;
        const lastDotIndex = filename.lastIndexOf('.');
        const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
        const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
        const availableLength = maxLength - extension.length - 3;
        if (availableLength <= 0) return filename.substring(0, maxLength - 3) + '...';
        return name.substring(0, availableLength) + '...' + extension;
    }

    // フェーズ判定メソッド
    determineCurrentPhase() {
        // データセット統計に基づいてフェーズを判定
        const stats = this.datasetStats;
        const total = (stats.male_count || 0) + (stats.female_count || 0);
        
        if (total < 10) {
            this.currentPhase = 'preparation';
        } else if (this.learningResults) {
            this.currentPhase = 'analysis';
        } else {
            this.currentPhase = 'preparation';
        }
        
        this.updatePhaseDisplay();
    }

    isPhaseCompleted(phase) {
        switch (phase) {
            case 'preparation':
                const total = (this.datasetStats.male_count || 0) + (this.datasetStats.female_count || 0);
                return total >= 10;
            case 'training':
                return this.learningResults != null;
            case 'analysis':
                return false; // 分析フェーズは常に継続可能
            default:
                return false;
        }
    }

    // ===== ユーティリティメソッド =====

    setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    }

    showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.classList.remove('d-none');
    }

    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.classList.add('d-none');
    }

    showSuccessMessage(message) {
        console.log('成功:', message);
        this.showUserMessage(message, 'success');
    }

    showError(message) {
        console.error('エラー:', message);
        this.showUserMessage(message, 'danger');
    }

    showUserMessage(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 1060; max-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        // 自動削除
        setTimeout(() => alertDiv.remove(), 5000);
    }

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

    getStatusAlertClass(status) {
        switch (status) {
            case 'completed': return 'alert-success';
            case 'failed':
            case 'error': return 'alert-danger';
            default: return 'alert-info';
        }
    }

    // 追加のUI更新メソッドは必要に応じて実装
    showUploadProgress(progress) {
        const container = document.getElementById('upload-progress');
        const bar = document.getElementById('upload-progress-bar');
        if (container && bar) {
            container.classList.remove('d-none');
            bar.style.width = `${progress}%`;
        }
    }

    hideUploadProgress() {
        const container = document.getElementById('upload-progress');
        if (container) container.classList.add('d-none');
    }

    updateTrainingDetails() {
        const stats = this.datasetStats;
        this.setElementText('training-male-count', stats.male_count || 0);
        this.setElementText('training-female-count', stats.female_count || 0);
        this.setElementText('training-annotated-count', stats.annotation_count || 0);
    }

    updateTrainingProgress(progress, message) {
        const bar = document.getElementById('training-progress-bar');
        const text = document.getElementById('training-status-text');
        
        if (bar) {
            bar.style.width = `${progress}%`;
            bar.textContent = `${Math.round(progress)}%`;
        }
        if (text) text.textContent = message;
    }

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

    showTrainingPhase() {
        this.hideElement('data-preparation-section');
        this.showElement('training-section');
        this.hideElement('analysis-section');
    }

    showAnalysisPhase() {
        this.hideElement('data-preparation-section');
        this.hideElement('training-section');  
        this.showElement('analysis-section');
    }

    async startNewIteration() {
        this.currentPhase = 'preparation';
        this.taskId = null;
        this.learningResults = null;
        
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        this.updatePhaseDisplay();
        await this.refreshDatasetStats();
        
        this.showSuccessMessage('新しい学習サイクルを開始します');
    }

    async loadLearningHistory() {
        try {
            const response = await fetch('/learning/learning-history');
            if (response.ok) {
                const data = await response.json();
                this.displayLearningHistory(data.history || []);
            }
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
        }
    }

    displayLearningHistory(history) {
        const container = document.getElementById('unified-learning-history');
        if (!container || history.length === 0) return;
        
        const historyHTML = history.slice(0, 5).map(item => {
            const accuracy = (item.accuracy * 100).toFixed(1);
            return `
                <div class="border-bottom py-2">
                    <div class="d-flex justify-content-between">
                        <span><strong>${item.type}:</strong> ${accuracy}%</span>
                        <small class="text-muted">${item.date}</small>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHTML;
    }
}

// ===========================================
// アノテーションツール
// ===========================================

// モジュール内のデータを保持するための変数
const annotationTools = {
    selectedCard: null,
    canvas: null,
    context: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentTool: 'pen',
    toolSize: 5,
};

/**
 * アノテーションモーダルを開く
 * @param {string} paramImagePath - 画像パス
 */
function openAnnotationModal(paramImagePath) {
    console.log('アノテーションモーダルを開く:', paramImagePath);
    
    if (!paramImagePath) {
        alert('サンプル画像が指定されていません');
        return;
    }
    
    // 擬似カードオブジェクトを作成
    annotationTools.selectedCard = {
        dataset: {
            path: paramImagePath
        }
    };
    
    // モーダルを作成
    createAnnotationModal();
    
    // Bootstrapモーダルを初期化して表示
    const annotationModal = new bootstrap.Modal(document.getElementById('annotationModal'));
    
    // キャンバスの設定
    setupAnnotationCanvas(annotationTools.selectedCard);
    
    // モーダルが閉じられたときのクリーンアップ
    document.getElementById('annotationModal').addEventListener('hidden.bs.modal', cleanupAnnotationModal);
    
    // モーダルを表示
    annotationModal.show();
}

/**
 * アノテーションモーダルのHTMLを作成
 */
function createAnnotationModal() {
    const modalHTML = `
    <div class="modal fade" id="annotationModal" tabindex="-1" aria-labelledby="annotationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="annotationModalLabel">生殖乳頭アノテーション</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info mb-3">
                        <i class="fas fa-info-circle me-2"></i>
                        生殖乳頭の周囲を赤いペンで囲んでください。複数の乳頭がある場合は、それぞれを個別に囲みます。
                    </div>
                    <div class="text-center mb-3">
                        <canvas id="annotationCanvas" style="max-width: 100%; border: 1px solid #ddd;"></canvas>
                    </div>
                    <div class="d-flex justify-content-center mb-3">
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-outline-primary" id="penTool">
                                <i class="fas fa-pen"></i> ペン
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="eraserTool">
                                <i class="fas fa-eraser"></i> 消しゴム
                            </button>
                            <button type="button" class="btn btn-outline-success" id="circleTool">
                                <i class="fas fa-circle"></i> 円形
                            </button>
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label for="toolSize" class="form-label">ツールサイズ: <span id="toolSizeValue">5</span>px</label>
                        <input type="range" class="form-range" id="toolSize" min="1" max="20" value="5">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-primary" id="saveAnnotation">
                        <i class="fas fa-save me-1"></i> 学習データとして保存
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * アノテーションキャンバスの設定
 * @param {object} selectedCard - 選択されたカード情報
 */
function setupAnnotationCanvas(selectedCard) {
    const canvas = document.getElementById('annotationCanvas');
    annotationTools.canvas = canvas;
    annotationTools.context = canvas.getContext('2d');
    
    // 画像の読み込み
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        // キャンバスのサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 画像を描画
        annotationTools.context.drawImage(img, 0, 0);
        
        // アノテーションツールの初期化
        initAnnotationToolButtons();
        initAnnotationEvents();
    };
    img.onerror = function() {
        console.error('画像の読み込みに失敗しました:', img.src);
        alert('画像の読み込みに失敗しました');
    };
    
    // 画像パスの整形
    let imagePath = selectedCard.dataset.path;
    
    // パスの先頭に/sampleを追加（必要に応じて）
    if (!imagePath.startsWith('/')) {
        imagePath = '/sample/' + imagePath;
    } else {
        imagePath = '/sample' + imagePath;
    }
    
    console.log('読み込む画像パス:', imagePath);
    img.src = imagePath;
}

/**
 * アノテーションツールのボタン初期化
 */
function initAnnotationToolButtons() {
    // ツール選択
    document.getElementById('penTool').addEventListener('click', function() {
        annotationTools.currentTool = 'pen';
        updateToolButtons();
    });
    
    document.getElementById('eraserTool').addEventListener('click', function() {
        annotationTools.currentTool = 'eraser';
        updateToolButtons();
    });
    
    document.getElementById('circleTool').addEventListener('click', function() {
        annotationTools.currentTool = 'circle';
        updateToolButtons();
    });
    
    // ツールサイズの変更
    document.getElementById('toolSize').addEventListener('input', function() {
        annotationTools.toolSize = parseInt(this.value);
        document.getElementById('toolSizeValue').textContent = annotationTools.toolSize;
    });
    
    // 保存ボタン
    document.getElementById('saveAnnotation').addEventListener('click', saveAnnotationData);
    
    // 初期状態のボタン更新
    updateToolButtons();
}

/**
 * ツールボタンの状態を更新
 */
function updateToolButtons() {
    document.getElementById('penTool').classList.remove('active');
    document.getElementById('eraserTool').classList.remove('active');
    document.getElementById('circleTool').classList.remove('active');
    
    if (annotationTools.currentTool === 'pen') {
        document.getElementById('penTool').classList.add('active');
    } else if (annotationTools.currentTool === 'eraser') {
        document.getElementById('eraserTool').classList.add('active');
    } else if (annotationTools.currentTool === 'circle') {
        document.getElementById('circleTool').classList.add('active');
    }
}

/**
 * アノテーションキャンバスのイベント初期化
 */
function initAnnotationEvents() {
    const canvas = annotationTools.canvas;
    
    // 描画開始
    canvas.addEventListener('mousedown', function(e) {
        annotationTools.isDrawing = true;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        annotationTools.lastX = (e.clientX - rect.left) * scaleX;
        annotationTools.lastY = (e.clientY - rect.top) * scaleY;
        
        if (annotationTools.currentTool === 'circle') {
            // 円ツールの場合は一時的な円を描画
            const ctx = annotationTools.context;
            ctx.beginPath();
            ctx.arc(annotationTools.lastX, annotationTools.lastY, annotationTools.toolSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
        }
    });
    
    // 描画中
    canvas.addEventListener('mousemove', function(e) {
        if (!annotationTools.isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const ctx = annotationTools.context;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = annotationTools.toolSize;
        
        if (annotationTools.currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            
            ctx.beginPath();
            ctx.moveTo(annotationTools.lastX, annotationTools.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (annotationTools.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            
            ctx.beginPath();
            ctx.moveTo(annotationTools.lastX, annotationTools.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        
        annotationTools.lastX = x;
        annotationTools.lastY = y;
    });
    
    // 描画終了
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // タッチデバイス対応
    enableTouchSupport(canvas);
}

/**
 * 描画停止処理
 */
function stopDrawing() {
    annotationTools.isDrawing = false;
    // 元の描画モードに戻す
    annotationTools.context.globalCompositeOperation = 'source-over';
}

/**
 * タッチデバイス対応の有効化
 * @param {HTMLCanvasElement} canvas - 対象のキャンバス要素
 */
function enableTouchSupport(canvas) {
    // タッチイベントをマウスイベントに変換
    function touchToMouse(touchEvent, mouseEventType) {
        touchEvent.preventDefault();
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        const mouseEvent = new MouseEvent(mouseEventType, {
            clientX: touch.clientX,
            clientY: touch.clientY,
            buttons: 1
        });
        canvas.dispatchEvent(mouseEvent);
    }
    
    canvas.addEventListener('touchstart', e => touchToMouse(e, 'mousedown'), { passive: false });
    canvas.addEventListener('touchmove', e => touchToMouse(e, 'mousemove'), { passive: false });
    canvas.addEventListener('touchend', e => touchToMouse(e, 'mouseup'), { passive: false });
    canvas.addEventListener('touchcancel', e => touchToMouse(e, 'mouseout'), { passive: false });
}

/**
 * アノテーションデータを保存
 */
function saveAnnotationData() {
    try {
        showLoading(); // ローディング表示を追加
        console.log('アノテーション保存開始');

        // キャンバスのデータをBase64形式で取得
        const annotationData = annotationTools.canvas.toDataURL('image/png');
        console.log('Base64データサイズ:', calculateImageSize(annotationData), 'KB');

        const selectedCard = annotationTools.selectedCard;
        console.log('選択カード:', selectedCard.dataset.path);

        // 画像データをサーバーに送信
        fetch('/learning/save-annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: annotationData,
                original_path: selectedCard.dataset.path
            })
        })
        .then(response => {
            console.log('サーバーレスポンスステータス:', response.status);
            if (!response.ok) {
                throw new Error('サーバーレスポンスが不正です');
            }
            return response.json();
        })
        .then(data => {
            hideLoading(); // ローディング表示を非表示
            console.log('アノテーション保存レスポンス:', data);
            
            if (data.error) {
                console.error('保存エラー:', data.error);
                alert('エラー: ' + data.error);
            } else {
                alert('アノテーションを保存しました');
                saveToSession('annotationSaved', true);
                console.log('保存成功フラグ設定');
                
                // モーダルを閉じる
                bootstrap.Modal.getInstance(document.getElementById('annotationModal')).hide();
                
                // 学習管理画面のデータ更新コールバック
                if (typeof window.onAnnotationSaved === 'function') {
                    window.onAnnotationSaved();
                }
            }
        })
        .catch(error => {
            hideLoading();
            console.error('保存エラー:', error);
            alert('保存中にエラーが発生しました: ' + error);
        });
    } catch (e) {
        hideLoading();
        console.error('アノテーション処理エラー:', e);
        alert('アノテーションの保存中にエラーが発生しました: ' + e);
    }
}

/**
 * アノテーションモーダルのクリーンアップ
 */
function cleanupAnnotationModal() {
    // リソースの解放やイベントリスナーの削除など
    annotationTools.canvas = null;
    annotationTools.context = null;
    annotationTools.isDrawing = false;
    
    // モーダル要素の削除
    document.getElementById('annotationModal').remove();
}

// ===========================================
// 評価システム（簡易版）
// ===========================================

// グローバル変数でChart.jsインスタンスを管理
let annotationChart = null;

/**
 * アノテーション分析結果の表示
 * @param {Object} data - 分析結果データ
 */
function displayAnnotationAnalysis(data) {
    console.log('アノテーション分析結果の表示開始:', data);
    
    // 重複実行を防ぐためのフラグチェック
    if (window.annotationAnalysisDisplayed) {
        console.log('アノテーション分析結果は既に表示済みです');
        return;
    }
    
    // 表示フラグを設定
    window.annotationAnalysisDisplayed = true;
    
    try {
        // データセット情報を表示
        updateAnnotationDatasetInfo(data);
       
        // アノテーション影響の画像
        updateAnnotationImpactImage(data);
       
        // アノテーションのインサイト
        updateAnnotationInsight(data);
    } catch (error) {
        console.error('アノテーション分析表示エラー:', error);
    }
    
    // 一定時間後にフラグをリセット
    setTimeout(() => {
        window.annotationAnalysisDisplayed = false;
    }, 5000);
}

/**
 * アノテーションデータセット情報の更新
 * @param {Object} data - 分析データ
 */
function updateAnnotationDatasetInfo(data) {
    const dataset = data.dataset || {};
   
    // アノテーション率
    const annotationRate = dataset.annotation_rate || 0;
    console.log('アノテーション率更新:', (annotationRate * 100).toFixed(1) + '%');
}

/**
 * アノテーション影響画像の更新
 * @param {Object} data - 分析データ
 */
function updateAnnotationImpactImage(data) {
    // 新しい画像配信ルートを使用
    if (data.images && data.images.annotation_impact) {
        const imgSrc = '/evaluation/images/' + data.images.annotation_impact;
        console.log('アノテーション影響画像:', imgSrc);
    } else {
        // 画像がない場合はデータからグラフを生成
        renderAnnotationChart(data.dataset || {});
    }
}

/**
 * アノテーションのインサイト更新
 * @param {Object} data - 分析データ
 */
function updateAnnotationInsight(data) {
    const dataset = data.dataset || {};
    const annotationRate = dataset.annotation_rate || 0;
    let insightMessage = '';
   
    if (annotationRate < 0.3) {
        insightMessage = 'アノテーション率が低いため、モデルの性能が十分に発揮されていない可能性があります。';
    } else if (annotationRate < 0.7) {
        insightMessage = 'アノテーションの割合は中程度です。より多くのアノテーションを追加することで、モデルの性能向上が期待できます。';
    } else {
        insightMessage = 'アノテーション率が高く、モデルの学習に十分なデータが提供されています。';
    }
   
    console.log('アノテーションインサイト:', insightMessage);
}

/**
 * データセット情報からグラフを描画（Chart.jsを使用）
 * @param {Object} dataset - データセット情報
 */
function renderAnnotationChart(dataset) {
    try {
        console.log('グラフ描画開始:', dataset);
        
        // 既存のChart.jsインスタンスがあれば完全に破棄
        if (annotationChart) {
            console.log('既存のChart.jsインスタンスを破棄中...');
            annotationChart.destroy();
            annotationChart = null;
        }
        
        // Chart.jsが読み込まれているか確認
        if (typeof Chart !== 'undefined') {
            console.log('Chart.jsが利用可能です');
            // ここでグラフを作成する処理を実装
        } else {
            console.log('Chart.js未読み込み - 代替表示を作成');
        }
        
    } catch (error) {
        console.error('アノテーショングラフ描画エラー:', error);
    }
}

// ===========================================
// グローバル初期化とエクスポート
// ===========================================

// グローバルインスタンス作成
window.unifiedLearningSystem = new UnifiedLearningSystem();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedLearningSystem.initialize();
});

// 必要な関数のグローバルエクスポート
window.openAnnotationModal = openAnnotationModal;
window.displayAnnotationAnalysis = displayAnnotationAnalysis;