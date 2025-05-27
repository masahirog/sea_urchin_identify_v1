/**
 * ウニ生殖乳頭分析システム - メインアプリケーション
 * classification-service.js + app.js の統合版
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
    getGenderClass,
    getGenderIcon
} from './utilities.js';

// ===========================================
// グローバル変数とアプリケーション状態管理
// ===========================================

// アプリケーション全体の状態
let currentTaskId = null;

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
// アプリケーション初期化（DOMContentLoaded）
// ===========================================

/**
 * DOMが読み込まれたら実行
 */
document.addEventListener('DOMContentLoaded', function() {
    // アプリケーション全体の初期化
    initMainApplication();
    
    // 雌雄判定機能の初期化（雌雄判定ページの場合のみ）
    if (isClassificationPage()) {
        initClassificationService();
    }
});

/**
 * メインアプリケーションの初期化
 */
function initMainApplication() {
    // 既存のタスクIDを復元
    restoreTaskState();
    
    // 各機能の初期化
    initTaskManager();
    
    // 初期表示データの読み込み
    loadDatasetInfo();
}

/**
 * 雌雄判定ページかどうかを判定
 */
function isClassificationPage() {
    return document.getElementById('classificationForm') !== null;
}

/**
 * 保存されていたタスク状態を復元する
 */
function restoreTaskState() {
    const savedTaskId = getTaskId();
    if (savedTaskId) {
        currentTaskId = savedTaskId;
    }
}

/**
 * タスク管理の初期化
 */
function initTaskManager() {
    // 必要に応じて実装
}

/**
 * タスクIDをローカルストレージに保存
 */
function saveTaskId(taskId) {
    localStorage.setItem('currentTaskId', taskId);
}

/**
 * タスクIDをローカルストレージから取得
 */
