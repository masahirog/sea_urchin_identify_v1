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
    
    // 「処理中」ステータスの表示
    document.getElementById('evaluationStatus').classList.remove('d-none');
    document.getElementById('evaluationStatus').className = 'alert alert-info';
    document.getElementById('evaluationStatus').textContent = '評価を準備中...';
    document.getElementById('evaluationProgressContainer').classList.remove('d-none');
    document.getElementById('evaluationProgressBar').style.width = '0%';
    document.getElementById('evaluationProgressBar').textContent = '0%';
    
    // リクエスト送信
    fetch('/evaluation/run_evaluation', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            showErrorMessage('エラー: ' + data.error);
            document.getElementById('evaluationStatus').className = 'alert alert-danger';
            document.getElementById('evaluationStatus').textContent = 'エラー: ' + data.error;
            return;
        }
        
        // タスクIDの保存
        currentTaskId = data.task_id;
        
        // 状態表示の更新
        document.getElementById('evaluationStatus').textContent = '評価を開始しました...';
        document.getElementById('evaluationProgressBar').style.width = '10%';
        document.getElementById('evaluationProgressBar').textContent = '10%';
        
        // 状態チェックの開始
        startStatusCheck();
        
        // 成功メッセージの表示
        showSuccessMessage('モデル評価を開始しました。完了までお待ちください。');
    })
    .catch(error => {
        hideLoading();
        console.error('評価実行エラー:', error);
        showErrorMessage('評価実行中にエラーが発生しました: ' + error);
        
        document.getElementById('evaluationStatus').className = 'alert alert-danger';
        document.getElementById('evaluationStatus').textContent = 'エラー: 通信に失敗しました';
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
            showErrorMessage('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存（状態チェック用）
        currentTaskId = data.task_id;
        
        // 状態チェックの開始
        startStatusCheck();
        
        // 成功メッセージの表示
        showSuccessMessage('アノテーション影響分析を開始しました。完了までお待ちください。');
    })
    .catch(error => {
        hideLoading();
        console.error('アノテーション分析実行エラー:', error);
        showErrorMessage('アノテーション分析実行中にエラーが発生しました: ' + error);
    });
}

