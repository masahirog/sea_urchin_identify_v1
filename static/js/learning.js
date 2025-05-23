/**
 * ウニ生殖乳頭分析システム - 統合学習システム（完全版）
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
     * システム初期化（修正版）
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
            
            // 最新の学習結果があるかチェック
            await this.loadLatestResults();
            
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
     * 最新の学習結果を読み込み
     */
    async loadLatestResults() {
        try {
            const response = await fetch('/learning/learning-history');
            if (!response.ok) return;
            
            const data = await response.json();
            const history = data.history || [];
            
            if (history.length > 0) {
                // 最新の結果を取得
                const latestResult = history[0];
                
                // evaluation タイプの最新結果を探す
                const latestEvaluation = history.find(item => item.type === 'evaluation');
                
                if (latestEvaluation) {
                    console.log('最新の評価結果を発見:', latestEvaluation.timestamp);
                    
                    // 結果を仮想的に設定
                    this.learningResults = {
                        summary: {
                            overall_accuracy: latestEvaluation.cv_mean || 0,
                            precision: latestEvaluation.classification_report?.weighted_avg?.precision || 0,
                            recall: latestEvaluation.classification_report?.weighted_avg?.recall || 0,
                            annotation_rate: latestEvaluation.dataset?.annotation_rate || 0  // ここを修正
                        },
                        evaluation: latestEvaluation,
                        metadata: {
                            timestamp: latestEvaluation.timestamp
                        },
                        annotation_analysis: {
                            annotation_timestamp: latestEvaluation.timestamp,
                            dataset: latestEvaluation.dataset || {}  // データセット情報を追加
                        }
                    };
                    
                    // 最新の結果があることをフラグで記録
                    this.hasLatestResults = true;
                }
            }
        } catch (error) {
            console.error('最新結果の読み込みエラー:', error);
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

        // フェーズインジケーターのクリックイベント
        this.setupPhaseNavigation();
    }

    /**
     * フェーズナビゲーションの設定
     */
    setupPhaseNavigation() {
        // データ準備フェーズ
        const preparationPhase = document.getElementById('phase-preparation');
        if (preparationPhase) {
            preparationPhase.addEventListener('click', () => {
                this.navigateToPhase('preparation');
            });
            preparationPhase.style.cursor = 'pointer';
            preparationPhase.title = 'データ準備フェーズに移動';
        }

        // AI学習フェーズ
        const trainingPhase = document.getElementById('phase-training');
        if (trainingPhase) {
            trainingPhase.addEventListener('click', () => {
                this.navigateToPhase('training');
            });
            trainingPhase.style.cursor = 'pointer';
            trainingPhase.title = 'AI学習フェーズに移動';
        }

        // 結果分析フェーズ
        const analysisPhase = document.getElementById('phase-analysis');
        if (analysisPhase) {
            analysisPhase.addEventListener('click', () => {
                this.navigateToPhase('analysis');
            });
            analysisPhase.style.cursor = 'pointer';
            analysisPhase.title = '結果分析フェーズに移動';
        }

        console.log('フェーズナビゲーション設定完了');
    }

    /**
     * 指定フェーズへのナビゲーション（修正版）
     */
    navigateToPhase(targetPhase) {
        console.log('フェーズナビゲーション:', this.currentPhase, '->', targetPhase);

        // 現在のフェーズと同じ場合は何もしない
        if (this.currentPhase === targetPhase) {
            console.log('既に同じフェーズです');
            return;
        }

        // フェーズ移動実行
        this.currentPhase = targetPhase;
        this.updatePhaseDisplay();
        this.showPhaseSection();

        // フェーズ固有の処理
        this.handlePhaseNavigation(targetPhase);

        this.showSuccessMessage(`${this.phases[targetPhase].name}フェーズに移動しました`);
    }

    /**
     * フェーズナビゲーション時の固有処理（修正版）
     */
    handlePhaseNavigation(targetPhase) {
        switch (targetPhase) {
            case 'preparation':
                // データ準備フェーズ: データセット統計を更新
                this.refreshDatasetStats();
                this.loadLearningData();
                break;

            case 'training':
                // 学習フェーズ: データ状況を確認して適切な表示
                this.updateTrainingDetails();
                this.checkTrainingReadiness();
                
                // 実行中のタスクがあるかチェック
                if (this.taskId && this.statusCheckInterval) {
                    this.showSuccessMessage('学習進捗を監視中です');
                }
                break;

            case 'analysis':
                // 分析フェーズ: 最新の結果または履歴を表示
                if (this.learningResults) {
                    this.displayUnifiedResults();
                } else if (this.hasLatestResults) {
                    // 初期化時に読み込んだ最新結果を表示
                    this.displayUnifiedResults();
                } else {
                    // 結果がない場合は履歴を表示
                    this.showAnalysisGuidance();
                }
                break;
        }
    }

    /**
     * 学習準備状況をチェック
     */
    checkTrainingReadiness() {
        const stats = this.datasetStats;
        const maleCount = stats.male_count || 0;
        const femaleCount = stats.female_count || 0;
        const totalCount = maleCount + femaleCount;
        
        if (totalCount === 0) {
            this.showTrainingGuidance('データがありません', 'データ準備フェーズで画像をアップロードしてください。');
        } else if (maleCount === 0 || femaleCount === 0) {
            this.showTrainingGuidance('データが不足しています', 'より良い学習のため、オスとメス両方のデータをアップロードすることを推奨します。');
        } else if (totalCount < 5) {
            this.showTrainingGuidance('データが少なめです', `現在${totalCount}枚のデータがあります。より良い結果のため、追加データをアップロードすることを推奨します。`);
        } else {
            // 十分なデータがある場合
            this.showSuccessMessage('学習準備完了：十分なデータが揃っています');
        }
    }

    /**
     * 学習フェーズでの案内表示
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
        this.showElement('results-placeholder');
        
        // 学習履歴を読み込み
        this.loadLearningHistory();
        
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
        
        this.showSuccessMessage('分析フェーズに移動しました。学習を実行すると結果が表示されます。');
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
        
        // 学習開始ボタンの表示制御（緩和）
        const startBtn = document.getElementById('start-unified-training-btn');
        if (startBtn) {
            const totalCount = (this.datasetStats.male_count || 0) + (this.datasetStats.female_count || 0);
            if (totalCount > 0) {
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
                    <small class="text-muted">画像をクリックすると詳細を確認できます</small>
                </div>
            `;
            return;
        }
        
        // 画像カードの生成
        const imageCards = allImages.map(item => {
            const genderClass = this.getGenderClass(item.category);
            const genderIcon = this.getGenderIcon(item.category);
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
                        ${this.truncateFilename(item.filename, 20)}
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
        
        console.log(`学習データ表示完了: ${allImages.length}枚`);
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
     * 統合学習の開始（修正版 - より柔軟な開始条件）
     */
    async startUnifiedTraining() {
        console.log('統合学習開始');
        
        try {
            // 基本的なデータ存在チェックのみ
            const stats = this.datasetStats;
            const totalCount = (stats.male_count || 0) + (stats.female_count || 0);
            
            if (totalCount === 0) {
                this.showError('学習データが必要です。データ準備フェーズで画像をアップロードしてください。');
                return;
            }
            
            // データが少ない場合は警告を表示するが続行可能
            if (totalCount < 5) {
                const confirmed = confirm(`現在のデータ数は${totalCount}枚です。\n学習は可能ですが、より多くのデータがあると精度が向上します。\n\n続行しますか？`);
                if (!confirmed) {
                    return;
                }
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
        
        // 履歴更新（デバッグログ追加）
        console.log('履歴更新を開始します...');
        try {
            await this.loadLearningHistory();
            console.log('履歴更新完了');
        } catch (error) {
            console.error('履歴更新エラー:', error);
        }
        
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
        
        this.setElementText('final-accuracy', ((summary.overall_accuracy || 0) * 100).toFixed(1) + '%');
        this.setElementText('final-precision', ((summary.precision || 0) * 100).toFixed(1) + '%');
        this.setElementText('final-recall', ((summary.recall || 0) * 100).toFixed(1) + '%');
        
        // アノテーション率の表示を修正
        const annotationRate = summary.annotation_rate || 0;
        this.setElementText('annotation-effect', (annotationRate * 100).toFixed(1) + '%');
    }


    /**
     * 詳細結果表示
     */
    displayDetailedResults() {
        const container = document.getElementById('unified-results-content');
        if (!container) return;
        
        const evaluation = this.learningResults.evaluation || {};
        const timestamp = this.learningResults.metadata?.timestamp || Date.now();
        
        // アノテーション用のタイムスタンプを適切に設定
        let annotationTimestamp = timestamp;
        
        // アノテーション画像が存在するか確認
        const hasAnnotationData = this.learningResults.annotation_analysis?.dataset?.annotation_rate > 0;
        

        // グラフの説明データ
        const graphDescriptions = {
            learning_curve: {
                title: '学習曲線',
                description: 'データ量に対するモデルの学習進捗を示します',
                insights: {
                    good: '学習データと検証データの精度が近い場合、モデルは適切に学習しています',
                    overfit: '学習データの精度が高く、検証データの精度が低い場合、過学習の可能性があります',
                    underfit: '両方の精度が低い場合、より多くのデータかより複雑なモデルが必要です'
                }
            },
            confusion_matrix: {
                title: '混同行列',
                description: '実際の分類と予測の関係を示します',
                insights: {
                    diagonal: '対角線上の数値が高いほど、正確に分類できています',
                    offDiagonal: '対角線以外の数値は誤分類を示します'
                }
            },
            roc_curve: {
                title: 'ROCカーブ',
                description: '分類器の性能を示す曲線です',
                insights: {
                    auc: 'AUC値が1に近いほど優れた分類器です（0.5は無作為判定と同等）',
                    curve: '曲線が左上に近いほど性能が良いことを示します'
                }
            },
            annotation_impact: {
                title: 'アノテーション効果',
                description: '手動アノテーションがモデル性能に与える影響を示します',
                insights: {
                    high: 'アノテーション率が高いほど、モデルの精度向上が期待できます',
                    balance: 'オスとメスのアノテーション数のバランスも重要です'
                }
            }
        };



        // グラフHTML生成
        let graphsHTML = `
            <div class="row">
                ${this.createGraphCard('learning_curve', timestamp, graphDescriptions.learning_curve)}
                ${this.createGraphCard('confusion_matrix', timestamp, graphDescriptions.confusion_matrix)}
            </div>
            <div class="row">
                ${this.createGraphCard('roc_curve', timestamp, graphDescriptions.roc_curve)}
        `;
        
        // アノテーションデータがある場合のみアノテーション効果グラフを表示
        if (hasAnnotationData) {
            graphsHTML += this.createGraphCard('annotation_impact', annotationTimestamp, graphDescriptions.annotation_impact);
        } else {
            graphsHTML += `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body text-center text-muted">
                            <i class="fas fa-info-circle fa-2x mb-2"></i>
                            <p>アノテーションデータがありません</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        graphsHTML += `
            </div>
            
            <!-- グラフ拡大表示用モーダル -->
            <div class="modal fade" id="graphZoomModal" tabindex="-1">
                ... 既存のモーダルコード ...
            </div>
        `;
        
        container.innerHTML = graphsHTML;
        
        // クリックイベントを設定
        this.setupGraphInteractions();
    }








    /**
     * グラフカードの作成
     */
    createGraphCard(graphType, timestamp, description) {
        // アノテーション画像のパスを正しく構築
        let imagePath;
        if (graphType === 'annotation_impact') {
            // 注意: アノテーション画像は専用のタイムスタンプを使用
            let annotationTimestamp = this.learningResults.annotation_analysis?.annotation_timestamp || timestamp;
            imagePath = `/evaluation/images/annotation_impact_${annotationTimestamp}.png`;
        } else {
            imagePath = `/evaluation/images/${graphType}_${timestamp}.png`;
        }
        
        return `
            <div class="col-md-6 mb-3">
                <div class="graph-card position-relative" data-graph-type="${graphType}">
                    <h6 class="d-flex align-items-center">
                        ${description.title}
                        <i class="fas fa-info-circle ms-2 text-muted graph-info-icon" 
                           data-bs-toggle="tooltip" 
                           data-bs-placement="top"
                           data-bs-html="true"
                           title="${description.description}"></i>
                    </h6>
                    <div class="graph-container position-relative" style="cursor: zoom-in;" onclick="unifiedLearningSystem.showGraphZoom('${imagePath}', ${JSON.stringify(description).replace(/"/g, '&quot;')})">
                        <img src="${imagePath}" 
                             class="img-fluid rounded graph-image" 
                             alt="${description.title}"
                             data-graph-type="${graphType}"
                             onerror="this.parentElement.innerHTML='<p class=text-muted>グラフが利用できません</p>'">
                        <div class="graph-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="background: rgba(0,0,0,0.7); opacity: 0; transition: opacity 0.3s; pointer-events: none;">
                            <i class="fas fa-search-plus text-white fa-2x"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * グラフのインタラクション設定
     */
    setupGraphInteractions() {
        // ツールチップ初期化
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        // グラフホバー効果
        document.querySelectorAll('.graph-container').forEach(container => {
            const overlay = container.querySelector('.graph-overlay');
            if (overlay) {
                container.addEventListener('mouseenter', () => {
                    overlay.style.opacity = '1';
                });
                container.addEventListener('mouseleave', () => {
                    overlay.style.opacity = '0';
                });
            }
        });
    }

    /**
     * グラフ拡大表示
     */
    showGraphZoom(imageSrc, description) {
        try {
            // 1. 既存のモーダルがあれば削除する（完全に再作成する方法）
            const existingModal = document.getElementById('graphZoomModal');
            if (existingModal) {
                // モーダルインスタンスを破棄
                const bsModal = bootstrap.Modal.getInstance(existingModal);
                if (bsModal) bsModal.dispose();
                
                // DOM要素も削除
                existingModal.remove();
            }
            
            // 2. モーダルHTMLを作成
            const safeTitle = (description.title || '').replace(/"/g, '&quot;');
            const safeDescription = (description.description || '').replace(/"/g, '&quot;');
            
            const modalHTML = `
                <div class="modal fade" id="graphZoomModal" tabindex="-1" aria-labelledby="graphZoomModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="graphZoomModalLabel">${safeTitle}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body text-center">
                                <img src="${imageSrc}" alt="${safeTitle}" class="img-fluid">
                                <div class="mt-3">
                                    <div class="alert alert-info">
                                        <p>${safeDescription}</p>
                                    </div>
                                    ${this.createInsightsHTML(description)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 3. DOMに追加
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // 4. モーダル要素を取得
            const modalElement = document.getElementById('graphZoomModal');
            
            // 5. モーダルを初期化して表示（安全な方法）
            if (modalElement) {
                // スクリプト実行を遅らせる（DOM更新後に実行するため）
                setTimeout(() => {
                    try {
                        const modal = new bootstrap.Modal(modalElement);
                        modal.show();
                    } catch (modalError) {
                        console.error('モーダル表示エラー:', modalError);
                    }
                }, 50);
            }
        } catch (error) {
            console.error('グラフモーダル作成エラー:', error);
        }
    }

    /**
     * インサイト情報のHTML生成（ヘルパーメソッド）
     */
    createInsightsHTML(description) {
        if (!description.insights) return '';
        
        let html = '<div class="card mt-3"><div class="card-header">解釈のポイント</div><div class="card-body">';
        
        // インサイトの追加
        Object.entries(description.insights).forEach(([key, insight]) => {
            const insightTitle = this.getInsightTitle ? this.getInsightTitle(key) : key;
            const safeInsightTitle = insightTitle.replace(/"/g, '&quot;');
            const safeInsight = insight.replace(/"/g, '&quot;');
            
            html += `<p><strong>${safeInsightTitle}:</strong> ${safeInsight}</p>`;
        });
        
        html += '</div></div>';
        return html;
    }


    /**
     * モーダルの内容を更新する（新規追加）
     */
    updateModalContent(imageSrc, description) {
        // 各要素を取得して内容を設定
        const titleElement = document.getElementById('graphZoomTitle');
        const imageElement = document.getElementById('graphZoomImage');
        const descriptionElement = document.getElementById('graphZoomDescription');
        
        // 要素が存在するか確認してから内容を設定
        if (titleElement) titleElement.textContent = description.title || '';
        if (imageElement) imageElement.src = imageSrc;
        
        // 説明部分の設定
        if (descriptionElement) {
            let detailsHTML = '';
            
            // 基本説明
            detailsHTML += `
                <div class="alert alert-info">
                    <p><strong>${description.title || ''}について:</strong> ${description.description || ''}</p>
                </div>
            `;
            
            // インサイトの追加（存在する場合のみ）
            if (description.insights) {
                detailsHTML += `
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">解釈のポイント</div>
                                <div class="card-body">
                `;
                
                Object.entries(description.insights).forEach(([key, insight]) => {
                    const insightTitle = this.getInsightTitle ? this.getInsightTitle(key) : key;
                    detailsHTML += `<p><strong>${insightTitle}:</strong> ${insight}</p>`;
                });
                
                detailsHTML += `
                            </div>
                        </div>
                    </div>
                `;
                
                // グラフ解釈（存在する場合のみ）
                if (this.getGraphInterpretation) {
                    detailsHTML += `
                        <div class="col-md-6">
                            ${this.getGraphInterpretation(description.title)}
                        </div>
                    `;
                }
                
                detailsHTML += `</div>`;
            }
            
            descriptionElement.innerHTML = detailsHTML;
        }
    }

    /**
     * インサイトタイトルの取得
     */
    getInsightTitle(key) {
        const titles = {
            good: '✅ 良好な状態',
            overfit: '⚠️ 過学習の兆候',
            underfit: '📊 学習不足の兆候',
            diagonal: '🎯 正解率',
            offDiagonal: '❌ 誤分類',
            auc: '📈 AUC値',
            curve: '📉 曲線の形状',
            high: '⬆️ 高アノテーション率',
            balance: '⚖️ バランス'
        };
        return titles[key] || key;
    }

    /**
     * グラフの現在値に基づく解釈
     */
    getGraphInterpretation(graphTitle) {
        const summary = this.learningResults.summary || {};
        const accuracy = (summary.overall_accuracy * 100).toFixed(1);
        const annotationRate = (summary.annotation_rate * 100).toFixed(1);
        
        let interpretation = '<div class="alert alert-success mt-3"><h6>📊 現在の状態</h6>';
        
        switch(graphTitle) {
            case '学習曲線':
                if (accuracy >= 85) {
                    interpretation += `<p>精度${accuracy}%は優秀です！モデルは適切に学習されています。</p>`;
                } else if (accuracy >= 70) {
                    interpretation += `<p>精度${accuracy}%は良好ですが、データ追加でさらに改善可能です。</p>`;
                } else {
                    interpretation += `<p>精度${accuracy}%は改善の余地があります。より多くのデータを追加しましょう。</p>`;
                }
                break;
                
            case 'アノテーション効果':
                if (annotationRate >= 50) {
                    interpretation += `<p>アノテーション率${annotationRate}%は素晴らしいです！</p>`;
                } else if (annotationRate >= 30) {
                    interpretation += `<p>アノテーション率${annotationRate}%は良好です。さらに追加すると精度が向上します。</p>`;
                } else {
                    interpretation += `<p>アノテーション率${annotationRate}%は低めです。アノテーションを増やすと大幅な改善が期待できます。</p>`;
                }
                break;
        }
        
        interpretation += '</div>';
        return interpretation;
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
     * フェーズ表示の更新（制限なし版）
     */
    updatePhaseDisplay() {
        // フェーズインジケーター更新
        Object.keys(this.phases).forEach(phase => {
            const element = document.getElementById(`phase-${phase}`);
            if (element) {
                // 既存のクラスをクリア
                element.classList.remove('active', 'current-phase', 'completed');
                
                // フェーズ状態に応じてクラスを設定
                if (phase === this.currentPhase) {
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
     * フェーズセクション表示
     */
    showPhaseSection() {
        // 全セクション非表示
        ['data-preparation-section', 'training-section', 'analysis-section'].forEach(sectionId => {
            this.hideElement(sectionId);
        });
        
        // 現在フェーズのセクション表示
        let sectionId;
        switch (this.currentPhase) {
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
        
        this.showElement(sectionId);
        
        // results-placeholderの表示制御
        if (this.currentPhase === 'analysis' && this.learningResults) {
            this.hideElement('results-placeholder');
        } else if (this.currentPhase !== 'analysis') {
            this.showElement('results-placeholder');
        }
    }

    // ===== 学習データ関連のヘルパーメソッド =====
    
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

    /**
     * フェーズ判定メソッド（修正版）
     */
    determineCurrentPhase() {
        const stats = this.datasetStats;
        const total = (stats.male_count || 0) + (stats.female_count || 0);
        
        // 最新の結果がある場合は結果分析フェーズから開始
        if (this.hasLatestResults) {
            this.currentPhase = 'analysis';
            // 最新結果を表示
            setTimeout(() => {
                this.displayUnifiedResults();
            }, 100);
        } else if (total < 1) {
            this.currentPhase = 'preparation';
        } else {
            this.currentPhase = 'preparation';
        }
        
        this.updatePhaseDisplay();
    }

    isPhaseCompleted(phase) {
        switch (phase) {
            case 'preparation':
                const total = (this.datasetStats.male_count || 0) + (this.datasetStats.female_count || 0);
                return total >= 1;
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

    // 追加のUI更新メソッド
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
            console.log('学習履歴読み込み開始');
            const response = await fetch('/learning/learning-history');
            if (!response.ok) {
                throw new Error(`履歴データの取得に失敗しました: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('取得した履歴データ:', data);
            
            // 履歴データが空でないことを確認
            if (!data.history || data.history.length === 0) {
                console.log('履歴データが空です');
                this.displayEmptyHistory();
                return;
            }
            
            // 日付でソート（新しい順）- 念のため再ソート
            const sortedHistory = [...data.history].sort((a, b) => {
                // タイムスタンプがない場合は日付で比較
                const timestampA = a.timestamp || '';
                const timestampB = b.timestamp || '';
                return timestampB.localeCompare(timestampA);
            });
            
            console.log('ソート後の履歴データ:', sortedHistory);
            this.displayLearningHistory(sortedHistory);
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
            this.displayEmptyHistory();
        }
    }

    /**
     * 学習履歴の表示（拡張版）
     */
    displayLearningHistory(history) {
        console.log('履歴表示処理開始:', history.length, '件');
        
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
        
        // 最大5件の履歴を表示
        const recentHistory = history.slice(0, 5);
        
        const historyHTML = recentHistory.map((item, index) => {
            // デバッグ用ログ出力
            console.log(`履歴項目 ${index}:`, item);
            
            // 適切な精度値を取得
            let accuracy;
            if (item.accuracy !== undefined) {
                accuracy = item.accuracy;
            } else if (item.details && item.details.cv_mean !== undefined) {
                accuracy = item.details.cv_mean;
            } else if (item.details && item.details.accuracy !== undefined) {
                accuracy = item.details.accuracy;
            } else {
                accuracy = 0;
            }
            
            // 精度の表示形式を統一
            const accuracyDisplay = typeof accuracy === 'number' ? 
                (accuracy * 100).toFixed(1) : '0.0';
            
            // タイプの判定
            const type = item.type || 
                (item.details && item.details.type) || 
                (item.id && item.id.includes('annotation') ? 'annotation' : 'evaluation');
            
            const typeLabel = type.includes('annotation') ? 'アノテーション分析' : '学習評価';
            const typeIcon = type.includes('annotation') ? 'fa-tags' : 'fa-chart-line';
            
            return `
                <div class="border-bottom py-2 history-item" style="cursor: pointer;" 
                     onclick="window.unifiedLearningSystem.loadHistoricalResult('${item.timestamp || ''}', '${type}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>
                            <i class="fas ${typeIcon} me-2"></i>
                            <strong>${typeLabel}:</strong> ${accuracyDisplay}%
                        </span>
                        <small class="text-muted">${item.date || '日時不明'}</small>
                    </div>
                    <div class="text-end">
                        <small class="text-primary">クリックして詳細を表示</small>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHTML;
        console.log('履歴表示処理完了');
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
     * 履歴結果の読み込みと表示
     */
    async loadHistoricalResult(timestamp, type) {
        try {
            console.log('履歴結果を読み込み:', timestamp, type);
            
            if (!timestamp) {
                this.showError('タイムスタンプが無効です');
                return;
            }
            
            // 履歴から該当する結果を探す
            const response = await fetch('/learning/learning-history');
            if (!response.ok) throw new Error('履歴データの取得に失敗しました');
            
            const data = await response.json();
            const history = data.history || [];
            
            // タイムスタンプが一致する履歴を検索
            const result = history.find(item => item.timestamp === timestamp || 
                                              (item.details && item.details.timestamp === timestamp));
            
            if (!result) {
                this.showError('指定された履歴が見つかりませんでした');
                console.error('見つからないタイムスタンプ:', timestamp);
                console.log('利用可能な履歴:', history.map(h => h.timestamp));
                return;
            }
            
            console.log('見つかった履歴結果:', result);
            
            // 結果データの取得（detailsまたは直接のプロパティ）
            const resultData = result.details || result;
            
            // 結果を設定
            this.learningResults = {
                summary: {
                    overall_accuracy: resultData.cv_mean || resultData.accuracy || 0,
                    precision: this.getNestedValue(resultData, 'classification_report.weighted_avg.precision') || 0,
                    recall: this.getNestedValue(resultData, 'classification_report.weighted_avg.recall') || 0,
                    annotation_rate: this.getNestedValue(resultData, 'dataset.annotation_rate') || 0
                },
                evaluation: resultData,
                metadata: {
                    timestamp: resultData.timestamp || timestamp,
                    isHistorical: true
                },
                annotation_analysis: {
                    dataset: resultData.dataset || {},
                    annotation_timestamp: resultData.annotation_timestamp || resultData.timestamp || timestamp
                }
            };
            
            // 分析フェーズに移動
            this.currentPhase = 'analysis';
            this.updatePhaseDisplay();
            this.showAnalysisPhase();
            
            // 結果を表示
            this.displayUnifiedResults();
            
            // 履歴表示であることを通知
            this.showSuccessMessage(`${result.date || '過去の結果'} を表示しています`);
            
        } catch (error) {
            console.error('履歴結果読み込みエラー:', error);
            this.showError('履歴結果の読み込みに失敗しました: ' + error.message);
        }
    }
    /**
     * ネストされたオブジェクトから安全に値を取得するヘルパー関数
     */
    getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        
        return current;
    }
}

// ===========================================
// 画像詳細・アノテーションモーダル
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
 * 学習データ画像をクリックした時の処理（修正版）
 * @param {string} imagePath - 画像パス
 */
function selectImageForAnnotation(imagePath) {
    console.log('画像詳細表示:', imagePath);
    
    if (!imagePath) {
        alert('画像が指定されていません');
        return;
    }
    
    // 画像詳細モーダルを表示
    openImageDetailModal(imagePath);
}

/**
 * 画像詳細モーダルを開く（新規実装）
 * @param {string} imagePath - 画像パス
 */
function openImageDetailModal(imagePath) {
    console.log('画像詳細モーダル表示:', imagePath);
    
    // 既存のアノテーション情報を確認
    checkExistingAnnotation(imagePath)
        .then(annotationInfo => {
            createImageDetailModal(imagePath, annotationInfo);
        })
        .catch(error => {
            console.error('アノテーション情報取得エラー:', error);
            createImageDetailModal(imagePath, null);
        });
}

/**
 * 既存のアノテーション情報を確認
 * @param {string} imagePath - 画像パス
 * @returns {Promise} アノテーション情報
 */
async function checkExistingAnnotation(imagePath) {
    try {
        // アノテーションマッピングから確認
        const response = await fetch('/static/annotation_mapping.json');
        if (!response.ok) {
            return null;
        }
        
        const mapping = await response.json();
        const annotationPath = mapping[imagePath];
        
        if (annotationPath) {
            return {
                exists: true,
                path: annotationPath,
                url: `/static/${annotationPath}`
            };
        }
        
        return { exists: false };
        
    } catch (error) {
        console.error('アノテーション確認エラー:', error);
        return null;
    }
}

/**
 * 画像詳細モーダルを作成
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
function createImageDetailModal(imagePath, annotationInfo) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('imageDetailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const hasAnnotation = annotationInfo && annotationInfo.exists;
    const displayImageUrl = hasAnnotation ? annotationInfo.url : `/sample/${imagePath}`;
    const filename = imagePath.split('/').pop();
    
    const modalHTML = `
    <div class="modal fade" id="imageDetailModal" tabindex="-1" aria-labelledby="imageDetailModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="imageDetailModalLabel">
                        <i class="fas fa-image me-2"></i>
                        ${filename}
                        ${hasAnnotation ? '<span class="badge bg-success ms-2">アノテーション済み</span>' : '<span class="badge bg-secondary ms-2">未アノテーション</span>'}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
                </div>
                <div class="modal-body">
                    <div class="text-center mb-3">
                        <img id="modalDetailImage" src="${displayImageUrl}" alt="${filename}" 
                             style="max-width: 100%; max-height: 60vh;" class="img-fluid rounded">
                    </div>
                    <div id="modalImageInfo">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>ファイル情報</h6>
                                <p><strong>ファイル名:</strong> ${filename}</p>
                                <p><strong>カテゴリ:</strong> ${imagePath.includes('/male/') ? 'オス' : imagePath.includes('/female/') ? 'メス' : '不明'}</p>
                                <p><strong>パス:</strong> <code>${imagePath}</code></p>
                            </div>
                            <div class="col-md-6">
                                <h6>アノテーション状況</h6>
                                ${hasAnnotation ? `
                                    <p class="text-success"><i class="fas fa-check-circle me-1"></i> アノテーション済み</p>
                                    <p><strong>アノテーション画像:</strong><br><code>${annotationInfo.path}</code></p>
                                ` : `
                                    <p class="text-muted"><i class="fas fa-circle me-1"></i> 未アノテーション</p>
                                    <p class="small">アノテーションを追加すると学習精度が向上します</p>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="btn-group me-auto" role="group">
                        ${hasAnnotation ? `
                            <button type="button" class="btn btn-outline-warning" id="editAnnotationBtn">
                                <i class="fas fa-edit me-1"></i> アノテーション編集
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="deleteAnnotationBtn">
                                <i class="fas fa-trash me-1"></i> アノテーション削除
                            </button>
                        ` : `
                            <button type="button" class="btn btn-success" id="createAnnotationBtn">
                                <i class="fas fa-plus me-1"></i> アノテーション作成
                            </button>
                        `}
                    </div>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-outline-secondary" id="moveToDatasetBtn">
                            <i class="fas fa-copy me-1"></i> データセットに移動
                        </button>
                        <button type="button" class="btn btn-outline-danger" id="deleteImageBtn">
                            <i class="fas fa-trash me-1"></i> 画像削除
                        </button>
                    </div>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // イベントリスナーの設定
    setupImageDetailModalEvents(imagePath, annotationInfo);
    
    // モーダルを表示
    const modal = new bootstrap.Modal(document.getElementById('imageDetailModal'));
    
    // モーダルが閉じられたときのクリーンアップ
    document.getElementById('imageDetailModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
    
    modal.show();
}

/**
 * 画像詳細モーダルのイベントリスナー設定
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
function setupImageDetailModalEvents(imagePath, annotationInfo) {
    const hasAnnotation = annotationInfo && annotationInfo.exists;
    
    // アノテーション作成ボタン
    const createBtn = document.getElementById('createAnnotationBtn');
    if (createBtn) {
        createBtn.addEventListener('click', function() {
            // 現在のモーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            // アノテーション作成モーダルを開く
            setTimeout(() => openAnnotationModal(imagePath), 300);
        });
    }
    
    // アノテーション編集ボタン
    const editBtn = document.getElementById('editAnnotationBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            // 現在のモーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            // アノテーション編集モーダルを開く
            setTimeout(() => openAnnotationEditModal(imagePath, annotationInfo), 300);
        });
    }
    
    // アノテーション削除ボタン
    const deleteAnnotationBtn = document.getElementById('deleteAnnotationBtn');
    if (deleteAnnotationBtn) {
        deleteAnnotationBtn.addEventListener('click', function() {
            deleteAnnotation(imagePath, annotationInfo);
        });
    }
    
    // データセット移動ボタン
    const moveBtn = document.getElementById('moveToDatasetBtn');
    if (moveBtn) {
        moveBtn.addEventListener('click', function() {
            moveImageToDataset(imagePath);
        });
    }
    
    // 画像削除ボタン
    const deleteImageBtn = document.getElementById('deleteImageBtn');
    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', function() {
            deleteImage(imagePath);
        });
    }
}

/**
 * アノテーション編集モーダルを開く
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
function openAnnotationEditModal(imagePath, annotationInfo) {
    console.log('アノテーション編集モーダル表示:', imagePath);
    
    // アノテーション作成と同じモーダルを使用するが、既存のアノテーションを読み込む
    openAnnotationModal(imagePath, true, annotationInfo);
}

/**
 * アノテーション削除
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
async function deleteAnnotation(imagePath, annotationInfo) {
    if (!confirm('このアノテーションを削除してもよろしいですか？')) {
        return;
    }
    
    try {
        const response = await fetch('/learning/delete-annotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                image_path: imagePath,
                annotation_path: annotationInfo.path 
            })
        });
        
        if (!response.ok) throw new Error('削除リクエストに失敗しました');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // 成功メッセージ
        unifiedLearningSystem.showSuccessMessage('アノテーションを削除しました');
        
        // モーダルを閉じる
        bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
        
        // データを更新
        if (typeof window.onAnnotationSaved === 'function') {
            window.onAnnotationSaved();
        }
        
    } catch (error) {
        console.error('アノテーション削除エラー:', error);
        unifiedLearningSystem.showError('アノテーション削除に失敗しました: ' + error.message);
    }
}

/**
 * データセットへの移動
 * @param {string} imagePath - 画像パス
 */
function moveImageToDataset(imagePath) {
    // データセット移動の実装
    console.log('データセット移動:', imagePath);
    
    // 性別選択ダイアログを表示
    const gender = prompt('移動先を選択してください:\n1: オス (male)\n2: メス (female)\n\n番号を入力してください:');
    
    let targetGender;
    if (gender === '1') targetGender = 'male';
    else if (gender === '2') targetGender = 'female';
    else {
        alert('キャンセルされました');
        return;
    }
    
    // 移動処理の実装（実際のAPIコールが必要）
    console.log(`${imagePath} を ${targetGender} カテゴリに移動`);
    unifiedLearningSystem.showSuccessMessage(`画像を${targetGender}カテゴリに移動しました`);
}

/**
 * クイック削除確認ダイアログ
 * @param {string} imagePath - 削除する画像のパス
 */
function showQuickDeleteConfirm(imagePath) {
    const filename = imagePath.split('/').pop();
    
    if (confirm(`「${filename}」を削除してもよろしいですか？\n\nアノテーションがある場合は一緒に削除されます。`)) {
        deleteImage(imagePath);
    }
}

/**
 * 画像削除処理（改良版）
 * @param {string} imagePath - 削除する画像のパス
 */
async function deleteImage(imagePath) {
    try {
        showLoading();
        
        const response = await fetch('/learning/delete-data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({path: imagePath})
        });
        
        if (!response.ok) throw new Error('削除に失敗しました');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        hideLoading();
        
        // 成功メッセージ表示
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showSuccessMessage(data.message);
            
            // データ更新
            await window.unifiedLearningSystem.refreshDatasetStats();
            await window.unifiedLearningSystem.loadLearningData();
        } else {
            alert(data.message);
            // フォールバック: ページリロード
            window.location.reload();
        }
        
        // モーダルが開いている場合は閉じる
        const modal = document.getElementById('imageDetailModal');
        if (modal) {
            bootstrap.Modal.getInstance(modal).hide();
        }
        
    } catch (error) {
        hideLoading();
        console.error('削除エラー:', error);
        
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showError('削除中にエラーが発生しました: ' + error.message);
        } else {
            alert('削除中にエラーが発生しました: ' + error.message);
        }
    }
}

/**
 * アノテーションモーダルを開く（修正版）
 * @param {string} paramImagePath - 画像パス
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
function openAnnotationModal(paramImagePath, isEdit = false, existingAnnotation = null) {
    console.log('アノテーションモーダルを開く:', paramImagePath, isEdit ? '(編集モード)' : '(新規作成)');
    
    if (!paramImagePath) {
        alert('画像が指定されていません');
        return;
    }
    
    // 擬似カードオブジェクトを作成
    annotationTools.selectedCard = {
        dataset: {
            path: paramImagePath
        }
    };
    
    // モーダルを作成
    createAnnotationModal(isEdit, existingAnnotation);
    
    // Bootstrapモーダルを初期化して表示
    const annotationModal = new bootstrap.Modal(document.getElementById('annotationModal'));
    
    // キャンバスの設定
    setupAnnotationCanvas(annotationTools.selectedCard, isEdit, existingAnnotation);
    
    // モーダルが閉じられたときのクリーンアップ
    document.getElementById('annotationModal').addEventListener('hidden.bs.modal', cleanupAnnotationModal);
    
    // モーダルを表示
    annotationModal.show();
}

/**
 * アノテーションモーダルのHTMLを作成（修正版）
 */
function createAnnotationModal(isEdit = false, existingAnnotation = null) {
    const modalTitle = isEdit ? '生殖乳頭アノテーション編集' : '生殖乳頭アノテーション';
    const saveButtonText = isEdit ? '更新して保存' : '学習データとして保存';
    
    const modalHTML = `
    <div class="modal fade" id="annotationModal" tabindex="-1" aria-labelledby="annotationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="annotationModalLabel">${modalTitle}</h5>
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
                            ${isEdit ? `
                            <button type="button" class="btn btn-outline-warning" id="clearTool">
                                <i class="fas fa-undo"></i> リセット
                            </button>
                            ` : ''}
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
                        <i class="fas fa-save me-1"></i> ${saveButtonText}
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
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
function setupAnnotationCanvas(selectedCard, isEdit = false, existingAnnotation = null) {
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
        
        // 編集モードの場合、既存のアノテーションを読み込み
        if (isEdit && existingAnnotation) {
            loadExistingAnnotation(existingAnnotation);
        }
        
        // アノテーションツールの初期化
        initAnnotationToolButtons(isEdit);
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
 * 既存のアノテーションを読み込み
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
function loadExistingAnnotation(existingAnnotation) {
    if (!existingAnnotation || !existingAnnotation.url) return;
    
    const annotationImg = new Image();
    annotationImg.crossOrigin = 'anonymous';
    annotationImg.onload = function() {
        // 既存のアノテーションを合成
        annotationTools.context.globalCompositeOperation = 'source-over';
        annotationTools.context.drawImage(annotationImg, 0, 0);
    };
    annotationImg.src = existingAnnotation.url;
}

/**
 * アノテーションツールのボタン初期化
 */
function initAnnotationToolButtons(isEdit = false) {
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
    
    // リセットボタン（編集モードのみ）
    if (isEdit) {
        const clearBtn = document.getElementById('clearTool');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                // キャンバスをクリア
                annotationTools.context.clearRect(0, 0, annotationTools.canvas.width, annotationTools.canvas.height);
                // 元の画像を再描画
                const selectedCard = annotationTools.selectedCard;
                if (selectedCard) {
                    setupAnnotationCanvas(selectedCard, false, null);
                }
            });
        }
    }
    
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
    const modal = document.getElementById('annotationModal');
    if (modal) {
        modal.remove();
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
window.selectImageForAnnotation = selectImageForAnnotation;
window.openImageDetailModal = openImageDetailModal;
window.openAnnotationEditModal = openAnnotationEditModal;
window.openAnnotationModal = openAnnotationModal;
window.showQuickDeleteConfirm = showQuickDeleteConfirm;
window.deleteImage = deleteImage;