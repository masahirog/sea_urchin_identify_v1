/**
 * static/evaluation/annotation-analysis.js の修正版
 * 重複描画を防ぐためにChart.jsインスタンスを適切に管理
 */

// グローバル変数でChart.jsインスタンスを管理
let annotationChart = null;

/**
 * アノテーション分析の初期化
 */
function initAnnotationAnalysis() {
    console.log('アノテーション分析モジュールの初期化開始');
    
    // アノテーション分析ボタン
    const analyzeAnnotationsBtn = document.getElementById('analyze-annotations-btn');
    if (analyzeAnnotationsBtn) {
        console.log('アノテーション分析ボタンが見つかりました');
        analyzeAnnotationsBtn.addEventListener('click', function() {
            console.log('アノテーション分析ボタンがクリックされました');
            analyzeAnnotationImpact();
        });
    } else {
        console.error('アノテーション分析ボタンが見つかりません: analyze-annotations-btn');
    }
    
    // リセットボタン
    const resetAnnotationsBtn = document.getElementById('resetAnnotationsBtn');
    if (resetAnnotationsBtn) {
        console.log('リセットボタンが見つかりました');
        resetAnnotationsBtn.addEventListener('click', resetAnnotationData);
    } else {
        console.error('リセットボタンが見つかりません: resetAnnotationsBtn');
    }
    
    console.log('アノテーション分析モジュールの初期化完了');
}

/**
 * アノテーション影響分析の実行
 */
function analyzeAnnotationImpact() {
    console.log('アノテーション影響分析の実行開始');
    
    // 履歴エンドポイントのテスト（接続確認）
    console.log('評価ページのテスト開始');
    
    fetch('/evaluation/history')
    .then(response => {
        console.log('履歴エンドポイントのテスト結果:', response.status, response.ok);
        return response.json();
    })
    .then(data => {
        console.log('履歴データ:', data);
        
        // 履歴が正常に取得できた場合、アノテーション分析を実行
        return executeAnnotationAnalysis();
    })
    .catch(error => {
        console.error('履歴エンドポイントエラー:', error);
        showErrorMessage('サーバーとの接続に問題があります: ' + error.message);
    });
}

/**
 * アノテーション分析の実際の実行
 */
