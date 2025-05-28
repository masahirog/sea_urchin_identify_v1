/**
 * ウニ生殖乳頭分析システム - メインアプリケーション
 * 雌雄判定機能とアプリケーション初期化を統合
 */

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    showWarningMessage,
    apiRequest,
    apiRequestFormData,
    setElementText,
    showElement,
    hideElement,
    getGenderIcon
} from './utilities.js';

// ===========================================
// アプリケーション状態管理
// ===========================================

// 雌雄判定サービスの状態管理
const classificationService = {
    currentResult: null,
    judgmentHistory: [],
    statistics: {
        totalJudgments: 0,
        correctFeedbacks: 0,
        incorrectFeedbacks: 0
    }
};

// ===========================================
// アプリケーション初期化
// ===========================================

/**
 * DOMが読み込まれたら実行
 */
document.addEventListener('DOMContentLoaded', function() {
    // 雌雄判定機能の初期化（雌雄判定ページの場合のみ）
    if (isClassificationPage()) {
        initClassificationService();
    }
});

/**
 * 雌雄判定ページかどうかを判定
 */
function isClassificationPage() {
    return document.getElementById('classificationForm') !== null;
}

// ===========================================
// 雌雄判定サービス
// ===========================================

/**
 * 雌雄判定サービスの初期化
 */
function initClassificationService() {
    // フォーム送信イベントの設定
    initClassificationForm();
    
    // フィードバックボタンの設定
    initFeedbackButtons();
    
    // 統計情報の読み込み
    loadStatistics();
    
    // 判定履歴の読み込み
    loadJudgmentHistory();
    
    // 画像クリックイベント
    initImageZoom();
}

/**
 * 判定フォームの初期化
 */
function initClassificationForm() {
    const classificationForm = document.getElementById('classificationForm');
    if (classificationForm) {
        classificationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            executeClassification();
        });
    }
}

/**
 * フィードバックボタンの初期化
 */
function initFeedbackButtons() {
    const feedbackButtons = {
        'feedbackCorrect': () => submitFeedback('correct'),
        'feedbackWrongMale': () => submitFeedback('wrong', 'male'),
        'feedbackWrongFemale': () => submitFeedback('wrong', 'female')
    };

    Object.entries(feedbackButtons).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    });
}

/**
 * 画像クリックで拡大表示の初期化
 */
function initImageZoom() {
    document.addEventListener('click', function(e) {
        if (e.target.id === 'resultImage' && e.target.src) {
            const modal = new bootstrap.Modal(document.getElementById('imageZoomModal'));
            document.getElementById('zoomedImage').src = e.target.src;
            modal.show();
        }
    });
}

/**
 * 雌雄判定の実行
 */
