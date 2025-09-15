/**
 * ウニ生殖乳頭分析システム - メインアプリケーション
 * YOLO検出ベースの雌雄判定
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

document.addEventListener('DOMContentLoaded', function() {
    if (isClassificationPage()) {
        initClassificationService();
    }
});

function isClassificationPage() {
    return document.getElementById('classificationForm') !== null;
}

// ===========================================
// 雌雄判定サービス
// ===========================================

function initClassificationService() {
    initClassificationForm();
    initFeedbackButtons();
    loadStatistics();
    loadJudgmentHistory();
    initImageZoom();
}

function initClassificationForm() {
    const classificationForm = document.getElementById('classificationForm');
    if (classificationForm) {
        classificationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            executeClassification();
        });
    }
}

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
 * 雌雄判定の実行（YOLOベース）
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
        
        // モデル未学習の場合
        if (data.status === 'model_not_trained') {
            showModelTrainingGuide(data);
            return;
        }
        
        // エラーチェック
        if (data.error) {
            showErrorMessage('判定中にエラーが発生しました: ' + data.error);
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
    
    resultArea.innerHTML = `
        <div class="alert alert-warning">
            <h4 class="alert-heading">
                <i class="fas fa-exclamation-triangle me-2"></i>YOLOモデルの学習が必要です
            </h4>
            <p>${data.message}</p>
            <hr>
            <p class="mb-0">
                <a href="/annotation/images" class="btn btn-primary me-2">
                    <i class="fas fa-upload me-1"></i>学習データをアップロード
                </a>
                <a href="/annotation/editor" class="btn btn-warning me-2">
                    <i class="fas fa-edit me-1"></i>アノテーション
                </a>
                <a href="/training" class="btn btn-success">
                    <i class="fas fa-brain me-1"></i>YOLO学習を実行
                </a>
            </p>
        </div>
        
        <div class="mt-4">
            <h5>クイックスタートガイド</h5>
            <ol>
                <li><strong>学習データをアップロード</strong> - 各画像を各10枚以上アップロード</li>
                <li><strong>アノテーション</strong> - 各画像で生殖乳頭の位置をマーク</li>
                <li><strong>YOLO学習を実行</strong> - 学習完了後、雌雄判定が可能になります</li>
            </ol>
        </div>
    `;
}

/**
 * 判定結果の表示（YOLOベース）
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
        resultImage.alt = '検出結果画像';
    }
    
    // 判定結果表示
    const genderResult = document.getElementById('genderResult');
    if (genderResult) {
        const gender = data.gender === 'male' ? 'オス' : 
                      data.gender === 'female' ? 'メス' : '判定不可';
        const confidence = (data.confidence * 100).toFixed(1);
        const icon = data.gender === 'male' ? 'fas fa-mars' : 
                    data.gender === 'female' ? 'fas fa-venus' : 'fas fa-question';
        
        let alertClass = 'alert-secondary';
        if (data.gender === 'male') alertClass = 'alert-primary';
        else if (data.gender === 'female') alertClass = 'alert-danger';
        
        genderResult.className = 'alert ' + alertClass;
        genderResult.innerHTML = `<i class="${icon} me-2"></i>判定結果: ${gender}`;
        
        if (data.confidence > 0) {
            genderResult.innerHTML += ` (信頼度: ${confidence}%)`;
        }
    }
    
    // 検出詳細の表示
    displayDetectionDetails(data);
    
    // フィードバックボタンを有効化
    if (data.gender !== 'unknown') {
        enableFeedbackButtons();
    }
}

/**
 * 検出詳細の表示
 */
function displayDetectionDetails(data) {
    const container = document.getElementById('detectionDetails');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (data.count_by_class) {
        const detailsHTML = `
            <div class="row text-center">
                <div class="col-4">
                    <div class="text-primary">
                        <strong>${data.count_by_class.male || 0}</strong>
                        <div class="small">雄の生殖乳頭</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-danger">
                        <strong>${data.count_by_class.female || 0}</strong>
                        <div class="small">雌の生殖乳頭</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-success">
                        <strong>${data.count_by_class.madreporite || 0}</strong>
                        <div class="small">多孔板</div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = detailsHTML;
        
        // メッセージがある場合は追加
        if (data.message) {
            container.innerHTML += `
                <div class="alert alert-info mt-3 mb-0">
                    <small>${data.message}</small>
                </div>
            `;
        }
    }
}

// 残りの関数（フィードバック、履歴管理等）はそのまま維持

function enableFeedbackButtons() {
    ['feedbackCorrect', 'feedbackWrongMale', 'feedbackWrongFemale'].forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = false;
            button.classList.remove('disabled');
        }
    });
}

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

// 以下、既存の関数をそのまま維持
async function submitFeedback(type, correctGender = null) {
    // 既存のコードをそのまま使用
}

function addToHistory(result) {
    // 既存のコードをそのまま使用
}

function loadStatistics() {
    // 既存のコードをそのまま使用
}

function updateStatisticsDisplay() {
    // 既存のコードをそのまま使用
}

function updateStatistics() {
    // 既存のコードをそのまま使用
}

function loadJudgmentHistory() {
    // 既存のコードをそのまま使用
}

function updateHistoryDisplay() {
    // 既存のコードをそのまま使用
}

function updateHistoryWithFeedback(feedbackData) {
    // 既存のコードをそのまま使用
}

window.showHistoryDetail = function(index) {
    const detailElement = document.getElementById(`historyDetail${index}`);
    if (detailElement) {
        detailElement.classList.toggle('d-none');
    }
};