// 成功メッセージの表示
function showSuccessMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-success alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        <i class="fas fa-check-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertElement, container.firstChild);
    
    // 自動的に閉じる
    setTimeout(() => {
        try {
            const bsAlert = new bootstrap.Alert(alertElement);
            bsAlert.close();
        } catch (e) {
            // フォールバック（Bootstrapが使えない場合）
            alertElement.remove();
        }
    }, 5000);
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
    
    console.log("タスク状態チェック:", currentTaskId);
    
    // APIエンドポイントのパスを修正
    fetch('/api/task-status/' + currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('状態取得に失敗しました: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('タスク状態:', data);
        // 状態の表示
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error' || 
            data.status === 'failed') {
            // タイマーの停止
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            // 完了時は結果を更新
            if (data.status === 'completed') {
                // 少し待ってから評価履歴と結果を更新
                setTimeout(() => {
                    // 評価履歴を再読み込み
                    loadEvaluationHistory();
                    
                    // 最新の評価結果を表示
                    loadLatestEvaluation();
                }, 1000);
            }
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
        
        // エラーカウントを追加
        if (!window.taskStatusErrorCount) {
            window.taskStatusErrorCount = 1;
        } else {
            window.taskStatusErrorCount++;
        }
        
        // エラーが続く場合は停止（5回でギブアップ）
        if (window.taskStatusErrorCount >= 5) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            const statusElement = document.getElementById('evaluationStatus');
            if (statusElement) {
                statusElement.className = 'alert alert-danger';
                statusElement.textContent = '状態取得中にエラーが発生しました。処理は継続している可能性があります。';
            }
        }
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
    
    // データが正しく取得できない場合のフォールバック値
    const defaultValue = 'N/A';
    
    try {
        // メトリクス値の設定
        document.getElementById('accuracyValue').textContent = 
            data && data.cv_mean !== undefined ? 
            (data.cv_mean * 100).toFixed(1) + '%' : defaultValue;
        
        // 分類レポートから適合率と再現率を設定
        const report = data ? data.classification_report || {} : {};
        
        // オスクラスのメトリクス設定
        const male = report.male || {};
        setMetricText('malePrecision', male.precision);
        setMetricText('maleRecall', male.recall);
        setMetricText('maleF1', male.f1_score);
        setMetricText('maleSupport', male.support, false);
        
        // メスクラスのメトリクス設定
        const female = report.female || {};
        setMetricText('femalePrecision', female.precision);
        setMetricText('femaleRecall', female.recall);
        setMetricText('femaleF1', female.f1_score);
        setMetricText('femaleSupport', female.support, false);
        
        // 平均/合計のメトリクス設定
        const avg = report["weighted avg"] || {};
        setMetricText('avgPrecision', avg.precision);
        setMetricText('avgRecall', avg.recall);
        setMetricText('avgF1', avg.f1_score);
        setMetricText('totalSupport', avg.support, false);
        
        // メイン指標に適合率と再現率を設定
        setMetricText('precisionValue', avg.precision);
        setMetricText('recallValue', avg.recall);
        
        // 学習曲線の画像
        setImageWithFallback('learningCurveImg', '/evaluation/static/evaluation/learning_curve_' + timestamp + '.png');
        
        // 混同行列の画像
        setImageWithFallback('confusionMatrixImg', '/evaluation/static/evaluation/confusion_matrix_' + timestamp + '.png');
        
        // ROCカーブの画像
        setImageWithFallback('rocCurveImg', '/evaluation/static/evaluation/roc_curve_' + timestamp + '.png');
        
        // クロスバリデーションスコア
        const cvScoresTableBody = document.getElementById('cvScoresTableBody');
        cvScoresTableBody.innerHTML = '';
        
        if (data && data.cv_scores && data.cv_scores.length > 0) {
            data.cv_scores.forEach((score, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>分割 ${index + 1}</td>
                    <td>${(score * 100).toFixed(1)}%</td>
                `;
                cvScoresTableBody.appendChild(row);
            });
            
            setMetricText('cvMeanValue', data.cv_mean);
            setMetricText('cvStdValue', data.cv_std);
        } else {
            // スコアがない場合のフォールバック表示
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="2" class="text-center">データなし</td>`;
            cvScoresTableBody.appendChild(row);
            
            document.getElementById('cvMeanValue').textContent = defaultValue;
            document.getElementById('cvStdValue').textContent = defaultValue;
        }
    } catch (error) {
        console.error('評価結果表示エラー:', error);
        showErrorMessage('評価結果の表示中にエラーが発生しました');
    }
}

/**
 * 指定されたIDの要素にメトリクスの値を設定する
 * @param {string} elementId - 要素ID
 * @param {number} value - 設定する値
 * @param {boolean} isPercent - パーセント表示するかどうか（デフォルト: true）
 */
function setMetricText(elementId, value, isPercent = true) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (value === undefined || value === null) {
        element.textContent = 'N/A';
    } else {
        if (isPercent) {
            element.textContent = (value * 100).toFixed(1) + '%';
        } else {
            element.textContent = value;
        }
    }
}

/**
 * 画像を設定し、読み込みエラーの場合はフォールバック表示する
 * @param {string} imageId - 画像要素ID
 * @param {string} src - 画像URL
 */
function setImageWithFallback(imageId, src) {
    const imageElement = document.getElementById(imageId);
    if (!imageElement) return;
    
    // 元のエラーハンドラを保持
    const originalOnerror = imageElement.onerror;
    
    // エラーハンドラを設定
    imageElement.onerror = function() {
        // 画像が読み込めない場合は代替テキストとスタイルを設定
        this.style.backgroundColor = '#f8f9fa';
        this.style.padding = '20px';
        this.style.border = '1px solid #dee2e6';
        this.style.borderRadius = '4px';
        this.alt = 'グラフは利用できません';
        
        // 画像の代わりに表示するテキスト要素を作成
        const parentElement = this.parentElement;
        if (parentElement) {
            // 既存の画像を非表示
            this.style.display = 'none';
            
            // プレースホルダーDiv作成（存在しない場合のみ）
            if (!parentElement.querySelector('.image-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder text-center p-4 bg-light border rounded';
                placeholder.innerHTML = `
                    <i class="fas fa-image text-muted mb-2" style="font-size: 2rem;"></i>
                    <p class="mb-0 text-muted">グラフデータはありません</p>
                `;
                parentElement.appendChild(placeholder);
            }
        }
        
        // 元のエラーハンドラを呼び出す
        if (originalOnerror) originalOnerror.call(this);
    };
    
    // 新しいURLを設定
    imageElement.src = src;
}

// エラーメッセージの表示
function showErrorMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertElement, container.firstChild);
    
    // 自動的に閉じる
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertElement);
        bsAlert.close();
    }, 5000);
}



