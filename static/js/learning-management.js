/**
 * ウニ生殖乳頭分析システム - 学習管理サービス
 * 学習データ作成からモデル評価まで統合した機能
 */

// 学習管理サービスの状態管理
const learningManagementService = {
    currentTaskId: null,
    statusCheckInterval: null,
    learningData: {
        male: [],
        female: [],
        unknown: []
    },
    statistics: {
        male_count: 0,
        female_count: 0,
        annotation_count: 0,
        total_count: 0
    },
    evaluationResults: null,
    learningHistory: []
};

/**
 * ページ初期化処理
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('学習管理サービス初期化開始');
    initLearningManagementService();
});

/**
 * 学習管理サービスの初期化
 */
function initLearningManagementService() {
    console.log('学習管理サービスの初期化開始');
    
    // フォーム・ボタンイベントの設定
    initDataUploadForm();
    initTrainingButtons();
    initEvaluationButtons();
    initFilterButtons();
    
    // 初期データの読み込み
    loadDatasetStatistics();
    loadLearningData();
    loadLearningHistory();
    
    // タブ切り替え時のイベント
    initTabEvents();
    
    console.log('学習管理サービスの初期化完了');
}

/**
 * データアップロードフォームの初期化
 */
function initDataUploadForm() {
    const uploadForm = document.getElementById('learningDataUploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            uploadLearningData();
        });
        console.log('データアップロードフォームイベント設定完了');
    }
}

/**
 * 訓練関連ボタンの初期化
 */
function initTrainingButtons() {
    // モデル訓練開始ボタン
    const startTrainingBtn = document.getElementById('startTrainingBtn');
    if (startTrainingBtn) {
        startTrainingBtn.addEventListener('click', function() {
            startModelTraining();
        });
    }
    
    // データセット更新ボタン
    const refreshDatasetBtn = document.getElementById('refreshDatasetBtn');
    if (refreshDatasetBtn) {
        refreshDatasetBtn.addEventListener('click', function() {
            loadDatasetStatistics();
            loadLearningData();
        });
    }
    
    console.log('訓練ボタンイベント設定完了');
}

/**
 * 評価関連ボタンの初期化
 */
function initEvaluationButtons() {
    // 詳細評価実行ボタン
    const runEvaluationBtn = document.getElementById('runEvaluationBtn');
    if (runEvaluationBtn) {
        runEvaluationBtn.addEventListener('click', function() {
            startModelEvaluation();
        });
    }
    
    // アノテーション効果分析ボタン
    const analyzeAnnotationBtn = document.getElementById('analyzeAnnotationBtn');
    if (analyzeAnnotationBtn) {
        analyzeAnnotationBtn.addEventListener('click', function() {
            startAnnotationAnalysis();
        });
    }
    
    console.log('評価ボタンイベント設定完了');
}

/**
 * フィルターボタンの初期化
 */
function initFilterButtons() {
    // 性別フィルター
    const genderFilters = document.querySelectorAll('input[name="genderFilter"]');
    genderFilters.forEach(filter => {
        filter.addEventListener('change', function() {
            filterLearningData(this.value);
        });
    });
    
    // 履歴更新ボタン
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', function() {
            loadLearningHistory();
        });
    }
    
    console.log('フィルターボタンイベント設定完了');
}

/**
 * タブイベントの初期化
 */
function initTabEvents() {
    // モデル訓練・評価タブが選択されたときにデータを更新
    const modelTrainingTab = document.getElementById('model-training-tab');
    if (modelTrainingTab) {
        modelTrainingTab.addEventListener('click', function() {
            updateTrainingTabData();
        });
    }
    
    // 学習履歴タブが選択されたときに履歴を更新
    const learningHistoryTab = document.getElementById('learning-history-tab');
    if (learningHistoryTab) {
        learningHistoryTab.addEventListener('click', function() {
            loadLearningHistory();
        });
    }
}

/**
 * 学習データのアップロード
 */
function uploadLearningData() {
    const fileInput = document.getElementById('learningDataFile');
    const genderSelect = document.getElementById('dataGender');
    
    const files = fileInput.files;
    const gender = genderSelect.value;
    
    if (files.length === 0) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    console.log(`学習データアップロード開始: ${files.length}ファイル, 性別: ${gender}`);
    
    // フォームデータの作成
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    formData.append('gender', gender);
    
    // アップロード進捗表示
    showUploadProgress(0);
    
    // AJAX送信
    fetch('/learning/upload-data', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        hideUploadProgress();
        
        if (data.error) {
            console.error('アップロードエラー:', data.error);
            showError('アップロードエラー: ' + data.error);
            return;
        }
        
        console.log('アップロード完了:', data);
        
        // 成功メッセージ
        let message = data.message;
        if (data.error_count > 0) {
            message += ` (${data.error_count}ファイルでエラー)`;
        }
        showSuccessMessage(message);
        
        // フォームリセット
        fileInput.value = '';
        
        // データ更新
        loadDatasetStatistics();
        loadLearningData();
        
    })
    .catch(error => {
        hideUploadProgress();
        console.error('アップロードエラー:', error);
        showError('アップロード中にエラーが発生しました: ' + error.message);
    });
}

