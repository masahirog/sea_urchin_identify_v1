/**
 * ウニ生殖乳頭分析システム - モデル評価モジュール
 * モデル評価とアノテーション影響分析のための機能
 */

// モジュールの状態を管理する変数
const modelEvaluation = {
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
    // 評価実行ボタン
    addSafeEventListener('runEvaluationBtn', 'click', runModelEvaluation);
    
    // アノテーション分析ボタン
    addSafeEventListener('analyzeAnnotationsBtn', 'click', analyzeAnnotationImpact);
    
    // 履歴読み込み
    loadEvaluationHistory();
    
    // 最新の評価結果を取得
    loadLatestEvaluation();
    
    // リセットボタン
    addSafeEventListener('resetAnnotationsBtn', 'click', resetAnnotationData);
}

/**
 * モデル評価の実行
 */
function runModelEvaluation() {
    // ローディング表示
    showLoading();
    
    // 「処理中」ステータスの表示
    updateEvaluationStatus('evaluationStatus', 'alert-info', '評価を準備中...');
    showProgressBar('evaluationProgressContainer', 'evaluationProgressBar', 0);
    
    // リクエスト送信
    fetch('/evaluation/run_evaluation', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            updateEvaluationStatus('evaluationStatus', 'alert-danger', 'エラー: ' + data.error);
            showErrorMessage('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存
        modelEvaluation.currentTaskId = data.task_id;
        
        // 状態表示の更新
        updateEvaluationStatus('evaluationStatus', 'alert-info', '評価を開始しました...');
        updateProgressBar('evaluationProgressBar', 10);
        
        // 状態チェックの開始
        startStatusCheck();
        
        // 成功メッセージの表示
        showSuccessMessage('モデル評価を開始しました。完了までお待ちください。');
    })
    .catch(error => {
        hideLoading();
        console.error('評価実行エラー:', error);
        showErrorMessage('評価実行中にエラーが発生しました: ' + error);
        
        updateEvaluationStatus('evaluationStatus', 'alert-danger', 'エラー: 通信に失敗しました');
    });
}

/**
 * 評価ステータスの更新
 * @param {string} elementId - ステータス要素のID
 * @param {string} alertClass - アラートのクラス
 * @param {string} message - 表示するメッセージ
 */
function updateEvaluationStatus(elementId, alertClass, message) {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) return;
    
    statusElement.classList.remove('d-none');
    statusElement.className = 'alert ' + alertClass;
    statusElement.textContent = message;
}

/**
 * プログレスバーの表示
 * @param {string} containerId - プログレスバーコンテナのID
 * @param {string} barId - プログレスバー要素のID
 * @param {number} progress - 進捗値（0-100）
 */
function showProgressBar(containerId, barId, progress) {
    const container = document.getElementById(containerId);
    const bar = document.getElementById(barId);
    
    if (!container || !bar) return;
    
    container.classList.remove('d-none');
    updateProgressBar(barId, progress);
}

/**
 * プログレスバーの更新
 * @param {string} barId - プログレスバー要素のID
 * @param {number} progress - 進捗値（0-100）
 */
function updateProgressBar(barId, progress) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    
    bar.style.width = progress + '%';
    bar.textContent = Math.round(progress) + '%';
}

/**
 * アノテーション影響分析の実行
 */
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
        modelEvaluation.currentTaskId = data.task_id;
        
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

/**
 * 成功メッセージの表示
 * @param {string} message - 表示するメッセージ
 */
function showSuccessMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-success alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        <i class="fas fa-check-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
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
}

/**
 * エラーメッセージの表示
 * @param {string} message - 表示するメッセージ
 */
function showErrorMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger alert-dismissible fade show';
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        
        // 自動的に閉じる
        setTimeout(() => {
            try {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            } catch (e) {
                // フォールバック
                alertElement.remove();
            }
        }, 5000);
    }
}

/**
 * 状態チェックの開始
 */