// アノテーション分析結果の表示
function displayAnnotationAnalysis(data) {
    // プレースホルダーを非表示、結果を表示
    document.getElementById('annotationPlaceholder').classList.add('d-none');
    document.getElementById('annotationResult').classList.remove('d-none');
    
    try {
        // データセット情報を表示
        const dataset = data.dataset || {};
        document.getElementById('maleTotalCount').textContent = dataset.male_total || 0;
        document.getElementById('maleAnnotatedCount').textContent = dataset.male_annotated || 0;
        document.getElementById('femaleTotalCount').textContent = dataset.female_total || 0;
        document.getElementById('femaleAnnotatedCount').textContent = dataset.female_annotated || 0;
        
        const annotationRate = dataset.annotation_rate || 0;
        document.getElementById('annotationRate').textContent = (annotationRate * 100).toFixed(1) + '%';
        
        // アノテーション影響の画像
        if (data.images && data.images.annotation_impact) {
            const imgSrc = '/evaluation/static/evaluation/' + data.images.annotation_impact;
            setImageWithFallback('annotationImpactImg', imgSrc);
        } else {
            // 画像がない場合はデータからグラフを生成
            renderAnnotationChart(dataset);
        }
        
        // アノテーションのインサイト
        let insightMessage = '';
        
        if (annotationRate < 0.3) {
            insightMessage = 'アノテーション率が低いため、モデルの性能が十分に発揮されていない可能性があります。より多くの画像にアノテーションを追加することで性能が向上する可能性があります。';
        } else if (annotationRate < 0.7) {
            insightMessage = 'アノテーションの割合は中程度です。より多くのアノテーションを追加することで、モデルの性能向上が期待できます。';
        } else {
            insightMessage = 'アノテーション率が高く、モデルの学習に十分なデータが提供されています。このまま継続して新しいサンプルのアノテーションを行うことで、モデルの精度を維持・向上できるでしょう。';
        }
        
        document.getElementById('annotationInsight').textContent = insightMessage;
    } catch (error) {
        console.error('アノテーション分析表示エラー:', error);
        showErrorMessage('アノテーション分析の表示中にエラーが発生しました');
    }
}

// データセット情報からグラフを描画（Chart.jsを使用）
function renderAnnotationChart(dataset) {
    try {
        const canvas = document.getElementById('annotationImpactImg');
        if (!canvas) return;
        
        // キャンバス要素をリセット
        const chartContainer = canvas.parentElement;
        chartContainer.innerHTML = '';
        
        // 新しいキャンバス要素を作成
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'annotationChartCanvas';
        chartContainer.appendChild(newCanvas);
        
        // データセット情報
        const male_total = dataset.male_total || 0;
        const female_total = dataset.female_total || 0;
        const male_annotated = dataset.male_annotated || 0;
        const female_annotated = dataset.female_annotated || 0;
        
        // グラフデータ
        const data = {
            labels: ['オス', 'メス', '合計'],
            datasets: [
                {
                    label: 'アノテーション済み',
                    data: [male_annotated, female_annotated, male_annotated + female_annotated],
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: '未アノテーション',
                    data: [
                        male_total - male_annotated, 
                        female_total - female_annotated, 
                        (male_total - male_annotated) + (female_total - female_annotated)
                    ],
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        };
        
        // グラフオプション
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '画像数'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'カテゴリ'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'データセットのアノテーション状況'
                }
            }
        };
        
        // Chart.jsが読み込まれているか確認
        if (typeof Chart !== 'undefined') {
            // グラフを描画
            new Chart(newCanvas, {
                type: 'bar',
                data: data,
                options: options
            });
        } else {
            // Chart.jsが読み込まれていない場合
            const placeholder = document.createElement('div');
            placeholder.className = 'text-center p-5 bg-light border rounded';
            placeholder.innerHTML = `
                <i class="fas fa-chart-bar text-muted mb-3" style="font-size: 3rem;"></i>
                <p class="mb-0">アノテーション状況：オス(${male_annotated}/${male_total}), メス(${female_annotated}/${female_total})</p>
            `;
            chartContainer.appendChild(placeholder);
        }
    } catch (error) {
        console.error('アノテーショングラフ描画エラー:', error);
    }
}