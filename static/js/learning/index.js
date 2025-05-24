/**
 * ウニ生殖乳頭分析システム - 統合学習システム エントリポイント
 * 学習システムの初期化と設定を行う
 */

import { UnifiedLearningSystem } from './UnifiedLearningSystem.js';
import { AnnotationManager } from './AnnotationManager.js';
import { YoloDetector } from './YoloDetector.js';
import { showErrorMessage } from '../utilities.js';

/**
 * 学習システムの初期化
 */
class LearningSystemInitializer {
    constructor() {
        this.system = null;
        this.isInitialized = false;
    }

    /**
     * システムを初期化
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('学習システムは既に初期化されています');
            return this.system;
        }

        try {
            // システムインスタンスを作成
            this.system = new UnifiedLearningSystem();
            
            // グローバル変数として安全に公開
            this.exposeGlobalAPIs();
            
            // システム初期化
            await this.system.initialize();
            
            this.isInitialized = true;
            console.log('統合学習システムの初期化が完了しました');
            
            return this.system;
            
        } catch (error) {
            console.error('統合学習システムの初期化中にエラーが発生しました:', error);
            showErrorMessage('システムの初期化に失敗しました。ページを再読み込みしてください。');
            throw error;
        }
    }

    /**
     * グローバルAPIを公開
     */
    exposeGlobalAPIs() {
        // 読み取り専用プロパティとして公開
        Object.defineProperty(window, 'unifiedLearningSystem', {
            get: () => this.system,
            configurable: false,
            enumerable: true
        });

        // 学習システムの主要メソッドを公開
        window.learningSystem = {
            // データ管理
            refreshDatasetStats: () => this.system?.dataManager?.refreshDatasetStats(),
            loadLearningData: (filter) => this.system?.dataManager?.loadLearningData(filter),
            
            // フェーズ管理
            navigateToPhase: (phase) => this.system?.navigateToPhase(phase),
            getCurrentPhase: () => this.system?.currentPhase,
            
            // 履歴管理
            loadHistoricalResult: (timestamp) => this.system?.loadHistoricalResult(timestamp),
            
            // 状態確認
            isInitialized: () => this.isInitialized,
            getDatasetStats: () => this.system?.datasetStats,
            getLearningResults: () => this.system?.learningResults
        };
    }

    /**
     * 初期化状態をチェック
     */
    checkInitialization() {
        if (!this.isInitialized) {
            console.error('学習システムが初期化されていません');
            return false;
        }
        return true;
    }
}

// シングルトンインスタンス
const initializer = new LearningSystemInitializer();

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializer.initialize();
    } catch (error) {
        // エラーは既に処理済み
        console.error('初期化エラー:', error);
    }
});

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (initializer.system?.statusCheckInterval) {
        clearInterval(initializer.system.statusCheckInterval);
    }
});

// エクスポート
export { initializer as LearningSystemInitializer };