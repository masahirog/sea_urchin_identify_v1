/**
 * ウニ生殖乳頭分析システム - モデル評価機能
 * モデル評価とアノテーション影響分析のためのスクリプト
 */

// グローバル変数
let currentTaskId = null;
let statusCheckInterval = null;
let currentEvaluationId = null;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', function() {
    // 評価実行ボタン
    document.getElementById('runEvaluationBtn').addEventListener('click', function() {
        runModelEvaluation();
    });
    
    // アノテーション分析ボタン
    document.getElementById('analyzeAnnotationsBtn').addEventListener('click', function() {
        analyzeAnnotationImpact();
    });
    
    // 履歴読み込み
    loadEvaluationHistory();
    
    // 最新の評価結果を取得
    loadLatestEvaluation();
});

// モデル評価の実行
function runModelEvaluation() {
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/evaluation/run_evaluation', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存
        currentTaskId = data.task_id;
        
        // 状態表示の初期化
        document.getElementById('evaluationStatus').classList.remove('d-none');
        document.getElementById('evaluationStatus').textContent = '評価を開始しました...';
        document.getElementById('evaluationProgressContainer').classList.remove('d-none');
        document.getElementById('evaluationProgressBar').style.width = '0%';
        
        // 状態チェックの開始
        startStatusCheck();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// アノテーション影響分析の実行
function analyzeAnnotationImpact() {
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/evaluation/analyze-annotation-impact', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 結果の表示
        displayAnnotationAnalysis(data.result);
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// 状態チェックの開始
function startStatusCheck() {
    // 既存のタイマーをクリア
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 新しいタイマーの設定
    statusCheckInterval = setInterval(checkTaskStatus, 1000);
}

// タスク状態のチェック
function checkTaskStatus() {
    if (!currentTaskId) return;
    
    fetch('/task-status/' + currentTaskId)
    .then(response => response.json())
    .then(data => {
        // 状態の表示
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error') {
            // タイマーの停止
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            // 完了時は結果を更新
            if (data.status === 'completed') {
                // 評価履歴を再読み込み
                loadEvaluationHistory();
                
                // 最新の評価結果を表示
                loadLatestEvaluation();
            }
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
    });
}

// タスク状態の更新
function updateTaskStatus(data) {
    const statusElement = document.getElementById('evaluationStatus');
    const progressElement = document.getElementById('evaluationProgressBar');
    
    if (!statusElement || !progressElement) return;
    
    // ステータスメッセージ
    statusElement.textContent = data.message || '処理中...';
    
    // ステータスクラス
    statusElement.className = 'alert';
    if (data.status === 'processing' || data.status === 'queued') {
        statusElement.classList.add('alert-info');
    } else if (data.status === 'completed') {
        statusElement.classList.add('alert-success');
    } else if (data.status === 'error') {
        statusElement.classList.add('alert-danger');
    }
    
    // プログレスバー
    if (data.progress !== undefined) {
        progressElement.style.width = data.progress + '%';
        progressElement.textContent = Math.round(data.progress) + '%';
    }
}

// 評価履歴の読み込み
function loadEvaluationHistory() {
    fetch('/evaluation/history')
    .then(response => response.json())
    .then(data => {
        const historyList = document.getElementById('historyList');
        
        // リストのクリア
        historyList.innerHTML = '';
        
        if (!data.history || data.history.length === 0) {
            historyList.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <i class="fas fa-info-circle fa-2x mb-2"></i>
                    <p>評価履歴がありません</p>
                </div>
            `;
            return;
        }
        
        // 履歴項目の作成
        data.history.forEach(item => {
            const date = new Date(item.timestamp.replace(/_/g, 'T').substring(0, 4) + "-" +
                                 item.timestamp.substring(4, 6) + "-" +
                                 item.timestamp.substring(6, 8) + "T" +
                                 item.timestamp.substring(9, 11) + ":" +
                                 item.timestamp.substring(11, 13) + ":" +
                                 item.timestamp.substring(13, 15));
            
            const dateStr = date.toLocaleString();
            const accuracy = (item.cv_mean * 100).toFixed(1) + '%';
            
            const historyItem = document.createElement('a');
            historyItem.href = '#';
            historyItem.className = 'list-group-item list-group-item-action history-item';
            historyItem.dataset.id = item.timestamp;
            
            historyItem.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${dateStr}</h6>
                    <span class="badge bg-primary">${accuracy}</span>
                </div>
                <p class="mb-1 small">モデル評価結果</p>
            `;
            
            historyItem.addEventListener('click', function(e) {
                e.preventDefault();
                
                // 選択状態の更新
                document.querySelectorAll('.history-item').forEach(item => {
                    item.classList.remove('active');
                });
                this.classList.add('active');
                
                // 評価結果の表示
                loadEvaluationResult(item.timestamp);
            });
            
            historyList.appendChild(historyItem);
        });
    })
    .catch(error => {
        console.error('履歴読み込みエラー:', error);
        
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = `
            <div class="text-center py-3 text-danger">
                <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                <p>履歴の読み込み中にエラーが発生しました</p>
            </div>
        `;
    });
}

// 最新の評価結果を読み込む
function loadLatestEvaluation() {
    fetch('/evaluation/get-latest-result')
    .then(response => {
        if (!response.ok) {
            // 評価結果がない場合は無視
            if (response.status === 404) {
                return null;
            }
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;
        
        // 評価結果を表示
        displayEvaluationResult(data.details, data.summary.timestamp);
        
        // 履歴リストの該当項目をアクティブに
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === data.summary.timestamp) {
                item.classList.add('active');
            }
        });
    })
    .catch(error => {
        console.error('最新評価結果読み込みエラー:', error);
    });
}

