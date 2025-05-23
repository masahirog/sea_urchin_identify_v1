/**
 * ウニ生殖乳頭分析システム - 統合学習システム エントリポイント
 * 学習システムの初期化と設定を行う
 */

import { UnifiedLearningSystem } from './UnifiedLearningSystem.js';
import { setupAnnotationTools } from './AnnotationTools.js';
import { setupYoloAnnotator } from './YoloAnnotator.js';

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
    
    // YOLO関連イベントハンドラのセットアップ
    setupYoloEventHandlers();
});

/**
 * YOLO関連のイベントハンドラを設定
 */
function setupYoloEventHandlers() {
    // データセット準備ボタン
    const prepareDatasetBtn = document.getElementById('prepare-dataset-btn');
    if (prepareDatasetBtn) {
        prepareDatasetBtn.addEventListener('click', async () => {
            try {
                // ローディング表示
                showLoading();
                
                // データセット準備API呼び出し
                const response = await fetch('/yolo/prepare-dataset', {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    throw new Error(`サーバーエラー: ${response.status}`);
                }
                
                const data = await response.json();
                
                // ローディング非表示
                hideLoading();
                
                if (data.status === 'success') {
                    showSuccessMessage(`データセットを準備しました (訓練: ${data.train_count}枚, 検証: ${data.val_count}枚)`);
                    
                    // データセット状態を更新
                    if (unifiedLearningSystem && unifiedLearningSystem.dataManager) {
                        await unifiedLearningSystem.dataManager.checkYoloDatasetStatus();
                    }
                } else {
                    showErrorMessage(`データセット準備エラー: ${data.message}`);
                }
            } catch (error) {
                hideLoading();
                showErrorMessage(`データセット準備中にエラーが発生しました: ${error.message}`);
            }
        });
    }
    
    // トレーニング開始ボタン
    const startTrainingBtn = document.getElementById('start-yolo-training-btn');
    if (startTrainingBtn) {
        startTrainingBtn.addEventListener('click', async () => {
            try {
                // パラメータの取得と検証
                const params = unifiedLearningSystem.uiManager.getYoloTrainingParams();
                
                // バリデーション
                if (isNaN(params.batch_size) || params.batch_size < 1) {
                    showErrorMessage('バッチサイズは1以上の数値を入力してください');
                    return;
                }
                
                if (isNaN(params.epochs) || params.epochs < 1) {
                    showErrorMessage('エポック数は1以上の数値を入力してください');
                    return;
                }
                
                // ローディング表示
                showLoading();
                
                // トレーニング開始API呼び出し
                const response = await fetch('/yolo/training/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(params)
                });
                
                if (!response.ok) {
                    throw new Error(`サーバーエラー: ${response.status}`);
                }
                
                const data = await response.json();
                
                // ローディング非表示
                hideLoading();
                
                if (data.status === 'success') {
                    showSuccessMessage(data.message || 'YOLOトレーニングを開始しました');
                    
                    // トレーニング状態監視を開始
                    startYoloTrainingMonitoring();
                } else {
                    showErrorMessage(`トレーニング開始エラー: ${data.message}`);
                }
            } catch (error) {
                hideLoading();
                showErrorMessage(`トレーニング開始中にエラーが発生しました: ${error.message}`);
            }
        });
    }
    
    // トレーニング停止ボタン
    const stopTrainingBtn = document.getElementById('stop-yolo-training-btn');
    if (stopTrainingBtn) {
        stopTrainingBtn.addEventListener('click', async () => {
            if (!confirm('トレーニングを停止しますか？再開はできません。')) {
                return;
            }
            
            try {
                // ローディング表示
                showLoading();
                
                // トレーニング停止API呼び出し
                const response = await fetch('/yolo/training/stop', {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    throw new Error(`サーバーエラー: ${response.status}`);
                }
                
                const data = await response.json();
                
                // ローディング非表示
                hideLoading();
                
                if (data.status === 'success') {
                    showSuccessMessage(data.message || 'トレーニングを停止しました');
                    
                    // トレーニング状態監視を停止
                    stopYoloTrainingMonitoring();
                } else {
                    showErrorMessage(`トレーニング停止エラー: ${data.message}`);
                }
            } catch (error) {
                hideLoading();
                showErrorMessage(`トレーニング停止中にエラーが発生しました: ${error.message}`);
            }
        });
    }
}

// YOLOトレーニング監視用のタイマーID
let yoloStatusTimer = null;

/**
 * YOLOトレーニング状態監視の開始
 */
function startYoloTrainingMonitoring() {
    // 既存のタイマーをクリア
    stopYoloTrainingMonitoring();
    
    // 状態チェックの実行
    checkYoloTrainingStatus();
    
    // 状態チェックタイマーの設定（3秒間隔）
    yoloStatusTimer = setInterval(checkYoloTrainingStatus, 3000);
}

/**
 * YOLOトレーニング状態監視の停止
 */
function stopYoloTrainingMonitoring() {
    if (yoloStatusTimer) {
        clearInterval(yoloStatusTimer);
        yoloStatusTimer = null;
    }
}

/**
 * YOLOトレーニング状態のチェック
 */
async function checkYoloTrainingStatus() {
    try {
        if (!unifiedLearningSystem || !unifiedLearningSystem.dataManager) {
            return;
        }
        
        // 状態取得
        const status = await unifiedLearningSystem.dataManager.checkYoloTrainingStatus();
        
        // UI更新
        if (unifiedLearningSystem.uiManager) {
            unifiedLearningSystem.uiManager.updateYoloTrainingProgress(status);
        }
        
        // 完了またはエラー時に監視を停止
        if (status.status === 'completed' || status.status === 'error' || status.status === 'failed') {
            stopYoloTrainingMonitoring();
            
            // 完了時はデータセット状態を更新
            if (status.status === 'completed') {
                if (unifiedLearningSystem.dataManager) {
                    await unifiedLearningSystem.dataManager.checkYoloDatasetStatus();
                }
            }
        }
    } catch (error) {
        console.error('YOLOトレーニング状態チェックエラー:', error);
    }
}

// ヘルパー関数
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('d-none');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

function showSuccessMessage(message) {
    if (typeof window.showSuccessMessage === 'function') {
        window.showSuccessMessage(message);
    } else {
        console.log('成功:', message);
    }
}

function showErrorMessage(message) {
    if (typeof window.showErrorMessage === 'function') {
        window.showErrorMessage(message);
    } else {
        console.error('エラー:', message);
    }
}

// グローバル変数のエクスポート
export { unifiedLearningSystem };