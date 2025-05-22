/**
 * 統合学習システム - unified-learning-system.js
 * learning-management.jsを置き換える統一システム
 */

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
        // Toast表示またはアラート
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

    // 学習データ関連のヘルパーメソッド
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

// グローバルインスタンス作成
window.unifiedLearningSystem = new UnifiedLearningSystem();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedLearningSystem.initialize();
});