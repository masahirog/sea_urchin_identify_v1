/**
 * ウニ生殖乳頭分析システム - 統合学習システム エントリポイント
 * 学習システムの初期化と設定を行う
 */

import { UnifiedLearningSystem } from './UnifiedLearningSystem.js';
import { setupAnnotationTools } from './AnnotationManager.js';
import { setupYoloAnnotator } from './YoloDetector.js';

// グローバルインスタンス
let unifiedLearningSystem;

// DOMロード時の初期化
document.addEventListener('DOMContentLoaded', () => {
    // システムインスタンスを作成
    unifiedLearningSystem = new UnifiedLearningSystem();
    
    // グローバル変数として公開
    window.unifiedLearningSystem = unifiedLearningSystem;
    
    // システム初期化
    unifiedLearningSystem.initialize()
        .then(() => {
            console.log('統合学習システムの初期化が完了しました');
        })
        .catch(error => {
            console.error('統合学習システムの初期化中にエラーが発生しました:', error);
        });
    
    // アノテーションツールのセットアップ
    setupAnnotationTools();
    
    // YOLOアノテーターのセットアップ
    setupYoloAnnotator();
});

// グローバル変数のエクスポート
export { unifiedLearningSystem };