async function executeClassification() {
    const imageFile = document.getElementById('imageFile').files[0];
    
    if (!imageFile) {
        showWarningMessage('画像ファイルを選択してください');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', imageFile);
    
    showLoading();
    
    try {
        const data = await apiRequestFormData('/classify', formData);
        
        hideLoading();
        
        // モデル未学習の場合の処理
        if (data.status === 'model_not_trained') {
            showModelTrainingGuide(data);
            return;
        }
        
        // エラーチェック
        if (data.error && data.status !== 'model_not_trained') {
            if (data.solution) {
                showErrorMessage(
                    `判定エラー: ${data.error}<br>` +
                    `<small>解決方法: ${data.solution}</small>`,
                    10000
                );
            } else {
                showErrorMessage('判定中にエラーが発生しました: ' + data.error);
            }
            return;
        }
        
        // 判定結果の表示
        displayClassificationResult(data);
        
        // 履歴に追加
        addToHistory(data);
        
        // 統計更新
        updateStatistics();
        
    } catch (error) {
        hideLoading();
        showErrorMessage('判定中にエラーが発生しました: ' + error.message);
    }
}

/**
 * モデル学習ガイドを表示
 */
function showModelTrainingGuide(data) {
    hideElement('classificationPlaceholder');
    showElement('classificationResult');
    
    const resultArea = document.getElementById('classificationResult');
    
    let detectionInfo = '';
    if (data.papillae_count !== undefined) {
        detectionInfo = `
            <div class="alert alert-info mt-3">
                <h6><i class="fas fa-eye me-2"></i>YOLO検出結果</h6>
                <p>生殖乳頭を${data.papillae_count}個検出しました。</p>
                <small>※雌雄判定にはRandomForestモデルの学習が必要です。</small>
            </div>
        `;
    }
    
    resultArea.innerHTML = `
        <div class="alert alert-warning">
            <h4 class="alert-heading">
                <i class="fas fa-exclamation-triangle me-2"></i>モデルの学習が必要です
            </h4>
            <p>${data.message}</p>
            <hr>
            <p class="mb-0">
                <a href="/annotation/images" class="btn btn-primary me-2">
                    <i class="fas fa-upload me-1"></i>学習データをアップロード
                </a>
                <a href="/training" class="btn btn-success">
                    <i class="fas fa-brain me-1"></i>機械学習を実行
                </a>
            </p>
        </div>
        
        ${detectionInfo}
        
        <div class="mt-4">
            <h5>クイックスタートガイド</h5>
            <ol>
                <li><strong>学習データをアップロード</strong> - 「学習データ」ページでオス・メスの画像を各5枚以上アップロード</li>
                <li><strong>機械学習を実行</strong> - 「機械学習」ページで学習を実行（通常1-2分）</li>
                <li><strong>雌雄判定を開始</strong> - 学習完了後、このページで雌雄判定が可能になります</li>
            </ol>
        </div>
    `;
}

/**
 * 判定結果の表示
 */
function displayClassificationResult(data) {
    classificationService.currentResult = {
        ...data,
        timestamp: new Date().toISOString(),
        feedbackGiven: false
    };
    
    hideElement('classificationPlaceholder');
    showElement('classificationResult');
    
    // 画像表示
    const resultImage = document.getElementById('resultImage');
    if (resultImage && data.marked_image_url) {
        resultImage.src = data.marked_image_url;
        resultImage.alt = '判定対象画像';
    }
    
    // 判定結果表示
    const genderResult = document.getElementById('genderResult');
    if (genderResult) {
        const gender = data.gender === 'male' ? 'オス' : 'メス';
        const confidence = (data.confidence * 100).toFixed(1);
        const icon = data.gender === 'male' ? 'fas fa-mars' : 'fas fa-venus';
        
        genderResult.className = 'alert ' + (data.gender === 'male' ? 'alert-primary' : 'alert-danger');
        genderResult.innerHTML = `<i class="${icon} me-2"></i>判定結果: ${gender} (信頼度: ${confidence}%)`;
    }
    
    // 検出情報の表示
    if (data.papillae_count !== undefined) {
        const detectionInfo = document.createElement('div');
        detectionInfo.className = 'alert alert-info mt-3';
        detectionInfo.innerHTML = `<i class="fas fa-eye me-2"></i>生殖乳頭を${data.papillae_count}個検出しました`;
        genderResult.parentElement.appendChild(detectionInfo);
    }
    
    // 特徴重要度表示
    displayFeatureImportance(data.feature_importance);
    
    // フィードバックボタンを有効化
    enableFeedbackButtons();
}

/**
 * 特徴重要度の表示
 */
function displayFeatureImportance(featureImportance) {
    const container = document.getElementById('featureImportance');
    if (!container || !featureImportance) return;
    
    container.innerHTML = '';
    
    const sortedFeatures = Object.entries(featureImportance)
        .sort((a, b) => b[1] - a[1]);
    
    sortedFeatures.forEach(([feature, importance]) => {
        const percent = (importance * 100).toFixed(1);
        const bar = document.createElement('div');
        bar.className = 'mb-3';
        
        bar.innerHTML = `
            <div class="d-flex justify-content-between mb-1">
                <span class="small">${feature}</span>
                <span class="small">${percent}%</span>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
            </div>
        `;
        
        container.appendChild(bar);
    });
}

/**
 * フィードバックボタンの有効化
 */
function enableFeedbackButtons() {
    ['feedbackCorrect', 'feedbackWrongMale', 'feedbackWrongFemale'].forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = false;
            button.classList.remove('disabled');
        }
    });
}

/**
 * フィードバックボタンの無効化
 */
function disableFeedbackButtons() {
    ['feedbackCorrect', 'feedbackWrongMale', 'feedbackWrongFemale'].forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = true;
            button.classList.add('disabled');
        }
    });
    
    const feedbackArea = document.querySelector('.card.bg-light .card-body');
    if (feedbackArea) {
        feedbackArea.innerHTML = `
            <div class="text-center text-success">
                <i class="fas fa-check-circle fa-2x mb-2"></i>
                <h6>フィードバック送信済み</h6>
                <p class="small mb-0">ご協力ありがとうございました</p>
            </div>
        `;
    }
}

/**
 * フィードバックの送信
 */
