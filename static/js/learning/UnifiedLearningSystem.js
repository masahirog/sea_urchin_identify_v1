/**
 * ウニ生殖乳頭分析システム - 統合学習システム コアクラス
 * 学習システムの中心的な機能を提供
 */
import { UIManager } from './UIManager.js';
import { DataManager } from './DataManager.js';
import { EvaluationManager } from './EvaluationManager.js';
import { showSuccessMessage } from '../utilities.js';

/**
 * 統合学習システムクラス
 */
export class UnifiedLearningSystem {
    /**
     * コンストラクタ
     */
    constructor() {
        this.currentPhase = 'preparation';
        this.taskId = null;
        this.statusCheckInterval = null;
        this.datasetStats = {};
        this.learningResults = null;
        this.hasLatestResults = false;
        
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
        
        // サブモジュールの初期化
        this.dataManager = new DataManager(this);
        this.uiManager = new UIManager(this);
        this.evaluationManager = new EvaluationManager(this);
    }

    /**
     * システム初期化
     */
    async initialize() {
        try {
            // UI初期化
            this.uiManager.initializeUI();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // 初期データ読み込み
            await this.dataManager.loadInitialData();
            
            // 最新の学習結果があるかチェック
            await this.dataManager.loadLatestResults();
            
            // フェーズ判定
            this.determineCurrentPhase();
            
            // アノテーションコールバック設定
            this.setupAnnotationCallback();
            
        } catch (error) {
            this.uiManager.showError('システムの初期化に失敗しました: ' + error.message);
        }
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
                this.dataManager.handleDataUpload();
            });
        }

        // 統合学習開始ボタン
        const startTrainingBtn = document.getElementById('start-unified-training-btn');
        if (startTrainingBtn) {
            startTrainingBtn.addEventListener('click', () => {
                this.dataManager.startUnifiedTraining();
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
                this.dataManager.refreshDatasetStats();
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
    }

    /**
     * 指定フェーズへのナビゲーション
     * @param {string} targetPhase - 移動先フェーズ
     */
    navigateToPhase(targetPhase) {
        // 現在のフェーズと同じ場合は何もしない
        if (this.currentPhase === targetPhase) {
            return;
        }

        // フェーズ移動実行
        this.currentPhase = targetPhase;
        this.uiManager.updatePhaseDisplay();
        this.uiManager.showPhaseSection();

        // フェーズ固有の処理
        this.handlePhaseNavigation(targetPhase);

        showSuccessMessage(`${this.phases[targetPhase].name}フェーズに移動しました`);
    }

    /**
     * フェーズナビゲーション時の固有処理
     * @param {string} targetPhase - 移動先フェーズ
     */
    handlePhaseNavigation(targetPhase) {
        switch (targetPhase) {
            case 'preparation':
                // データ準備フェーズ: データセット統計を更新
                this.dataManager.refreshDatasetStats();
                this.dataManager.loadLearningData();
                break;

            case 'training':
                // 学習フェーズ: データ状況を確認して適切な表示
                this.uiManager.updateTrainingDetails();
                this.checkTrainingReadiness();
                
                // 実行中のタスクがあるかチェック
                if (this.taskId && this.statusCheckInterval) {
                    showSuccessMessage('学習進捗を監視中です');
                }
                break;

            case 'analysis':
                // 分析フェーズ: 最新の結果または履歴を表示
                if (this.learningResults) {
                    this.evaluationManager.displayUnifiedResults();
                } else if (this.hasLatestResults) {
                    // 初期化時に読み込んだ最新結果を表示
                    this.evaluationManager.displayUnifiedResults();
                } else {
                    // 結果がない場合は履歴を表示
                    this.uiManager.showAnalysisGuidance();
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
            this.uiManager.showTrainingGuidance('データがありません', 'データ準備フェーズで画像をアップロードしてください。');
        } else if (maleCount === 0 || femaleCount === 0) {
            this.uiManager.showTrainingGuidance('データが不足しています', 'より良い学習のため、オスとメス両方のデータをアップロードすることを推奨します。');
        } else if (totalCount < 5) {
            this.uiManager.showTrainingGuidance('データが少なめです', `現在${totalCount}枚のデータがあります。より良い結果のため、追加データをアップロードすることを推奨します。`);
        } else {
            // 十分なデータがある場合
            showSuccessMessage('学習準備完了：十分なデータが揃っています');
        }
    }

    /**
     * アノテーションコールバック設定
     */
    setupAnnotationCallback() {
        // グローバルコールバック関数を設定
        window.onAnnotationSaved = () => {
            this.dataManager.refreshDatasetStats();
            this.dataManager.loadLearningData();
            showSuccessMessage('アノテーションが保存され、統計情報を更新しました');
        };
    }

    /**
     * 学習データのフィルタリング
     * @param {string} filter - フィルター条件
     */
    filterLearningData(filter) {
        this.dataManager.loadLearningData(filter);
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
    }

    /**
     * 統合ステータスチェック
     */
    async checkUnifiedStatus() {
        if (!this.taskId) return;
        
        try {
            const status = await this.dataManager.checkUnifiedStatus();
            if (!status) return;
            
            this.updateUnifiedStatus(status);
            
            // 完了チェック
            if (status.status === 'completed') {
                this.handleTrainingComplete(status);
            } else if (status.status === 'failed' || status.status === 'error') {
                this.handleTrainingError(status);
            }
            
        } catch (error) {
            // エラー処理
        }
    }

    /**
     * 統合ステータス更新
     * @param {Object} status - ステータスデータ
     */
    updateUnifiedStatus(status) {
        // 全体進捗更新
        this.uiManager.updateStatus(status.message || '処理中...', this.uiManager.getStatusAlertClass(status.status), status.progress || 0);
        
        // 学習進捗詳細更新
        this.uiManager.updateTrainingProgress(status.progress || 0, status.message || '');
        
        // フェーズステップ更新
        this.uiManager.updateTrainingSteps(status.current_phase, status.phases_completed || []);
    }

    /**
     * 学習完了処理
     * @param {Object} status - 完了ステータス
     */
    async handleTrainingComplete(status) {
        // 進捗監視停止
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        // 結果保存
        this.learningResults = status.result;
        
        // フェーズ切り替え
        this.currentPhase = 'analysis';
        this.uiManager.updatePhaseDisplay();
        this.uiManager.showAnalysisPhase();
        
        // 結果表示
        this.evaluationManager.displayUnifiedResults();
        
        // 履歴更新
        try {
            await this.dataManager.loadLearningHistory();
        } catch (error) {
            // 履歴更新エラー
        }
        
        showSuccessMessage('統合学習プロセスが正常に完了しました！');
    }

    /**
     * 学習エラー処理
     * @param {Object} status - エラーステータス
     */
    handleTrainingError(status) {
        // 進捗監視停止
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        // エラー表示
        this.uiManager.updateStatus(status.message || 'エラーが発生しました', 'alert-danger', 100);
        this.uiManager.showError('統合学習中にエラーが発生しました: ' + (status.message || '不明なエラー'));
        
        // フェーズを戻す
        this.currentPhase = 'preparation';
        this.uiManager.updatePhaseDisplay();
    }

    /**
     * 新しい学習サイクルを開始
     */
    async startNewIteration() {
        this.currentPhase = 'preparation';
        this.taskId = null;
        this.learningResults = null;
        
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        this.uiManager.updatePhaseDisplay();
        await this.dataManager.refreshDatasetStats();
        
        showSuccessMessage('新しい学習サイクルを開始します');
    }

    /**
     * 現在のフェーズを判断
     */
    determineCurrentPhase() {
        const stats = this.datasetStats;
        const total = (stats.male_count || 0) + (stats.female_count || 0);
        
        // 最新の結果がある場合は結果分析フェーズから開始
        if (this.hasLatestResults) {
            this.currentPhase = 'analysis';
            // 最新結果を表示
            setTimeout(() => {
                this.evaluationManager.displayUnifiedResults();
            }, 100);
        } else if (total < 1) {
            this.currentPhase = 'preparation';
        } else {
            this.currentPhase = 'preparation';
        }
        
        this.uiManager.updatePhaseDisplay();
    }

    /**
     * 履歴結果の読み込み
     * @param {string} timestamp - タイムスタンプ
     */
    async loadHistoricalResult(timestamp) {
        return await this.dataManager.loadHistoricalResult(timestamp);
    }

    /**
     * 統合結果の表示
     */
    displayUnifiedResults() {
        this.evaluationManager.displayUnifiedResults();
    }
}

// グローバルインスタンス作成
export default UnifiedLearningSystem;