/**
 * アップロード進捗の表示
 * @param {number} progress - 進捗（0-100）
 */
function showUploadProgress(progress) {
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const statusText = document.getElementById('uploadStatus');
    
    if (progressContainer) {
        progressContainer.classList.remove('d-none');
    }
    
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
    
    if (statusText) {
        statusText.textContent = progress < 100 ? 'アップロード中...' : 'アップロード完了';
    }
}

/**
 * アップロード進捗の非表示
 */
function hideUploadProgress() {
    const progressContainer = document.getElementById('uploadProgress');
    if (progressContainer) {
        progressContainer.classList.add('d-none');
    }
}

/**
 * データセット統計の読み込み
 */
function loadDatasetStatistics() {
    fetch('/learning/dataset-stats')
    .then(response => {
        if (!response.ok) {
            throw new Error('統計取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        learningManagementService.statistics = data;
        updateStatisticsDisplay();
        console.log('データセット統計更新:', data);
    })
    .catch(error => {
        console.error('統計読み込みエラー:', error);
    });
}

/**
 * 統計表示の更新
 */
function updateStatisticsDisplay() {
    const stats = learningManagementService.statistics;
    
    // 各カウンターの更新
    setElementText('maleDataCount', stats.male_count);
    setElementText('femaleDataCount', stats.female_count);
    setElementText('annotatedCount', stats.annotation_count);
    
    // 比率バーの更新
    const maleBar = document.getElementById('maleDataBar');
    const femaleBar = document.getElementById('femaleDataBar');
    
    if (maleBar && femaleBar) {
        const maleRatio = stats.ratios?.male || 0;
        const femaleRatio = stats.ratios?.female || 0;
        
        maleBar.style.width = maleRatio + '%';
        femaleBar.style.width = femaleRatio + '%';
    }
    
    // 訓練タブの統計も更新
    setElementText('trainMaleCount', stats.male_count + '枚');
    setElementText('trainFemaleCount', stats.female_count + '枚');
    setElementText('trainAnnotatedCount', stats.annotation_count + '枚');
}

/**
 * 学習データの読み込み
 */
function loadLearningData(genderFilter = 'all') {
    const url = genderFilter !== 'all' ? 
        `/learning/learning-data?gender=${genderFilter}` : 
        '/learning/learning-data';
    
    fetch(url)
    .then(response => {
        if (!response.ok) {
            throw new Error('学習データ取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        learningManagementService.learningData = data;
        displayLearningData();
        console.log('学習データ更新:', data.counts);
    })
    .catch(error => {
        console.error('学習データ読み込みエラー:', error);
        showError('学習データの読み込みに失敗しました');
    });
}

/**
 * 学習データの表示
 */
function displayLearningData() {
    const container = document.getElementById('learningDataContainer');
    if (!container) return;
    
    const data = learningManagementService.learningData;
    const allImages = [...data.male, ...data.female, ...data.unknown];
    
    if (allImages.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-database fa-3x mb-3" aria-hidden="true"></i>
                <p>学習データをアップロードすると、ここに表示されます</p>
                <small class="text-muted">画像をクリックしてアノテーションを行ってください</small>
            </div>
        `;
        return;
    }
    
    // 画像カードの生成
    const imageCards = allImages.map(item => {
        const genderClass = item.category === 'male' ? 'border-primary' : 
                           item.category === 'female' ? 'border-danger' : 'border-secondary';
        const genderIcon = item.category === 'male' ? 'fas fa-mars text-primary' : 
                          item.category === 'female' ? 'fas fa-venus text-danger' : 'fas fa-question text-secondary';
        const annotationBadge = item.has_annotation ? 
            '<span class="badge bg-success position-absolute top-0 end-0 m-1">✓</span>' : '';
        
        return `
            <div class="image-card sample-card ${genderClass}" data-path="${item.path}">
                ${annotationBadge}
                <img src="${item.url}" alt="${item.filename}" class="image-preview" 
                     onclick="selectLearningImage('${item.path}')">
                <div class="image-info">
                    <i class="${genderIcon} me-1"></i>
                    ${item.filename}
                </div>
                <div class="image-controls">
                    <button class="btn btn-sm btn-outline-primary" onclick="selectLearningImage('${item.path}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteLearningImage('${item.path}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = imageCards;
}

/**
 * 学習データのフィルタリング
 * @param {string} gender - フィルター条件
 */
function filterLearningData(gender) {
    console.log('学習データフィルター:', gender);
    loadLearningData(gender);
}

/**
 * 学習画像の選択（アノテーション開始）
 * @param {string} imagePath - 画像パス
 */
function selectLearningImage(imagePath) {
    console.log('学習画像選択:', imagePath);
    
    // 選択状態の更新
    document.querySelectorAll('.sample-card').forEach(card => {
        card.classList.remove('selected-sample');
    });
    
    const selectedCard = document.querySelector(`.sample-card[data-path="${imagePath}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected-sample');
    }
    
    // アノテーション開始（既存のannotation_tools.jsを使用）
    if (typeof openAnnotationModal === 'function') {
        openAnnotationModal(imagePath);
    } else {
        console.error('openAnnotationModal関数が見つかりません');
        showError('アノテーション機能が利用できません');
    }
}

/**
 * 学習画像の削除
 * @param {string} imagePath - 削除する画像パス
 */
function deleteLearningImage(imagePath) {
    if (!confirm('この学習データを削除してもよろしいですか？\n関連するアノテーションも削除されます。')) {
        return;
    }
    
    console.log('学習画像削除:', imagePath);
    
    fetch('/learning/delete-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            path: imagePath
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('削除に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        showSuccessMessage(data.message);
        
        // データ更新
        loadDatasetStatistics();
        loadLearningData();
    })
    .catch(error => {
        console.error('削除エラー:', error);
        showError('削除中にエラーが発生しました: ' + error.message);
    });
}

/**
 * モデル訓練の開始
 */
function startModelTraining() {
    console.log('モデル訓練開始');
    
    // 前提条件チェック
    const stats = learningManagementService.statistics;
    if (stats.male_count === 0 || stats.female_count === 0) {
        alert('オスとメスの両方の学習データが必要です');
        return;
    }
    
    if (stats.total_count < 10) {
        alert(`学習データが不足しています。最低10枚必要ですが、現在${stats.total_count}枚です`);
        return;
    }
    
    // 訓練状況表示
    showTrainingStatus('モデル訓練を開始しています...', 'alert-info', 5);
    
    fetch('/learning/start-training', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        learningManagementService.currentTaskId = data.task_id;
        console.log('モデル訓練タスク開始:', data.task_id);
        
        showTrainingStatus('モデル訓練中...', 'alert-info', 10);
        startTaskStatusCheck();
        
        showSuccessMessage('モデル訓練を開始しました');
    })
    .catch(error => {
        console.error('モデル訓練開始エラー:', error);
        showTrainingStatus('エラー: ' + error.message, 'alert-danger', 0);
        showError('モデル訓練の開始に失敗しました: ' + error.message);
    });
}

/**
 * モデル評価の開始
 */
function startModelEvaluation() {
    console.log('モデル評価開始');
    
    // 評価状況表示
    showEvaluationStatus('モデル評価を開始しています...', 'alert-info');
    
    fetch('/learning/start-evaluation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        learningManagementService.currentTaskId = data.task_id;
        console.log('モデル評価タスク開始:', data.task_id);
        
        showEvaluationStatus('モデル評価中...', 'alert-info');
        startTaskStatusCheck();
        
        showSuccessMessage('モデル評価を開始しました');
    })
    .catch(error => {
        console.error('モデル評価開始エラー:', error);
        showEvaluationStatus('エラー: ' + error.message, 'alert-danger');
        showError('モデル評価の開始に失敗しました: ' + error.message);
    });
}

/**
 * アノテーション効果分析の開始
 */
function startAnnotationAnalysis() {
    console.log('アノテーション効果分析開始');
    
    showEvaluationStatus('アノテーション効果分析中...', 'alert-info');
    
    fetch('/learning/start-annotation-analysis', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        learningManagementService.currentTaskId = data.task_id;
        console.log('アノテーション分析タスク開始:', data.task_id);
        
        startTaskStatusCheck();
        
        showSuccessMessage('アノテーション効果分析を開始しました');
    })
    .catch(error => {
        console.error('アノテーション分析開始エラー:', error);
        showEvaluationStatus('エラー: ' + error.message, 'alert-danger');
        showError('アノテーション効果分析の開始に失敗しました: ' + error.message);
    });
}

/**
 * タスク状態チェックの開始
 */
function startTaskStatusCheck() {
    if (learningManagementService.statusCheckInterval) {
        clearInterval(learningManagementService.statusCheckInterval);
    }
    
    learningManagementService.statusCheckInterval = setInterval(() => {
        checkTaskStatus();
    }, 2000); // 2秒間隔
    
    console.log('タスク状態チェック開始');
}

/**
 * タスク状態のチェック
 */
function checkTaskStatus() {
    if (!learningManagementService.currentTaskId) return;
    
    fetch('/api/task-status/' + learningManagementService.currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('状態取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error' || data.status === 'failed') {
            clearInterval(learningManagementService.statusCheckInterval);
            learningManagementService.statusCheckInterval = null;
            
            if (data.status === 'completed') {
                handleTaskComplete(data);
            }
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
        clearInterval(learningManagementService.statusCheckInterval);
        learningManagementService.statusCheckInterval = null;
    });
}

/**
 * タスク状態の更新
 * @param {Object} data - 状態データ
 */
function updateTaskStatus(data) {
    const progress = data.progress || 0;
    const message = data.message || '処理中...';
    
    let alertClass = 'alert-info';
    if (data.status === 'completed') {
        alertClass = 'alert-success';
    } else if (data.status === 'error' || data.status === 'failed') {
        alertClass = 'alert-danger';
    }
    
    // 訓練状態またはメッセージによって評価状態を更新
    if (message.includes('訓練') || message.includes('モデル')) {
        showTrainingStatus(message, alertClass, progress);
    } else {
        showEvaluationStatus(message, alertClass);
    }
}

/**
 * タスク完了時の処理
 * @param {Object} data - 完了データ
 */
function handleTaskComplete(data) {
    console.log('タスク完了:', data);
    
    if (data.result) {
        // 評価結果の表示
        if (data.result.cv_mean !== undefined) {
            displayEvaluationResults(data.result);
        }
        
        // アノテーション効果の表示
        if (data.result.dataset) {
            displayAnnotationEffect(data.result);
        }
    }
    
    // 履歴更新
    loadLearningHistory();
    
    showSuccessMessage('処理が完了しました');
}

/**
 * 訓練状況の表示
 * @param {string} message - メッセージ
 * @param {string} alertClass - アラートクラス
 * @param {number} progress - 進捗
 */
function showTrainingStatus(message, alertClass, progress) {
    const statusElement = document.getElementById('trainingStatus');
    const progressContainer = document.getElementById('trainingProgressContainer');
    const progressBar = document.getElementById('trainingProgressBar');
    
    if (statusElement) {
        statusElement.className = `alert ${alertClass}`;
        statusElement.textContent = message;
        statusElement.classList.remove('d-none');
    }
    
    if (progressContainer && progressBar && progress > 0) {
        progressContainer.classList.remove('d-none');
        progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
            progressBar.classList.remove('progress-bar-animated');
        }
    }
}

/**
 * 評価状況の表示
 * @param {string} message - メッセージ
 * @param {string} alertClass - アラートクラス
 */
function showEvaluationStatus(message, alertClass) {
    const statusElement = document.getElementById('evaluationStatus');
    
    if (statusElement) {
        statusElement.className = `alert ${alertClass}`;
        statusElement.textContent = message;
        statusElement.classList.remove('d-none');
    }
}

/**
 * 評価結果の表示
 * @param {Object} results - 評価結果
 */
function displayEvaluationResults(results) {
    console.log('評価結果表示:', results);
    
    // プレースホルダーを非表示
    const placeholder = document.getElementById('evaluationPlaceholder');
    if (placeholder) placeholder.classList.add('d-none');
    
    // 結果エリアを表示
    const resultsArea = document.getElementById('evaluationResults');
    if (resultsArea) resultsArea.classList.remove('d-none');
    
    // メトリクス値の更新
    setElementText('modelAccuracyValue', (results.cv_mean * 100).toFixed(1) + '%');
    
    if (results.classification_report) {
        const report = results.classification_report;
        const avgReport = report['weighted avg'] || {};
        
        setElementText('modelPrecisionValue', ((avgReport.precision || 0) * 100).toFixed(1) + '%');
        setElementText('modelRecallValue', ((avgReport.recall || 0) * 100).toFixed(1) + '%');
    }
    
    // グラフの表示（評価画像があれば）
    displayEvaluationGraphs(results);
}

/**
 * 評価グラフの表示
 * @param {Object} results - 評価結果
 */
function displayEvaluationGraphs(results) {
    const graphsContainer = document.getElementById('evaluationGraphs');
    if (!graphsContainer) return;
    
    // タイムスタンプから画像URLを生成
    const timestamp = results.timestamp;
    if (!timestamp) return;
    
    const graphHTML = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <h6>学習曲線</h6>
                <img src="/evaluation/images/learning_curve_${timestamp}.png" class="evaluation-img" 
                     alt="学習曲線" onerror="this.style.display='none'">
            </div>
            <div class="col-md-6 mb-3">
                <h6>混同行列</h6>
                <img src="/evaluation/images/confusion_matrix_${timestamp}.png" class="evaluation-img" 
                     alt="混同行列" onerror="this.style.display='none'">
            </div>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6>ROCカーブ</h6>
                <img src="/evaluation/images/roc_curve_${timestamp}.png" class="evaluation-img" 
                     alt="ROCカーブ" onerror="this.style.display='none'">
            </div>
        </div>
    `;
    
    graphsContainer.innerHTML = graphHTML;
}

/**
 * アノテーション効果の表示
 * @param {Object} results - 分析結果
 */
function displayAnnotationEffect(results) {
    const effectContainer = document.getElementById('annotationEffectResults');
    const contentContainer = document.getElementById('annotationEffectContent');
    
    if (!effectContainer || !contentContainer) return;
    
    effectContainer.classList.remove('d-none');
    
    const dataset = results.dataset || {};
    const annotationRate = (dataset.annotation_rate * 100).toFixed(1);
    
    const effectHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6>アノテーション状況</h6>
                        <p>オス画像: ${dataset.male_annotated}/${dataset.male_total}</p>
                        <p>メス画像: ${dataset.female_annotated}/${dataset.female_total}</p>
                        <p><strong>アノテーション率: ${annotationRate}%</strong></p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6>改善提案</h6>
                        <p class="small">
                            ${annotationRate < 30 ? 
                                'アノテーション率が低いため、より多くの画像にアノテーションを追加することで性能向上が期待できます。' :
                                annotationRate < 70 ?
                                'アノテーション率は中程度です。継続的なアノテーション作業により、さらなる性能向上が可能です。' :
                                'アノテーション率が高く、モデルの学習に十分なデータが提供されています。'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = effectHTML;
}

/**
 * 訓練タブのデータ更新
 */
function updateTrainingTabData() {
    loadDatasetStatistics();
}

/**
 * 学習履歴の読み込み
 */
function loadLearningHistory() {
    fetch('/learning/learning-history')
    .then(response => {
        if (!response.ok) {
            throw new Error('履歴取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        learningManagementService.learningHistory = data.history || [];
        displayLearningHistory();
        console.log('学習履歴更新:', data.count + '件');
    })
    .catch(error => {
        console.error('履歴読み込みエラー:', error);
    });
}

/**
 * 学習履歴の表示
 */
function displayLearningHistory() {
    const historyContainer = document.getElementById('learningHistoryContainer');
    const historyCount = document.getElementById('historyTotalCount');
    
    if (!historyContainer) return;
    
    const history = learningManagementService.learningHistory;
    
    // 件数更新
    if (historyCount) {
        historyCount.textContent = `${history.length}件`;
    }
    
    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <p class="mb-0">まだ履歴がありません</p>
            </div>
        `;
        return;
    }
    
    // 履歴項目の生成
    const historyHTML = history.map(item => {
        const typeIcon = item.type === 'evaluation' ? 'fas fa-chart-line text-info' :
                        item.type === 'annotation' ? 'fas fa-tag text-warning' :
                        'fas fa-brain text-success';
        const typeName = item.type === 'evaluation' ? 'モデル評価' :
                        item.type === 'annotation' ? 'アノテーション分析' :
                        'モデル訓練';
        const accuracy = (item.accuracy * 100).toFixed(1);
        
        return `
            <div class="border-bottom py-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="${typeIcon} me-2"></i>
                        <strong>${typeName}</strong>
                        <span class="badge bg-primary ms-2">${accuracy}%</span>
                    </div>
                    <small class="text-muted">${item.date}</small>
                </div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = historyHTML;
}

/**
 * 要素にテキストを設定
 * @param {string} elementId - 要素ID
 * @param {string} text - 設定するテキスト
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * エラーメッセージの表示
 * @param {string} message - エラーメッセージ
 */
function showError(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger alert-dismissible fade show';
    alertElement.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        setTimeout(() => alertElement.remove(), 5000);
    }
}

/**
 * 成功メッセージの表示
 * @param {string} message - 成功メッセージ
 */
function showSuccessMessage(message) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-success alert-dismissible fade show';
    alertElement.innerHTML = `
        <i class="fas fa-check-circle me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        setTimeout(() => alertElement.remove(), 3000);
    }
}