function executeAnnotationAnalysis() {
    console.log('アノテーション分析の実際の実行開始');
    
    // ローディング表示
    showLoading();
    
    // 「処理中」ステータスの表示
    updateEvaluationStatus('evaluationStatus', 'alert-info', 'アノテーション影響分析を準備中...');
    showProgressBar('evaluationProgressContainer', 'evaluationProgressBar', 0);
    
    console.log('アノテーション分析リクエスト送信');
    
    // リクエスト送信（アンダースコア版URL）
    return fetch('/evaluation/analyze_annotation_impact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('アノテーション分析レスポンス:', response.status, response.ok);
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('アノテーション分析データ:', data);
        hideLoading();
        
        if (data.error) {
            console.error('サーバーエラー:', data.error);
            updateEvaluationStatus('evaluationStatus', 'alert-danger', 'エラー: ' + data.error);
            showErrorMessage('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存
        if (window.modelEvaluation) {
            window.modelEvaluation.currentTaskId = data.task_id;
            console.log('タスクID保存:', window.modelEvaluation.currentTaskId);
        }
        
        // 状態表示の更新
        updateEvaluationStatus('evaluationStatus', 'alert-info', 'アノテーション影響分析を開始しました...');
        updateProgressBar('evaluationProgressBar', 10);
        
        // 状態チェックの開始
        console.log('状態チェック開始');
        if (typeof startStatusCheck === 'function') {
            startStatusCheck();
        }
        
        // 成功メッセージの表示
        showSuccessMessage('アノテーション影響分析を開始しました。完了までお待ちください。');
    })
    .catch(error => {
        console.error('アノテーション分析実行エラー:', error);
        hideLoading();
        updateEvaluationStatus('evaluationStatus', 'alert-danger', 'エラー: ' + error.message);
        showErrorMessage('アノテーション分析実行中にエラーが発生しました: ' + error.message);
    });
}

/**
 * アノテーション分析結果の表示（修正版）
 * @param {Object} data - 分析結果データ
 */
function displayAnnotationAnalysis(data) {
    console.log('アノテーション分析結果の表示開始:', data);
    
    // 重複実行を防ぐためのフラグチェック
    if (window.annotationAnalysisDisplayed) {
        console.log('アノテーション分析結果は既に表示済みです');
        return;
    }
    
    // 表示フラグを設定
    window.annotationAnalysisDisplayed = true;
    
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
        const chartContainer = document.getElementById('annotationChartContainer');
        if (chartContainer) {
            chartContainer.appendChild(warningElement);
        }
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
    
    // 一定時間後にフラグをリセット（新しい分析結果を受け入れるため）
    setTimeout(() => {
        window.annotationAnalysisDisplayed = false;
    }, 5000);
}

/**
 * アノテーションデータセット情報の更新
 * @param {Object} data - 分析データ
 */
function updateAnnotationDatasetInfo(data) {
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
 * アノテーション影響画像の更新
 * @param {Object} data - 分析データ
 */
function updateAnnotationImpactImage(data) {
    // ★修正: 新しい画像配信ルートを使用
    if (data.images && data.images.annotation_impact) {
        const imgSrc = '/evaluation/images/' + data.images.annotation_impact;
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
        console.log('グラフ描画開始:', dataset);
        
        // 対象要素の取得
        let chartContainer = document.getElementById('annotationChartContainer');
        if (!chartContainer) {
            const canvas = document.getElementById('annotationImpactImg');
            if (!canvas) {
                console.error('グラフ描画用のコンテナが見つかりません');
                return;
            }
            chartContainer = canvas.parentElement;
        }
        
        // 既存のChart.jsインスタンスがあれば完全に破棄
        if (annotationChart) {
            console.log('既存のChart.jsインスタンスを破棄中...');
            annotationChart.destroy();
            annotationChart = null;
        }
        
        // コンテナを完全にクリア
        chartContainer.innerHTML = '';
        
        // データセット情報の取得と処理
        const male_total = Math.max(0, dataset.male_total || 0);
        const female_total = Math.max(0, dataset.female_total || 0);
        const male_annotated = Math.max(0, dataset.male_annotated || 0);
        const female_annotated = Math.max(0, dataset.female_annotated || 0);
        
        console.log('元データ:', {male_total, female_total, male_annotated, female_annotated});
        
        // データ不整合の場合の処理
        let displayData;
        let warningMessage = null;
        
        if (male_total === 0 && female_total === 0) {
            if (male_annotated > 0 || female_annotated > 0) {
                // ケース: データセット画像0、アノテーション存在
                displayData = {
                    male_total: male_annotated,
                    female_total: female_annotated,
                    male_annotated: male_annotated,
                    female_annotated: female_annotated
                };
                warningMessage = 'データセット画像がないのにアノテーションが存在します';
            } else {
                // ケース: データもアノテーションも0
                displayData = {
                    male_total: 1,
                    female_total: 1,
                    male_annotated: 0,
                    female_annotated: 0
                };
                warningMessage = 'データセットとアノテーションがありません';
            }
        } else {
            // 通常のケース
            displayData = {
                male_total: Math.max(male_total, male_annotated),
                female_total: Math.max(female_total, female_annotated),
                male_annotated: male_annotated,
                female_annotated: female_annotated
            };
        }
        
        console.log('表示用データ:', displayData);
        
        setTimeout(() => {
            try {
                // 新しいキャンバス要素を作成
                const newCanvas = document.createElement('canvas');
                newCanvas.id = 'annotationChartCanvas';
                newCanvas.width = 400;
                newCanvas.height = 300;
                newCanvas.style.maxWidth = '100%';
                newCanvas.style.height = 'auto';
                
                chartContainer.appendChild(newCanvas);
                
                // Chart.jsが読み込まれているか確認
                if (typeof Chart !== 'undefined') {
                    // グラフデータ
                    const chartData = {
                        labels: ['オス', 'メス', '合計'],
                        datasets: [
                            {    
                                label: 'アノテーション済み',
                                data: [
                                    displayData.male_annotated, 
                                    displayData.female_annotated, 
                                    displayData.male_annotated + displayData.female_annotated
                                ],
                                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            },
                            {
                                label: '未アノテーション',
                                data: [
                                    displayData.male_total - displayData.male_annotated, 
                                    displayData.female_total - displayData.female_annotated, 
                                    (displayData.male_total - displayData.male_annotated) + 
                                    (displayData.female_total - displayData.female_annotated)
                                ],
                                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 1
                            }
                        ]
                    };
                   
                    // グラフオプション
                    const maxValue = Math.max(5, displayData.male_total + displayData.female_total);
                    const options = {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 0
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: maxValue + 1,
                                title: {
                                    display: true,
                                    text: '画像数'
                                },
                                ticks: {
                                    stepSize: 1,
                                    precision: 0
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
                                text: warningMessage ? 
                                    `データセットのアノテーション状況 (${warningMessage})` :
                                    'データセットのアノテーション状況'
                            }
                        }
                    };
                   
                    // グラフを描画
                    console.log('Chart.jsでグラフを作成中...');
                    annotationChart = new Chart(newCanvas, {
                        type: 'bar',
                        data: chartData,
                        options: options
                    });
                    
                    console.log('グラフ作成完了。Chart ID:', annotationChart.id);
                    
                } else {
                    // Chart.jsが読み込まれていない場合の代替表示
                    console.log('Chart.js未読み込み - 代替表示を作成');
                    const placeholder = document.createElement('div');
                    placeholder.className = 'text-center p-5 bg-light border rounded';
                    placeholder.innerHTML = `
                        <i class="fas fa-chart-bar text-muted mb-3" style="font-size: 3rem;"></i>
                        <h5>アノテーション状況</h5>
                        <p class="mb-1">オス: ${displayData.male_annotated}/${displayData.male_total}</p>
                        <p class="mb-1">メス: ${displayData.female_annotated}/${displayData.female_total}</p>
                        <p class="mb-0">合計: ${displayData.male_annotated + displayData.female_annotated}/${displayData.male_total + displayData.female_total}</p>
                        ${warningMessage ? `<div class="alert alert-warning mt-2 mb-0"><small>${warningMessage}</small></div>` : ''}
                    `;
                    chartContainer.appendChild(placeholder);
                }
                
            } catch (innerError) {
                console.error('グラフ作成中の内部エラー:', innerError);
                
                // エラー時のフォールバック表示
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-warning text-center';
                errorDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle mb-2"></i>
                    <p class="mb-1">グラフの表示中にエラーが発生しました</p>
                    <small>オス: ${displayData.male_annotated}/${displayData.male_total}, メス: ${displayData.female_annotated}/${displayData.female_total}</small>
                `;
                chartContainer.appendChild(errorDiv);
            }
        }, 100);
        
    } catch (error) {
        console.error('アノテーショングラフ描画エラー:', error);
        
        // エラー時のフォールバック
        const chartContainer = document.getElementById('annotationChartContainer') || 
                              document.getElementById('annotationImpactImg')?.parentElement;
        
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-circle mb-2"></i>
                    <p class="mb-0">グラフの描画中にエラーが発生しました</p>
                </div>
            `;
        }
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
    
    // 既存のグラフを破棄
    if (annotationChart) {
        annotationChart.destroy();
        annotationChart = null;
    }
    
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
            // 表示フラグをリセット
            window.annotationAnalysisDisplayed = false;
            
            // 入力欄をクリア
            document.getElementById('resetConfirmation').value = '';
            
            // 成功メッセージの表示
            showSuccessMessage(data.message);
            
            // 履歴の再読み込み
            if (typeof loadEvaluationHistory === 'function') {
                loadEvaluationHistory();
            }
            
            // 結果表示を隠して、プレースホルダーを表示
            const evaluationResult = document.getElementById('evaluationResult');
            const evaluationPlaceholder = document.getElementById('evaluationPlaceholder');
            const annotationResult = document.getElementById('annotationResult');
            const annotationPlaceholder = document.getElementById('annotationPlaceholder');
            
            if (evaluationResult) evaluationResult.classList.add('d-none');
            if (evaluationPlaceholder) {
                evaluationPlaceholder.classList.remove('d-none');
                evaluationPlaceholder.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-check-circle fa-3x mb-3 text-success" aria-hidden="true"></i>
                        <p>アノテーションデータが正常にリセットされました。</p>
                        <p class="text-muted mt-3">新しいアノテーションを作成するには、サンプル分析ページに移動してください。</p>
                        <a href="/sample/analyze-samples" class="btn btn-primary mt-3">
                            <i class="fas fa-microscope me-2" aria-hidden="true"></i> サンプル分析ページへ
                        </a>
                    </div>
                `;
            }
            
            if (annotationResult) annotationResult.classList.add('d-none');
            if (annotationPlaceholder) {
                annotationPlaceholder.classList.remove('d-none');
                annotationPlaceholder.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-tag fa-3x mb-3 text-muted" aria-hidden="true"></i>
                        <p class="text-muted">アノテーションデータはリセットされました。新しいアノテーションを作成してください。</p>
                    </div>
                `;
            }
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