function startStatusCheck() {
    // 既存のタイマーをクリア
    if (modelEvaluation.statusCheckInterval) {
        clearInterval(modelEvaluation.statusCheckInterval);
    }
    
    // エラーカウントリセット
    modelEvaluation.taskStatusErrorCount = 0;
    
    // 新しいタイマーの設定
    modelEvaluation.statusCheckInterval = setInterval(checkTaskStatus, 1000);
}

/**
 * タスク状態のチェック
 */
function checkTaskStatus() {
    if (!modelEvaluation.currentTaskId) return;
    
    // APIエンドポイントのパスを修正
    fetch('/api/task-status/' + modelEvaluation.currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('状態取得に失敗しました: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        // エラーカウントリセット
        modelEvaluation.taskStatusErrorCount = 0;
        
        // 状態の表示
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error' || 
            data.status === 'failed') {
            // タイマーの停止
            clearInterval(modelEvaluation.statusCheckInterval);
            modelEvaluation.statusCheckInterval = null;
            
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
        
        // エラーカウントを増加
        modelEvaluation.taskStatusErrorCount++;
        
        // エラーが続く場合は停止（5回でギブアップ）
        if (modelEvaluation.taskStatusErrorCount >= 5) {
            clearInterval(modelEvaluation.statusCheckInterval);
            modelEvaluation.statusCheckInterval = null;
            
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

/**
 * 評価履歴の読み込み
 */
function loadEvaluationHistory() {
    console.log("評価履歴の読み込み開始");
    
    // ローディング表示
    const historyContainer = document.getElementById('historyList');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">履歴を読み込んでいます...</p>
            </div>
        `;
    }
    
    fetch('/evaluation/history')
    .then(response => {
        console.log("履歴レスポンスステータス:", response.status);
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("取得した履歴データ:", data);
        
        const historyList = document.getElementById('historyList');
        if (!historyList) {
            console.error("historyList要素が見つかりません");
            return;
        }
        
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
            // タイムスタンプを読みやすい日付に変換
            const date = formatEvaluationDate(item.timestamp);
            const accuracy = (item.cv_mean * 100).toFixed(1) + '%';
            
            const historyItem = document.createElement('a');
            historyItem.href = '#';
            historyItem.className = 'list-group-item list-group-item-action history-item';
            historyItem.dataset.id = item.timestamp;
            historyItem.dataset.type = item.type || 'evaluation';
            
            historyItem.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${date}</h6>
                    <span class="badge bg-primary">${accuracy}</span>
                </div>
                <p class="mb-1 small">${item.type === 'annotation' ? 'アノテーション分析' : 'モデル評価結果'}</p>
            `;
            
            historyItem.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("履歴項目クリック:", item.timestamp);
                
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
        if (historyList) {
            historyList.innerHTML = `
                <div class="text-center py-3 text-danger">
                    <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                    <p>履歴の読み込み中にエラーが発生しました: ${error.message}</p>
                    <button class="btn btn-sm btn-outline-secondary mt-2" 
                            onclick="loadEvaluationHistory()">再試行</button>
                </div>
            `;
        }
    });
}

/**
 * 評価タイムスタンプを日付形式に変換
 * @param {string} timestamp - YYYYMMdd_HHmmss形式のタイムスタンプ
 * @returns {string} フォーマットされた日付文字列
 */
function formatEvaluationDate(timestamp) {
    if (!timestamp || timestamp.length < 15) return 'Invalid date';
    
    try {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = timestamp.substring(9, 11);
        const minute = timestamp.substring(11, 13);
        const second = timestamp.substring(13, 15);
        
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        return date.toLocaleString();
    } catch (e) {
        console.error('日付変換エラー:', e);
        return timestamp;
    }
}

/**
 * 最新の評価結果を読み込む
 */
function loadLatestEvaluation() {
    console.log("最新評価結果読み込み開始");
    
    fetch('/evaluation/get-latest-result')
    .then(response => {
        console.log("レスポンスステータス:", response.status);
        if (!response.ok) {
            if (response.status === 404) {
                console.log("評価結果がまだありません");
                // 評価結果がない場合のUI表示処理
                const placeholder = document.getElementById('evaluationPlaceholder');
                if (placeholder) {
                    placeholder.classList.remove('d-none');
                    placeholder.innerHTML = `
                        <div class="text-center py-5">
                            <i class="fas fa-info-circle fa-3x mb-3 text-muted" aria-hidden="true"></i>
                            <p class="text-muted">評価履歴がありません。評価を実行するか、新しいアノテーションを作成してください。</p>
                        </div>
                    `;
                }
                
                // アノテーション結果も隠す
                const annoResult = document.getElementById('annotationResult');
                const annoPlaceholder = document.getElementById('annotationPlaceholder');
                if (annoResult) annoResult.classList.add('d-none');
                if (annoPlaceholder) {
                    annoPlaceholder.classList.remove('d-none');
                    annoPlaceholder.innerHTML = `
                        <div class="text-center py-5">
                            <i class="fas fa-tag fa-3x mb-3 text-muted" aria-hidden="true"></i>
                            <p class="text-muted">アノテーションデータはリセットされました。新しいアノテーションを作成してください。</p>
                        </div>
                    `;
                }
                
                return null;
            }
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log("取得データ:", data);
        
        if (!data) {
            console.log("データがありません");
            return;
        }
        
        // 評価結果を表示（既存のコード）
        if (data.details) {
            displayEvaluationResult(data.details, data.summary.timestamp);
            
            // 履歴リストの該当項目をアクティブに
            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.id === data.summary.timestamp) {
                    item.classList.add('active');
                }
            });
        } else {
            console.error("詳細データがありません:", data);
        }
    })
    .catch(error => {
        console.error('最新評価結果読み込みエラー:', error);
        
        // エラー表示
        const placeholder = document.getElementById('evaluationPlaceholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <p>評価データを読み込めませんでした。アノテーションデータがリセットされたか、まだ実行されていない可能性があります。</p>
                </div>
            `;
            placeholder.classList.remove('d-none');
        }
    });
}


/**
 * 特定の評価結果を読み込む
 * @param {string} timestamp - 評価結果のタイムスタンプ
 */
function loadEvaluationResult(timestamp) {
    fetch('/evaluation/get-specific-result/' + timestamp)
    .then(response => {
        if (!response.ok) {
            throw new Error('サーバーレスポンスが不正です: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        // 評価結果を表示
        displayEvaluationResult(data.details, timestamp);
    })
    .catch(error => {
        console.error('評価結果読み込みエラー:', error);
        alert('評価結果の読み込みに失敗しました: ' + error);
    });
}

/**
 * 評価結果の表示
 * @param {Object} data - 評価結果データ
 * @param {string} timestamp - 評価のタイムスタンプ
 */
function displayEvaluationResult(data, timestamp) {
    console.log("表示データ:", data);
    console.log("タイムスタンプ:", timestamp);

    // プレースホルダーを非表示、結果を表示
    const placeholder = document.getElementById('evaluationPlaceholder');
    const result = document.getElementById('evaluationResult');
    
    if (placeholder) placeholder.classList.add('d-none');
    if (result) {
        result.classList.remove('d-none');
        
        // デバッグ用の簡易表示（問題の切り分け用）
        result.innerHTML = `
            <div class="alert alert-info">
                <h4>データ取得成功</h4>
                <p>タイムスタンプ: ${timestamp}</p>
                <p>アノテーション率: ${data.cv_mean * 100}%</p>
                <p>データセット: オス(${data.dataset?.male_total || 0})、メス(${data.dataset?.female_total || 0})</p>
                <p>アノテーション: オス(${data.dataset?.male_annotated || 0})、メス(${data.dataset?.female_annotated || 0})</p>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <img src="/static/evaluation/annotation_impact_${timestamp}.png" 
                         class="img-fluid" alt="アノテーション影響">
                </div>
            </div>
        `;
    }
}

/**
 * メトリクス値の更新
 * @param {Object} data - 評価データ
 */
function updateMetricsValues(data) {
    // データが存在しない場合のデフォルト値
    const defaultValue = 'N/A';
    
    // 精度値の設定
    setMetricText('accuracyValue', data?.cv_mean);
    
    // 分類レポートから適合率と再現率を設定
    const report = data?.classification_report || {};
    
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
}

/**
 * 評価画像の更新
 * @param {string} timestamp - 評価タイムスタンプ
 */
function updateEvaluationImages(timestamp) {
    // 学習曲線の画像
    setImageWithFallback('learningCurveImg', '/evaluation/static/evaluation/learning_curve_' + timestamp + '.png');
    
    // 混同行列の画像
    setImageWithFallback('confusionMatrixImg', '/evaluation/static/evaluation/confusion_matrix_' + timestamp + '.png');
    
    // ROCカーブの画像
    setImageWithFallback('rocCurveImg', '/evaluation/static/evaluation/roc_curve_' + timestamp + '.png');
}

/**
 * クロスバリデーションスコアの更新
 * @param {Object} data - 評価データ
 */
function updateCrossValidationScores(data) {
    const cvScoresTableBody = document.getElementById('cvScoresTableBody');
    if (!cvScoresTableBody) return;
    
    cvScoresTableBody.innerHTML = '';
    
    if (data?.cv_scores && data.cv_scores.length > 0) {
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
        
        document.getElementById('cvMeanValue').textContent = 'N/A';
        document.getElementById('cvStdValue').textContent = 'N/A';
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

/**
* アノテーション分析結果の表示
* @param {Object} data - 分析結果データ
*/
function displayAnnotationAnalysis(data) {
    // プレースホルダーを非表示、結果を表示
    const placeholder = document.getElementById('annotationPlaceholder');
    const result = document.getElementById('annotationResult');
    const dataset = data.dataset || {};

    // 基本情報の設定
    setElementText('maleTotalCount', dataset.male_total || 0);
    setElementText('maleAnnotatedCount', dataset.male_annotated || 0);
    setElementText('femaleTotalCount', dataset.female_total || 0);
    setElementText('femaleAnnotatedCount', dataset.female_annotated || 0);

    // 警告表示（もしあれば）
    if (dataset.warning) {
        const warningElement = document.createElement('div');
        warningElement.className = 'alert alert-warning mt-3';
        warningElement.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>警告:</strong> ${dataset.warning}
        `;
        document.getElementById('annotationChartContainer').appendChild(warningElement);
    }

    if (placeholder) placeholder.classList.add('d-none');
    if (result) result.classList.remove('d-none');
   
    try {
        // データセット情報を表示
        updateAnnotationDatasetInfo(data);
       
        // アノテーション影響の画像
        updateAnnotationImpactImage(data);
       
        // アノテーションのインサイト
        updateAnnotationInsight(data);
    } catch (error) {
        console.error('アノテーション分析表示エラー:', error);
        showErrorMessage('アノテーション分析の表示中にエラーが発生しました');
    }
}

/**
* アノテーションデータセット情報の更新
* @param {Object} data - 分析データ
*/
function updateAnnotationDatasetInfo(data) {
    // データセット情報を表示
    const dataset = data.dataset || {};
   
    // 基本情報の設定
    setElementText('maleTotalCount', dataset.male_total || 0);
    setElementText('maleAnnotatedCount', dataset.male_annotated || 0);
    setElementText('femaleTotalCount', dataset.female_total || 0);
    setElementText('femaleAnnotatedCount', dataset.female_annotated || 0);
   
    // アノテーション率
    const annotationRate = dataset.annotation_rate || 0;
    setElementText('annotationRate', (annotationRate * 100).toFixed(1) + '%');
}

/**
* 要素にテキストを設定
* @param {string} elementId - 要素ID
* @param {string|number} text - 設定するテキスト
*/
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
* アノテーション影響画像の更新
* @param {Object} data - 分析データ
*/
function updateAnnotationImpactImage(data) {
    if (data.images && data.images.annotation_impact) {
        const imgSrc = '/evaluation/static/evaluation/' + data.images.annotation_impact;
        setImageWithFallback('annotationImpactImg', imgSrc);
    } else {
        // 画像がない場合はデータからグラフを生成
        renderAnnotationChart(data.dataset || {});
    }
}

/**
* アノテーションのインサイト更新
* @param {Object} data - 分析データ
*/
function updateAnnotationInsight(data) {
    const dataset = data.dataset || {};
    const annotationRate = dataset.annotation_rate || 0;
    let insightMessage = '';
   
    if (annotationRate < 0.3) {
        insightMessage = 'アノテーション率が低いため、モデルの性能が十分に発揮されていない可能性があります。より多くの画像にアノテーションを追加することで性能が向上する可能性があります。';
    } else if (annotationRate < 0.7) {
        insightMessage = 'アノテーションの割合は中程度です。より多くのアノテーションを追加することで、モデルの性能向上が期待できます。';
    } else {
        insightMessage = 'アノテーション率が高く、モデルの学習に十分なデータが提供されています。このまま継続して新しいサンプルのアノテーションを行うことで、モデルの精度を維持・向上できるでしょう。';
    }
   
    setElementText('annotationInsight', insightMessage);
}

/**
* データセット情報からグラフを描画（Chart.jsを使用）
* @param {Object} dataset - データセット情報
*/
function renderAnnotationChart(dataset) {
    try {
        const canvas = document.getElementById('annotationImpactImg');
        if (!canvas) return;
       
        // キャンバス要素をリセット
        const chartContainer = canvas.parentElement;
        if (!chartContainer) return;
       
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

/**
* アノテーションデータをリセットする
*/
function resetAnnotationData() {
    const confirmationText = document.getElementById('resetConfirmation').value;
    
    if (confirmationText !== "DELETE ANNOTATION") {
        showErrorMessage('確認テキストが正しくありません。「DELETE ANNOTATION」と正確に入力してください。');
        return;
    }
    
    // 最終確認ダイアログ
    if (!confirm('すべてのアノテーションデータを削除します。この操作は取り消せません。本当に続行しますか？')) {
        return;
    }
    
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/evaluation/reset-annotations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            confirmation: confirmationText
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.success) {
            // 入力欄をクリア
            document.getElementById('resetConfirmation').value = '';
            
            // 成功メッセージの表示
            showSuccessMessage(data.message);
            
            // 履歴の再読み込み
            loadEvaluationHistory();
            
            // 結果表示を隠して、プレースホルダーを表示
            document.getElementById('evaluationResult').classList.add('d-none');
            document.getElementById('evaluationPlaceholder').classList.remove('d-none');
            document.getElementById('evaluationPlaceholder').innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-check-circle fa-3x mb-3 text-success" aria-hidden="true"></i>
                    <p>アノテーションデータが正常にリセットされました。</p>
                    <p class="text-muted mt-3">新しいアノテーションを作成するには、サンプル分析ページに移動してください。</p>
                    <a href="/sample/analyze-samples" class="btn btn-primary mt-3">
                        <i class="fas fa-microscope me-2" aria-hidden="true"></i> サンプル分析ページへ
                    </a>
                </div>
            `;
            
            // アノテーション結果も隠す
            document.getElementById('annotationResult').classList.add('d-none');
            document.getElementById('annotationPlaceholder').classList.remove('d-none');
            document.getElementById('annotationPlaceholder').innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-tag fa-3x mb-3 text-muted" aria-hidden="true"></i>
                    <p class="text-muted">アノテーションデータはリセットされました。新しいアノテーションを作成してください。</p>
                </div>
            `;
        } else {
            showErrorMessage(data.message);
        }
    })
    .catch(error => {
        hideLoading();
        console.error('リセット処理エラー:', error);
        showErrorMessage('リセット処理中にエラーが発生しました: ' + error);
    });
}