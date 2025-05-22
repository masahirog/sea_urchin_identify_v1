/**
 * ウニ生殖乳頭分析システム - 評価履歴・表示モジュール
 * 評価履歴の読み込み、表示、結果表示機能
 */

/**
 * 評価履歴・表示の初期化
 */
function initEvaluationHistory() {
    console.log('評価履歴モジュールの初期化開始');
    loadEvaluationHistory();
    loadLatestEvaluation();
    console.log('評価履歴モジュールの初期化完了');
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
        showErrorMessage('評価結果の読み込みに失敗しました: ' + error);
    });
}

/**
 * evaluation-history.js の displayEvaluationResult 関数を修正
 * 重複実行を防ぐ
 */

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
        
        // アノテーション分析の結果表示
        if (data.dataset) {
            // アノテーション分析結果の場合
            console.log("アノテーション分析結果を表示 - 重複チェック中");
            
            // 重複実行防止: 既に表示中の場合はスキップ
            if (!window.annotationAnalysisDisplayed) {
                console.log("アノテーション分析結果を表示します");
                if (typeof displayAnnotationAnalysis === 'function') {
                    displayAnnotationAnalysis(data);
                }
            } else {
                console.log("アノテーション分析結果は既に表示済みのためスキップ");
            }
        } else {
            // 通常の評価結果の場合
            console.log("通常の評価結果を表示");
            updateMetricsValues(data);
            updateEvaluationImages(timestamp);
            updateCrossValidationScores(data);
        }
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
    // ★修正: 新しい画像配信ルートを使用
    // 学習曲線の画像
    setImageWithFallback('learningCurveImg', '/evaluation/images/learning_curve_' + timestamp + '.png');
    
    // 混同行列の画像
    setImageWithFallback('confusionMatrixImg', '/evaluation/images/confusion_matrix_' + timestamp + '.png');
    
    // ROCカーブの画像
    setImageWithFallback('rocCurveImg', '/evaluation/images/roc_curve_' + timestamp + '.png');
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