function getTaskId() {
    return localStorage.getItem('currentTaskId');
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
 * 雌雄判定の実行
 */
async function executeClassification() {
    const imageFile = document.getElementById('imageFile').files[0];
    
    if (!imageFile) {
        showWarningMessage('画像ファイルを選択してください');
        return;
    }
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // ローディング表示
    showLoading();
    
    try {
        const data = await apiRequestFormData('/classify', formData);
        
        hideLoading();
        
        if (data.error) {
            // YOLOv5エラーの場合は詳細な対処法を表示
            if (data.solution) {
                showErrorMessage(
                    `判定エラー: ${data.error}<br>` +
                    `<small>解決方法: ${data.solution}</small>`,
                    10000  // 10秒間表示
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
 * 判定結果の表示
 * @param {Object} data - 判定結果データ
 */
function displayClassificationResult(data) {
    // 現在の結果を保存
    classificationService.currentResult = {
        ...data,
        timestamp: new Date().toISOString(),
        feedbackGiven: false
    };
    
    // プレースホルダーを非表示
    hideElement('classificationPlaceholder');
    
    // 結果エリアを表示
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
        
        genderResult.textContent = `判定結果: ${gender} (信頼度: ${confidence}%)`;
        genderResult.className = 'alert';
        genderResult.classList.add(data.gender === 'male' ? 'alert-primary' : 'alert-danger');
        
        // アイコン追加
        const icon = data.gender === 'male' ? 'fas fa-mars' : 'fas fa-venus';
        genderResult.innerHTML = `<i class="${icon} me-2"></i>${genderResult.textContent}`;
    }
    
    // 特徴重要度表示
    displayFeatureImportance(data.feature_importance);
}

/**
 * 特徴重要度の表示
 * @param {Object} featureImportance - 特徴重要度データ
 */
function displayFeatureImportance(featureImportance) {
    const container = document.getElementById('featureImportance');
    if (!container || !featureImportance) return;
    
    container.innerHTML = '';
    
    // 特徴量を重要度順にソート
    const sortedFeatures = Object.entries(featureImportance)
        .sort((a, b) => b[1] - a[1]);
    
    // 特徴バーの作成
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
 * フィードバックの送信
 * @param {string} type - フィードバックタイプ ('correct' or 'wrong')
 * @param {string} correctGender - 正しい性別 (wrongの場合のみ)
 */
async function submitFeedback(type, correctGender = null) {
    if (!classificationService.currentResult) {
        return;
    }
    
    if (classificationService.currentResult.feedbackGiven) {
        showWarningMessage('このデータには既にフィードバックが送信されています');
        return;
    }
    
    const feedbackData = {
        result_id: classificationService.currentResult.timestamp,
        feedback_type: type,
        predicted_gender: classificationService.currentResult.gender,
        correct_gender: type === 'correct' ? classificationService.currentResult.gender : correctGender,
        confidence: classificationService.currentResult.confidence,
        timestamp: new Date().toISOString()
    };
    
    try {
        // TODO: 実際のフィードバック送信API実装
        // const response = await apiRequest('/api/feedback', {
        //     method: 'POST',
        //     body: JSON.stringify(feedbackData)
        // });
        
        // 暫定処理: ローカル統計更新
        classificationService.currentResult.feedbackGiven = true;
        
        if (type === 'correct') {
            classificationService.statistics.correctFeedbacks++;
            showSuccessMessage('フィードバックありがとうございます！正解として記録しました。');
        } else {
            classificationService.statistics.incorrectFeedbacks++;
            showSuccessMessage(`フィードバックありがとうございます！正解は「${correctGender === 'male' ? 'オス' : 'メス'}」として記録しました。`);
        }
        
        // フィードバックボタンを無効化
        disableFeedbackButtons();
        
        // 統計更新
        updateStatisticsDisplay();
        
        // 履歴更新
        updateHistoryWithFeedback(feedbackData);
        
    } catch (error) {
        showErrorMessage('フィードバック送信中にエラーが発生しました: ' + error.message);
    }
}

/**
 * フィードバックボタンの無効化
 */
function disableFeedbackButtons() {
    const buttons = ['feedbackCorrect', 'feedbackWrongMale', 'feedbackWrongFemale'];
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.classList.add('disabled');
        }
    });
    
    // フィードバック済みメッセージを表示
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
 * 判定履歴への追加
 * @param {Object} result - 判定結果
 */
function addToHistory(result) {
    const historyItem = {
        id: result.timestamp || Date.now().toString(),
        timestamp: new Date().toISOString(),
        predicted_gender: result.gender,
        confidence: result.confidence,
        image_url: result.marked_image_url,
        feedback: null
    };
    
    classificationService.judgmentHistory.unshift(historyItem);
    
    // 履歴は最新20件まで保持
    if (classificationService.judgmentHistory.length > 20) {
        classificationService.judgmentHistory = classificationService.judgmentHistory.slice(0, 20);
    }
    
    updateHistoryDisplay();
}

/**
 * 統計情報の読み込み
 */
function loadStatistics() {
    // TODO: サーバーから統計データを読み込み
    // 暫定処理: ローカルストレージから読み込み
    const savedStats = localStorage.getItem('classificationStatistics');
    if (savedStats) {
        try {
            classificationService.statistics = JSON.parse(savedStats);
        } catch (e) {
            // 統計データ読み込みエラー
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
    
    // ローカルストレージに保存
    localStorage.setItem('classificationStatistics', JSON.stringify(classificationService.statistics));
    
    updateStatisticsDisplay();
}

/**
 * 判定履歴の読み込み
 */
function loadJudgmentHistory() {
    // TODO: サーバーから履歴データを読み込み
    // 暫定処理: ローカルストレージから読み込み
    const savedHistory = localStorage.getItem('judgmentHistory');
    if (savedHistory) {
        try {
            classificationService.judgmentHistory = JSON.parse(savedHistory);
        } catch (e) {
            // 履歴データ読み込みエラー
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
    
    // 件数更新
    if (historyCount) {
        historyCount.textContent = `${classificationService.judgmentHistory.length}件`;
    }
    
    // 履歴表示
    if (classificationService.judgmentHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <p class="mb-0">まだ判定履歴がありません</p>
            </div>
        `;
        return;
    }
    
    // 履歴項目の生成
    const historyHTML = classificationService.judgmentHistory.map(item => {
        const date = new Date(item.timestamp).toLocaleString();
        const gender = item.predicted_gender === 'male' ? 'オス' : 'メス';
        const confidence = (item.confidence * 100).toFixed(1);
        const icon = item.predicted_gender === 'male' ? 'fas fa-mars text-primary' : 'fas fa-venus text-danger';
        
        let feedbackBadge = '';
        if (item.feedback) {
            if (item.feedback.feedback_type === 'correct') {
                feedbackBadge = '<span class="badge bg-success ms-2">正解</span>';
            } else {
                feedbackBadge = '<span class="badge bg-warning ms-2">修正済み</span>';
            }
        }
        
        return `
            <div class="border-bottom py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="${icon} me-2"></i>
                        <strong>${gender}</strong> (信頼度: ${confidence}%)
                        ${feedbackBadge}
                    </div>
                    <small class="text-muted">${date}</small>
                </div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = historyHTML;
    
    // ローカルストレージに保存
    localStorage.setItem('judgmentHistory', JSON.stringify(classificationService.judgmentHistory));
}

/**
 * フィードバックによる履歴更新
 * @param {Object} feedbackData - フィードバックデータ
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

/**
 * データセット情報の読み込み
 */
async function loadDatasetInfo() {
    // 必要に応じて実装
}