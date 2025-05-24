/**
 * ウニ生殖乳頭分析システム - 統合学習システム コアクラス
 * 学習システムの中心的な機能を提供
 */
import { UIManager } from './UIManager.js';
import { DataManager } from './DataManager.js';
import { EvaluationManager } from './EvaluationManager.js';
import { YoloTrainingManager } from './YoloTrainingManager.js';
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
        this.yoloManager = new YoloTrainingManager(this);
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
            
            // YOLOトレーニング機能の初期化
            this.yoloManager.initialize();
            
        } catch (error) {
            this.uiManager.showError('システムの初期化に失敗しました: ' + error.message);
        }
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // フォーム関連
        this.setupFormListeners();
        
        // ボタン関連
        this.setupButtonListeners();
        
        // フィルター関連
        this.setupFilterListeners();
        
        // フェーズナビゲーション
        this.setupPhaseNavigation();
    }

    /**
     * フォームイベントリスナー設定
     */
    setupFormListeners() {
        const uploadForm = document.getElementById('unifiedDataUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.dataManager.handleDataUpload();
            });
        }
    }

    /**
     * ボタンイベントリスナー設定
     */
    setupButtonListeners() {
        const buttons = {
            'start-unified-training-btn': () => this.dataManager.startUnifiedTraining(),
            'start-new-iteration-btn': () => this.startNewIteration(),
            'refresh-dataset-btn': () => this.dataManager.refreshDatasetStats()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }

    /**
     * フィルターイベントリスナー設定
     */
    setupFilterListeners() {
        const filterInputs = document.querySelectorAll('input[name="dataFilter"]');
        filterInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.filterLearningData(e.target.value);
            });
        });
    }

    /**
     * フェーズナビゲーションの設定
     */
    setupPhaseNavigation() {
        Object.keys(this.phases).forEach(phase => {
            const element = document.getElementById(`phase-${phase}`);
            if (element) {
                element.addEventListener('click', () => this.navigateToPhase(phase));
                element.style.cursor = 'pointer';
                element.title = `${this.phases[phase].name}フェーズに移動`;
            }
        });
    }

    /**
     * 指定フェーズへのナビゲーション
     * @param {string} targetPhase - 移動先フェーズ
     */
    navigateToPhase(targetPhase) {
        if (this.currentPhase === targetPhase) return;

        this.currentPhase = targetPhase;
        this.uiManager.updatePhaseDisplay();
        this.uiManager.showPhaseSection();
        this.handlePhaseNavigation(targetPhase);

        showSuccessMessage(`${this.phases[targetPhase].name}フェーズに移動しました`);
    }

    /**
     * フェーズナビゲーション時の固有処理
     * @param {string} targetPhase - 移動先フェーズ
     */
    handlePhaseNavigation(targetPhase) {
        const phaseHandlers = {
            'preparation': () => {
                this.dataManager.refreshDatasetStats();
                this.dataManager.loadLearningData();
            },
            'training': () => {
                this.uiManager.updateTrainingDetails();
                this.checkTrainingReadiness();
                
                if (this.taskId && this.statusCheckInterval) {
                    showSuccessMessage('学習進捗を監視中です');
                }
            },
            'analysis': () => {
                if (this.learningResults || this.hasLatestResults) {
                    this.evaluationManager.displayUnifiedResults();
                } else {
                    this.uiManager.showAnalysisGuidance();
                }
            }
        };

        const handler = phaseHandlers[targetPhase];
        if (handler) handler();
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
            showSuccessMessage('学習準備完了：十分なデータが揃っています');
        }
    }

    /**
     * アノテーションコールバック設定
     */
    setupAnnotationCallback() {
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
        this.stopProgressMonitoring();
        this.statusCheckInterval = setInterval(() => {
            this.checkUnifiedStatus();
        }, 2000);
    }

    /**
     * 進捗監視の停止
     */
    stopProgressMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
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
     * @param {Object} status - ステータスデータ
     */
    updateUnifiedStatus(status) {
        this.uiManager.updateStatus(
            status.message || '処理中...', 
            this.uiManager.getStatusAlertClass(status.status), 
            status.progress || 0
        );
        
        this.uiManager.updateTrainingProgress(status.progress || 0, status.message || '');
        this.uiManager.updateTrainingSteps(status.current_phase, status.phases_completed || []);
    }

    /**
     * 学習完了処理
     * @param {Object} status - 完了ステータス
     */
    async handleTrainingComplete(status) {
        this.stopProgressMonitoring();
        
        this.learningResults = status.result;
        this.currentPhase = 'analysis';
        this.uiManager.updatePhaseDisplay();
        this.uiManager.showAnalysisPhase();
        
        this.evaluationManager.displayUnifiedResults();
        
        try {
            await this.dataManager.loadLearningHistory();
        } catch (error) {
            console.error('履歴更新エラー:', error);
        }
        
        showSuccessMessage('統合学習プロセスが正常に完了しました！');
    }

    /**
     * 学習エラー処理
     * @param {Object} status - エラーステータス
     */
    handleTrainingError(status) {
        this.stopProgressMonitoring();
        
        this.uiManager.updateStatus(
            status.message || 'エラーが発生しました', 
            'alert-danger', 
            100
        );
        this.uiManager.showError('統合学習中にエラーが発生しました: ' + (status.message || '不明なエラー'));
        
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
        
        this.stopProgressMonitoring();
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
        if (this.hasLatestResults && this.learningResults) {  // learningResultsの存在もチェック
            this.currentPhase = 'analysis';
            // 遅延実行で、UIが準備されてから表示
            setTimeout(() => {
                if (this.learningResults) {  // 再度チェック
                    this.evaluationManager.displayUnifiedResults();
                }
            }, 100);
        } else if (total >= 1) {
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