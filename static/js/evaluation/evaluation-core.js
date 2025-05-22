/**
 * ウニ生殖乳頭分析システム - 評価コアモジュール
 * メイン初期化、状態管理、タスクチェック機能
 */

// モジュールの状態を管理する変数（グローバルに公開）
window.modelEvaluation = {
    currentTaskId: null,
    statusCheckInterval: null,
    currentEvaluationId: null,
    taskStatusErrorCount: 0
};

/**
 * ページ初期化処理
 */
document.addEventListener('DOMContentLoaded', function() {
    initModelEvaluationPage();
});

/**
 * モデル評価ページの初期化
 */
function initModelEvaluationPage() {
    console.log('モデル評価ページの初期化開始');
    
    // 各機能モジュールの初期化
    if (typeof initEvaluationRunner === 'function') {
        initEvaluationRunner();
    }
    
    if (typeof initAnnotationAnalysis === 'function') {
        initAnnotationAnalysis();
    }
    
    if (typeof initEvaluationHistory === 'function') {
        initEvaluationHistory();
    }
    
    if (typeof initEvaluationDisplay === 'function') {
        initEvaluationDisplay();
    }
    
    console.log('モデル評価ページの初期化完了');
}

/**
 * 状態チェックの開始
 */
function startStatusCheck() {
    console.log('状態チェック開始 - タスクID:', window.modelEvaluation.currentTaskId);
    
    // 既存のタイマーをクリア
    if (window.modelEvaluation.statusCheckInterval) {
        clearInterval(window.modelEvaluation.statusCheckInterval);
        console.log('既存のタイマーをクリアしました');
    }
    
    // エラーカウントリセット
    window.modelEvaluation.taskStatusErrorCount = 0;
    
    // 新しいタイマーの設定
    window.modelEvaluation.statusCheckInterval = setInterval(() => {
        console.log('状態チェック実行中...');
        checkTaskStatus();
    }, 2000); // 2秒間隔で状態チェック
    
    console.log('状態チェックタイマーを設定しました');
}

/**
 * タスク状態のチェック
 */
function checkTaskStatus() {
    if (!window.modelEvaluation.currentTaskId) return;
    
    // APIエンドポイントのパスを修正
    fetch('/api/task-status/' + window.modelEvaluation.currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('状態取得に失敗しました: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        // エラーカウントリセット
        window.modelEvaluation.taskStatusErrorCount = 0;
        
        // 状態の表示
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error' || 
            data.status === 'failed') {
            // タイマーの停止
            clearInterval(window.modelEvaluation.statusCheckInterval);
            window.modelEvaluation.statusCheckInterval = null;
            
            // 完了時は結果を更新
            if (data.status === 'completed') {
                console.log('タスク完了 - データ更新開始');
                
                // 少し待ってから評価履歴と結果を更新
                setTimeout(() => {
                    console.log('評価履歴の再読み込み開始');
                    // 評価履歴を再読み込み
                    if (typeof loadEvaluationHistory === 'function') {
                        loadEvaluationHistory();
                    }
                    
                    console.log('最新評価結果の読み込み開始');
                    // 最新の評価結果を表示
                    if (typeof loadLatestEvaluation === 'function') {
                        loadLatestEvaluation();
                    }
                    
                    // アノテーション分析の場合は、アノテーション結果も更新
                    if (data.result && data.result.dataset) {
                        console.log('アノテーション結果の表示開始');
                        if (typeof displayAnnotationAnalysis === 'function') {
                            displayAnnotationAnalysis(data.result);
                        }
                    }
                }, 2000); // 2秒待機してからデータ更新
            }
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
        
        // エラーカウントを増加
        window.modelEvaluation.taskStatusErrorCount++;
        
        // エラーが続く場合は停止（5回でギブアップ）
        if (window.modelEvaluation.taskStatusErrorCount >= 5) {
            clearInterval(window.modelEvaluation.statusCheckInterval);
            window.modelEvaluation.statusCheckInterval = null;
            
            updateEvaluationStatus('evaluationStatus', 'alert-danger', 
                '状態取得中にエラーが発生しました。処理は継続している可能性があります。');
        }
    });
}

/**
 * タスク状態の更新
 * @param {Object} data - タスク状態データ
 */
function updateTaskStatus(data) {
    // 状態データの形式を確認
    let status, message, progress;
    
    if (data.status && typeof data.status === 'object') {
        // status オブジェクトが返された場合
        status = data.status.status;
        message = data.status.message;
        progress = data.status.progress || 0;
    } else {
        // 直接データが返された場合
        status = data.status;
        message = data.message;
        progress = data.progress || 0;
    }
    
    // 適切なアラートクラスを決定
    let alertClass = 'alert-info';
    if (status === 'completed') {
        alertClass = 'alert-success';
    } else if (status === 'error' || status === 'failed') {
        alertClass = 'alert-danger';
    }
    
    // 状態の更新
    updateEvaluationStatus('evaluationStatus', alertClass, message || '処理中...');
    updateProgressBar('evaluationProgressBar', progress);
}