async function submitFeedback(type, correctGender = null) {
    if (!classificationService.currentResult) {
        return;
    }
    
    if (classificationService.currentResult.feedbackGiven) {
        showWarningMessage('このデータには既にフィードバックが送信されています');
        return;
    }
    
    try {
        classificationService.currentResult.feedbackGiven = true;
        
        if (type === 'correct') {
            classificationService.statistics.correctFeedbacks++;
            showSuccessMessage('フィードバックありがとうございます！正解として記録しました。');
        } else {
            classificationService.statistics.incorrectFeedbacks++;
            showSuccessMessage(`フィードバックありがとうございます！正解は「${correctGender === 'male' ? 'オス' : 'メス'}」として記録しました。`);
        }
        
        disableFeedbackButtons();
        updateStatisticsDisplay();
        
        const feedbackData = {
            result_id: classificationService.currentResult.timestamp,
            feedback_type: type,
            predicted_gender: classificationService.currentResult.gender,
            correct_gender: type === 'correct' ? classificationService.currentResult.gender : correctGender,
            timestamp: new Date().toISOString()
        };
        
        updateHistoryWithFeedback(feedbackData);
        
    } catch (error) {
        showErrorMessage('フィードバック送信中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 判定履歴への追加
 */
function addToHistory(result) {
    const historyItem = {
        id: result.timestamp || Date.now().toString(),
        timestamp: new Date().toISOString(),
        predicted_gender: result.gender,
        confidence: result.confidence,
        papillae_count: result.papillae_count,
        feedback: null
    };
    
    classificationService.judgmentHistory.unshift(historyItem);
    
    if (classificationService.judgmentHistory.length > 20) {
        classificationService.judgmentHistory = classificationService.judgmentHistory.slice(0, 20);
    }
    
    updateHistoryDisplay();
}

/**
 * 統計情報の読み込み
 */
function loadStatistics() {
    const savedStats = localStorage.getItem('classificationStatistics');
    if (savedStats) {
        try {
            classificationService.statistics = JSON.parse(savedStats);
        } catch (e) {
            console.error('統計データ読み込みエラー:', e);
        }
    }
    updateStatisticsDisplay();
}

/**
 * 統計表示の更新
 */
function updateStatisticsDisplay() {
    setElementText('totalJudgments', classificationService.statistics.totalJudgments);
    
    const total = classificationService.statistics.correctFeedbacks + classificationService.statistics.incorrectFeedbacks;
    if (total > 0) {
        const accuracy = (classificationService.statistics.correctFeedbacks / total * 100).toFixed(1);
        setElementText('accuracyRate', accuracy + '%');
    } else {
        setElementText('accuracyRate', '-');
    }
}

/**
 * 統計の更新
 */
function updateStatistics() {
    classificationService.statistics.totalJudgments++;
    localStorage.setItem('classificationStatistics', JSON.stringify(classificationService.statistics));
    updateStatisticsDisplay();
}

/**
 * 判定履歴の読み込み
 */
function loadJudgmentHistory() {
    const savedHistory = localStorage.getItem('judgmentHistory');
    if (savedHistory) {
        try {
            classificationService.judgmentHistory = JSON.parse(savedHistory);
        } catch (e) {
            console.error('履歴データ読み込みエラー:', e);
        }
    }
    updateHistoryDisplay();
}

/**
 * 履歴表示の更新
 */
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('judgmentHistory');
    const historyCount = document.getElementById('historyCount');
    
    if (!historyContainer) return;
    
    if (historyCount) {
        historyCount.textContent = `${classificationService.judgmentHistory.length}件`;
    }
    
    if (classificationService.judgmentHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <p class="mb-0">まだ判定履歴がありません</p>
            </div>
        `;
        return;
    }
    
    const historyHTML = classificationService.judgmentHistory.map((item, index) => {
        const date = new Date(item.timestamp).toLocaleString();
        const gender = item.predicted_gender === 'male' ? 'オス' : 'メス';
        const confidence = (item.confidence * 100).toFixed(1);
        const icon = item.predicted_gender === 'male' ? 'fas fa-mars text-primary' : 'fas fa-venus text-danger';
        
        let feedbackBadge = '';
        if (item.feedback) {
            feedbackBadge = item.feedback.feedback_type === 'correct' 
                ? '<span class="badge bg-success ms-2">正解</span>'
                : '<span class="badge bg-warning ms-2">修正済み</span>';
        }
        
        return `
            <div class="history-item border-bottom py-2" onclick="window.showHistoryDetail(${index})">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="${icon} me-2"></i>
                        <strong>${gender}</strong> (信頼度: ${confidence}%)
                        ${feedbackBadge}
                    </div>
                    <small class="text-muted">${date}</small>
                </div>
                <div id="historyDetail${index}" class="d-none">
                    <p class="mb-1"><strong>検出数:</strong> ${item.papillae_count || 0}個</p>
                    ${item.feedback ? `
                        <p class="mb-1"><strong>フィードバック:</strong> 
                            ${item.feedback.feedback_type === 'correct' ? '正解' : 
                              `修正（実際は${item.feedback.correct_gender === 'male' ? 'オス' : 'メス'}）`}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = historyHTML;
    localStorage.setItem('judgmentHistory', JSON.stringify(classificationService.judgmentHistory));
}

/**
 * フィードバックによる履歴更新
 */
function updateHistoryWithFeedback(feedbackData) {
    const targetItem = classificationService.judgmentHistory.find(item => 
        item.id === feedbackData.result_id
    );
    
    if (targetItem) {
        targetItem.feedback = feedbackData;
        updateHistoryDisplay();
    }
}

// グローバル関数として公開
window.showHistoryDetail = function(index) {
    const detailElement = document.getElementById(`historyDetail${index}`);
    if (detailElement) {
        detailElement.classList.toggle('d-none');
    }
};