// 特定の評価結果を読み込む
function loadEvaluationResult(timestamp) {
    fetch('/evaluation/static/evaluation/eval_' + timestamp + '.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        // 評価結果を表示
        displayEvaluationResult(data, timestamp);
    })
    .catch(error => {
        console.error('評価結果読み込みエラー:', error);
        alert('評価結果の読み込みに失敗しました: ' + error);
    });
}

// 評価結果の表示
function displayEvaluationResult(data, timestamp) {
    // プレースホルダーを非表示、結果を表示
    document.getElementById('evaluationPlaceholder').classList.add('d-none');
    document.getElementById('evaluationResult').classList.remove('d-none');
    
    // 現在の評価IDを保存
    currentEvaluationId = timestamp;
    
    // メトリクス値の設定
    document.getElementById('accuracyValue').textContent = (data.cv_mean * 100).toFixed(1) + '%';
    
    // 分類レポートから適合率と再現率を設定
    const report = data.classification_report;
    if (report) {
        // オスクラス
        document.getElementById('malePrecision').textContent = (report.male.precision * 100).toFixed(1) + '%';
        document.getElementById('maleRecall').textContent = (report.male.recall * 100).toFixed(1) + '%';
        document.getElementById('maleF1').textContent = (report.male.f1_score * 100).toFixed(1) + '%';
        document.getElementById('maleSupport').textContent = report.male.support;
        
        // メスクラス
        document.getElementById('femalePrecision').textContent = (report.female.precision * 100).toFixed(1) + '%';
        document.getElementById('femaleRecall').textContent = (report.female.recall * 100).toFixed(1) + '%';
        document.getElementById('femaleF1').textContent = (report.female.f1_score * 100).toFixed(1) + '%';
        document.getElementById('femaleSupport').textContent = report.female.support;
        
        // 平均/合計
        document.getElementById('avgPrecision').textContent = (report["weighted avg"].precision * 100).toFixed(1) + '%';
        document.getElementById('avgRecall').textContent = (report["weighted avg"].recall * 100).toFixed(1) + '%';
        document.getElementById('avgF1').textContent = (report["weighted avg"].f1_score * 100).toFixed(1) + '%';
        document.getElementById('totalSupport').textContent = report["weighted avg"].support;
        
        // メイン指標に適合率と再現率を設定
        document.getElementById('precisionValue').textContent = (report["weighted avg"].precision * 100).toFixed(1) + '%';
        document.getElementById('recallValue').textContent = (report["weighted avg"].recall * 100).toFixed(1) + '%';
    }
    
    // 学習曲線の画像
    document.getElementById('learningCurveImg').src = '/evaluation/static/evaluation/learning_curve_' + timestamp + '.png';
    
    // 混同行列の画像
    document.getElementById('confusionMatrixImg').src = '/evaluation/static/evaluation/confusion_matrix_' + timestamp + '.png';
    
    // ROCカーブの画像
    document.getElementById('rocCurveImg').src = '/evaluation/static/evaluation/roc_curve_' + timestamp + '.png';
    
    // クロスバリデーションスコア
    const cvScoresTableBody = document.getElementById('cvScoresTableBody');
    cvScoresTableBody.innerHTML = '';
    
    if (data.cv_scores) {
        data.cv_scores.forEach((score, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>分割 ${index + 1}</td>
                <td>${(score * 100).toFixed(1)}%</td>
            `;
            cvScoresTableBody.appendChild(row);
        });
        
        document.getElementById('cvMeanValue').textContent = (data.cv_mean * 100).toFixed(1) + '%';
        document.getElementById('cvStdValue').textContent = (data.cv_std * 100).toFixed(1) + '%';
    }
}

// アノテーション分析結果の表示
function displayAnnotationAnalysis(data) {
    // プレースホルダーを非表示、結果を表示
    document.getElementById('annotationPlaceholder').classList.add('d-none');
    document.getElementById('annotationResult').classList.remove('d-none');
    
    // データセット情報を表示
    const dataset = data.dataset;
    document.getElementById('maleTotalCount').textContent = dataset.male_total;
    document.getElementById('maleAnnotatedCount').textContent = dataset.male_annotated;
    document.getElementById('femaleTotalCount').textContent = dataset.female_total;
    document.getElementById('femaleAnnotatedCount').textContent = dataset.female_annotated;
    document.getElementById('annotationRate').textContent = (dataset.annotation_rate * 100).toFixed(1) + '%';
    
    // アノテーション影響の画像
    document.getElementById('annotationImpactImg').src = '/evaluation/static/evaluation/annotation_impact_' + data.timestamp + '.png';
    
    // アノテーションのインサイト
    const annotationRate = dataset.annotation_rate;
    let insightMessage = '';
    
    if (annotationRate < 0.3) {
        insightMessage = 'アノテーション率が低いため、モデルの性能が十分に発揮されていない可能性があります。より多くの画像にアノテーションを追加することで性能が向上する可能性があります。';
    } else if (annotationRate < 0.7) {
        insightMessage = 'アノテーションの割合は中程度です。より多くのアノテーションを追加することで、モデルの性能向上が期待できます。';
    } else {
        insightMessage = 'アノテーション率が高く、モデルの学習に十分なデータが提供されています。このまま継続して新しいサンプルのアノテーションを行うことで、モデルの精度を維持・向上できるでしょう。';
    }
    
    document.getElementById('annotationInsight').textContent = insightMessage;
}