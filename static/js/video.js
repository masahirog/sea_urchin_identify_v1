/**
 * ウニ生殖乳頭分析システム - 動画処理サービス
 * 動画からの生殖乳頭画像抽出に特化したモジュール
 */

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    showWarningMessage,
    showInfoMessage,
    apiRequest,
    apiRequestFormData,
    debounce
} from './utilities.js';

// 動画処理サービスの状態管理
const videoProcessingService = {
    currentTaskId: null,
    statusCheckInterval: null,
    extractedImages: [],
    selectedImages: [],
    processingHistory: [],
    yoloDetectionEnabled: false,
    lastYoloConfidence: 0.25
};

/**
 * ページ初期化処理
 */
document.addEventListener('DOMContentLoaded', function() {
    initVideoProcessingService();
});

/**
 * 動画処理サービスの初期化
 */
function initVideoProcessingService() {
    initVideoProcessingForm();
    initActionButtons();
    initModals();
    loadProcessingHistory();
    restoreCurrentTask();
    checkYoloModelAvailability();
}

/**
 * YOLOモデルの利用可能性をチェック
 */
async function checkYoloModelAvailability() {
    try {
        const data = await apiRequest('/yolo/model-status');
        videoProcessingService.yoloDetectionEnabled = data.exists;
        updateYoloUiElements(data.exists);
    } catch (error) {
        console.error('YOLOモデル状態チェックエラー:', error);
        videoProcessingService.yoloDetectionEnabled = false;
        updateYoloUiElements(false);
    }
}

/**
 * YOLOモデル状態に応じてUI要素を更新
 * @param {boolean} available - YOLOモデルが利用可能かどうか
 */
function updateYoloUiElements(available) {
    const yoloOptions = document.getElementById('yolo-options');
    if (yoloOptions) {
        yoloOptions.style.display = available ? 'block' : 'none';
    }
    
    const yoloDetectBtn = document.getElementById('yolo-detect-btn');
    if (yoloDetectBtn) {
        yoloDetectBtn.disabled = !available;
        yoloDetectBtn.title = available ? 
            'YOLOモデルで生殖乳頭を検出' : 
            'YOLOモデルが利用できません。学習ページでモデルを作成してください。';
    }
    
    const yoloStatus = document.getElementById('yolo-model-status');
    if (yoloStatus) {
        if (available) {
            yoloStatus.className = 'alert alert-success';
            yoloStatus.innerHTML = '<i class="fas fa-check-circle me-2"></i>YOLOモデルが利用可能です';
        } else {
            yoloStatus.className = 'alert alert-warning';
            yoloStatus.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>YOLOモデルが見つかりません。学習ページでモデルを作成してください。';
        }
    }
}

/**
 * 動画処理フォームの初期化
 */
function initVideoProcessingForm() {
    const videoProcessingForm = document.getElementById('videoProcessingForm');
    if (videoProcessingForm) {
        videoProcessingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            executeVideoProcessing();
        });
    }
    
    const useYoloCheckbox = document.getElementById('use-yolo-detection');
    if (useYoloCheckbox) {
        useYoloCheckbox.addEventListener('change', function() {
            const confidenceContainer = document.getElementById('yolo-confidence-container');
            if (confidenceContainer) {
                confidenceContainer.style.display = this.checked ? 'block' : 'none';
            }
        });
        
        const confidenceSlider = document.getElementById('yolo-confidence');
        const confidenceValue = document.getElementById('confidence-value');
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.addEventListener('input', function() {
                confidenceValue.textContent = this.value;
                videoProcessingService.lastYoloConfidence = parseFloat(this.value);
            });
            
            confidenceSlider.value = videoProcessingService.lastYoloConfidence;
            confidenceValue.textContent = confidenceSlider.value;
        }
    }
}

/**
 * アクションボタンの初期化
 */
function initActionButtons() {
    const buttonActions = {
        'downloadZipBtn': downloadAllImagesAsZip,
        'viewResultsBtn': displayExtractionResults,
        'downloadAllBtn': downloadAllImagesAsZip,
        'selectImagesBtn': openImageSelectionModal,
        'refreshResultsBtn': loadExtractedImages,
        'yolo-detect-btn': () => {
            if (videoProcessingService.extractedImages.length === 0) {
                showWarningMessage('検出する画像がありません。まず動画から画像を抽出してください。');
                return;
            }
            openYoloDetectionModal();
        },
        'send-to-learning-btn': () => {
            if (videoProcessingService.extractedImages.length === 0) {
                showWarningMessage('送信する画像がありません。まず動画から画像を抽出してください。');
                return;
            }
            openSendToLearningModal();
        }
    };

    Object.entries(buttonActions).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) button.addEventListener('click', action);
    });
}

/**
 * モーダル関連の初期化
 */
function initModals() {
    const modalButtons = {
        'selectAllBtn': selectAllImages,
        'deselectAllBtn': deselectAllImages,
        'downloadSelectedBtn': downloadSelectedImages,
        'downloadSingleBtn': downloadSingleImage,
        'run-yolo-detection': executeYoloDetection,
        'send-to-learning-confirm': executeSendToLearning
    };

    Object.entries(modalButtons).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) button.addEventListener('click', action);
    });
}

/**
 * 動画処理の実行
 */
async function executeVideoProcessing() {
    const videoFile = document.getElementById('videoFile').files[0];
    const maxImages = document.getElementById('maxImages').value;
    
    if (!videoFile) {
        showWarningMessage('動画ファイルを選択してください');
        return;
    }
    
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('max_images', maxImages);
    
    const useYolo = document.getElementById('use-yolo-detection')?.checked || false;
    const confidence = document.getElementById('yolo-confidence')?.value || 0.25;
    
    if (useYolo) {
        if (!videoProcessingService.yoloDetectionEnabled) {
            showWarningMessage('YOLOモデルが利用できません。学習ページでモデルを作成してください。');
            return;
        }
        
        formData.append('use_yolo', 'true');
        formData.append('confidence', confidence);
        videoProcessingService.lastYoloConfidence = parseFloat(confidence);
    }
    
    showLoading();
    showProcessingStatus('処理を開始しています...', 'alert-info', 5);
    
    try {
        const data = await apiRequestFormData('/video/upload', formData);
        
        hideLoading();
        
        if (data.error) {
            showProcessingStatus('エラー: ' + data.error, 'alert-danger', 0);
            return;
        }
        
        videoProcessingService.currentTaskId = data.task_id;
        saveCurrentTask(data.task_id);
        
        showProcessingStatus('動画を解析中...', 'alert-info', 10);
        startStatusCheck();
        showSuccessMessage('動画の処理を開始しました');
        
    } catch (error) {
        hideLoading();
        showProcessingStatus('処理中にエラーが発生しました: ' + error.message, 'alert-danger', 0);
        showErrorMessage('動画処理中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 処理状態のチェック開始
 */
function startStatusCheck() {
    if (videoProcessingService.statusCheckInterval) {
        clearInterval(videoProcessingService.statusCheckInterval);
    }
    
    videoProcessingService.statusCheckInterval = setInterval(() => {
        checkProcessingStatus();
    }, 2000);
}

/**
 * 処理状態のチェック
 */
async function checkProcessingStatus() {
    if (!videoProcessingService.currentTaskId) return;
    
    try {
        const data = await apiRequest('/video/status/' + videoProcessingService.currentTaskId);
        
        updateProcessingStatus(data);
        
        if (data.status === 'completed' || data.status === 'error' || data.status === 'failed') {
            clearInterval(videoProcessingService.statusCheckInterval);
            videoProcessingService.statusCheckInterval = null;
            
            if (data.status === 'completed') {
                handleProcessingComplete(data);
            }
        }
    } catch (error) {
        clearInterval(videoProcessingService.statusCheckInterval);
        videoProcessingService.statusCheckInterval = null;
    }
}

/**
 * 処理状態の更新
 * @param {Object} data - 状態データ
 */
function updateProcessingStatus(data) {
    let alertClass = 'alert-info';
    if (data.status === 'completed') {
        alertClass = 'alert-success';
    } else if (data.status === 'error' || data.status === 'failed') {
        alertClass = 'alert-danger';
    }
    
    const progress = data.progress || 0;
    const message = data.message || '処理中...';
    
    showProcessingStatus(message, alertClass, progress);
}

/**
 * 処理完了時の処理
 * @param {Object} data - 完了データ
 */
function handleProcessingComplete(data) {
    const imageCount = data.image_count || 0;
    
    if (imageCount > 0) {
        showProcessingStatus(`処理完了！${imageCount}枚の画像を抽出しました`, 'alert-success', 100);
        showProcessingActions();
        loadExtractedImages();
        loadProcessingHistory();
        
        if (data.yolo_used) {
            showSuccessMessage(`${imageCount}枚の生殖乳頭画像を抽出し、YOLOモデルで検出しました`);
        } else {
            showSuccessMessage(`${imageCount}枚の生殖乳頭画像を抽出しました`);
        }
    } else {
        showProcessingStatus('処理完了しましたが、生殖乳頭が検出されませんでした', 'alert-warning', 100);
        showWarningMessage('生殖乳頭が検出されませんでした。動画の品質や設定を確認してください。');
    }
}

/**
 * 処理状況の表示
 * @param {string} message - メッセージ
 * @param {string} alertClass - アラートクラス
 * @param {number} progress - 進捗（0-100）
 */
function showProcessingStatus(message, alertClass, progress) {
    const statusElement = document.getElementById('processingStatus');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    
    if (statusElement) {
        statusElement.className = `alert ${alertClass}`;
        statusElement.textContent = message;
        statusElement.classList.remove('d-none');
    }
    
    if (progressContainer && progressBar) {
        progressContainer.classList.remove('d-none');
        progressBar.style.width = progress + '%';
        progressBar.textContent = Math.round(progress) + '%';
        
        if (progress >= 100) {
            progressBar.classList.remove('progress-bar-animated');
        } else {
            progressBar.classList.add('progress-bar-animated');
        }
    }
}

/**
 * 処理完了時アクションの表示
 */
function showProcessingActions() {
    const actionsElement = document.getElementById('processingActions');
    if (actionsElement) {
        actionsElement.classList.remove('d-none');
    }
}

/**
 * 抽出画像の読み込み
 */
async function loadExtractedImages() {
    if (!videoProcessingService.currentTaskId) return;
    
    try {
        const data = await apiRequest('/video/extracted-images/' + videoProcessingService.currentTaskId);
        
        if (!data.error) {
            videoProcessingService.extractedImages = data.images || [];
            displayExtractionResults();
            updateImageCounter(videoProcessingService.extractedImages.length);
            
            const refreshBtn = document.getElementById('refreshResultsBtn');
            if (refreshBtn) refreshBtn.style.display = 'inline-block';
        }
    } catch (error) {
        showErrorMessage('抽出画像の読み込みに失敗しました: ' + error.message);
    }
}

/**
 * 抽出結果の表示
 */
function displayExtractionResults() {
    const placeholder = document.getElementById('extractionPlaceholder');
    const results = document.getElementById('extractionResults');
    const container = document.getElementById('extractedImagesContainer');
    
    if (placeholder) placeholder.classList.add('d-none');
    if (results) results.classList.remove('d-none');
    
    if (!container) return;
    
    if (videoProcessingService.extractedImages.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                <p>抽出された画像がありません</p>
            </div>
        `;
        return;
    }
    
    const imageCards = videoProcessingService.extractedImages.map((imageUrl, index) => {
        const fileName = imageUrl.split('/').pop();
        const hasYoloDetection = imageUrl.includes('_yolo_') || imageUrl.includes('_detected_');
        
        const yoloBadge = hasYoloDetection ? 
            '<span class="badge bg-info position-absolute top-0 end-0 m-1" title="YOLO検出済み"><i class="fas fa-object-group"></i></span>' : '';
        
        return `
            <div class="image-card" data-image-url="${imageUrl}" data-image-name="${fileName}">
                ${yoloBadge}
                <img src="${imageUrl}" alt="抽出画像 ${index + 1}" class="image-preview" 
                     onclick="openImageDetail('${imageUrl}', '${fileName}')">
                <div class="image-info">${fileName}</div>
                <div class="image-controls">
                    <button class="btn btn-sm btn-outline-primary" onclick="openImageDetail('${imageUrl}', '${fileName}')">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = imageCards;
}

/**
 * 画像カウンターの更新
 * @param {number} count - 画像数
 */
function updateImageCounter(count) {
    const counter = document.getElementById('imageCounter');
    if (counter) counter.textContent = `${count}枚`;
}

/**
 * 全画像のZIPダウンロード
 */
function downloadAllImagesAsZip() {
    if (!videoProcessingService.currentTaskId) {
        showWarningMessage('ダウンロードするタスクがありません');
        return;
    }
    
    showLoading();
    
    const downloadUrl = `/video/download-zip/${videoProcessingService.currentTaskId}`;
    window.location.href = downloadUrl;
    
    setTimeout(() => {
        hideLoading();
        showSuccessMessage('画像のダウンロードを開始しました');
    }, 1000);
}

/**
 * 画像選択モーダルを開く
 */
function openImageSelectionModal() {
    if (videoProcessingService.extractedImages.length === 0) {
        showWarningMessage('選択する画像がありません');
        return;
    }
    
    const container = document.getElementById('selectableImagesContainer');
    if (container) {
        const imageCards = videoProcessingService.extractedImages.map((imageUrl, index) => {
            const fileName = imageUrl.split('/').pop();
            const hasYoloDetection = imageUrl.includes('_yolo_') || imageUrl.includes('_detected_');
            
            const yoloBadge = hasYoloDetection ? 
                '<span class="badge bg-info" title="YOLO検出済み"><i class="fas fa-object-group"></i></span>' : '';
            
            return `
                <div class="col-md-3 col-sm-4 col-6">
                    <div class="card image-selection-card" data-image-name="${fileName}">
                        <div class="card-body p-2">
                            <div class="form-check mb-2">
                                <input class="form-check-input image-checkbox" type="checkbox" 
                                       value="${fileName}" id="img_${index}">
                                <label class="form-check-label" for="img_${index}">
                                    選択 ${yoloBadge}
                                </label>
                            </div>
                            <img src="${imageUrl}" alt="${fileName}" class="img-fluid rounded">
                            <small class="text-muted d-block mt-1">${fileName}</small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = imageCards;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('imageSelectionModal'));
    modal.show();
}

/**
 * YOLO検出モーダルを開く
 */
function openYoloDetectionModal() {
    if (!videoProcessingService.yoloDetectionEnabled) {
        showWarningMessage('YOLOモデルが利用できません。学習ページでモデルを作成してください。');
        return;
    }
    
    const confidenceSlider = document.getElementById('yolo-detection-confidence');
    const confidenceValue = document.getElementById('yolo-detection-confidence-value');
    
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.value = videoProcessingService.lastYoloConfidence;
        confidenceValue.textContent = confidenceSlider.value;
        
        confidenceSlider.addEventListener('input', function() {
            confidenceValue.textContent = this.value;
        });
    }
    
    const imageCountElement = document.getElementById('yolo-detection-image-count');
    if (imageCountElement) {
        imageCountElement.textContent = videoProcessingService.extractedImages.length;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('yoloDetectionModal'));
    modal.show();
}

/**
 * 学習データ送信モーダルを開く
 */
function openSendToLearningModal() {
    const imageCountElement = document.getElementById('learning-image-count');
    if (imageCountElement) {
        imageCountElement.textContent = videoProcessingService.extractedImages.length;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('sendToLearningModal'));
    modal.show();
}

/**
 * YOLO検出の実行
 */
async function executeYoloDetection() {
    const confidenceSlider = document.getElementById('yolo-detection-confidence');
    if (!confidenceSlider) {
        showErrorMessage('信頼度設定が見つかりません');
        return;
    }
    
    const confidence = parseFloat(confidenceSlider.value);
    videoProcessingService.lastYoloConfidence = confidence;
    
    try {
        showLoading();
        
        const data = await apiRequest('/video/detect-yolo', {
            method: 'POST',
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                confidence: confidence
            })
        });
        
        hideLoading();
        
        if (data.error) {
            showErrorMessage('YOLO検出エラー: ' + data.error);
            return;
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('yoloDetectionModal'));
        if (modal) modal.hide();
        
        showSuccessMessage(`${data.detected_count || 0}個の生殖乳頭を検出しました`);
        loadExtractedImages();
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLO検出中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 学習データへの送信を実行
 */
async function executeSendToLearning() {
    const genderSelect = document.getElementById('learning-gender-select');
    if (!genderSelect) {
        showErrorMessage('性別選択が見つかりません');
        return;
    }
    
    const gender = genderSelect.value;
    
    try {
        showLoading();
        
        const data = await apiRequest('/video/send-to-learning', {
            method: 'POST',
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                gender: gender
            })
        });
        
        hideLoading();
        
        if (data.error) {
            showErrorMessage('送信エラー: ' + data.error);
            return;
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('sendToLearningModal'));
        if (modal) modal.hide();
        
        showSuccessMessage(`${data.copied_count || 0}枚の画像を学習データに送信しました`);
        
    } catch (error) {
        hideLoading();
        showErrorMessage('学習データ送信中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 全画像を選択
 */
function selectAllImages() {
    const checkboxes = document.querySelectorAll('.image-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = true);
}

/**
 * 全画像選択を解除
 */
function deselectAllImages() {
    const checkboxes = document.querySelectorAll('.image-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
}

/**
 * 選択画像のダウンロード
 */
async function downloadSelectedImages() {
    const checkboxes = document.querySelectorAll('.image-checkbox:checked');
    const selectedImageNames = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedImageNames.length === 0) {
        showWarningMessage('ダウンロードする画像を選択してください');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/video/download-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                image_names: selectedImageNames
            })
        });
        
        if (!response.ok) throw new Error('ダウンロードに失敗しました');
        
        const blob = await response.blob();
        hideLoading();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected_images_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageSelectionModal'));
        if (modal) modal.hide();
        
        showSuccessMessage(`${selectedImageNames.length}枚の画像をダウンロードしました`);
        
    } catch (error) {
        hideLoading();
        showErrorMessage('選択画像のダウンロードに失敗しました: ' + error.message);
    }
}

/**
 * 画像詳細を開く
 * @param {string} imageUrl - 画像URL
 * @param {string} fileName - ファイル名
 */
function openImageDetail(imageUrl, fileName) {
    const modalImage = document.getElementById('modalDetailImage');
    const modalInfo = document.getElementById('modalImageInfo');
    
    if (modalImage) {
        modalImage.src = imageUrl;
        modalImage.alt = fileName;
    }
    
    if (modalInfo) {
        const hasYoloDetection = imageUrl.includes('_yolo_') || imageUrl.includes('_detected_');
        const yoloInfo = hasYoloDetection ? 
            '<p><strong>YOLO検出:</strong> <span class="badge bg-info">検出済み</span></p>' : '';
        
        modalInfo.innerHTML = `
            <h6>ファイル情報</h6>
            <p><strong>ファイル名:</strong> ${fileName}</p>
            <p><strong>URL:</strong> <code>${imageUrl}</code></p>
            ${yoloInfo}
        `;
    }
    
    document.getElementById('downloadSingleBtn').dataset.imageUrl = imageUrl;
    document.getElementById('downloadSingleBtn').dataset.fileName = fileName;
    
    const singleYoloBtn = document.getElementById('detectSingleYoloBtn');
    if (singleYoloBtn) {
        if (videoProcessingService.yoloDetectionEnabled && 
            !(imageUrl.includes('_yolo_') || imageUrl.includes('_detected_'))) {
            singleYoloBtn.style.display = 'inline-block';
            singleYoloBtn.dataset.imageUrl = imageUrl;
            singleYoloBtn.dataset.fileName = fileName;
        } else {
            singleYoloBtn.style.display = 'none';
        }
    }
    
    const modal = new bootstrap.Modal(document.getElementById('imageDetailModal'));
    modal.show();
}

/**
 * 単一画像のダウンロード
 */
function downloadSingleImage() {
    const button = document.getElementById('downloadSingleBtn');
    const imageUrl = button.dataset.imageUrl;
    const fileName = button.dataset.fileName;
    
    if (!imageUrl || !fileName) {
        showWarningMessage('ダウンロード情報がありません');
        return;
    }
    
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showSuccessMessage(`${fileName} をダウンロードしました`);
}

/**
 * 単一画像のYOLO検出
 */
async function detectSingleImageWithYolo() {
    const button = document.getElementById('detectSingleYoloBtn');
    const imageUrl = button.dataset.imageUrl;
    const fileName = button.dataset.fileName;
    
    if (!imageUrl || !fileName || !videoProcessingService.yoloDetectionEnabled) {
        showWarningMessage('YOLO検出ができません');
        return;
    }
    
    try {
        showLoading();
        
        const data = await apiRequest('/video/detect-single-yolo', {
            method: 'POST',
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                image_url: imageUrl,
                confidence: videoProcessingService.lastYoloConfidence
            })
        });
        
        hideLoading();
        
        if (data.error) {
            showErrorMessage('YOLO検出エラー: ' + data.error);
            return;
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageDetailModal'));
        if (modal) modal.hide();
        
        showSuccessMessage(`${data.detected_count || 0}個の生殖乳頭を検出しました`);
        loadExtractedImages();
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLO検出中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 処理履歴の読み込み
 */
const loadProcessingHistory = debounce(async function() {
    try {
        const data = await apiRequest('/video/processing-history');
        videoProcessingService.processingHistory = data.history || [];
        updateHistoryDisplay();
    } catch (error) {
        console.error('履歴読み込みエラー:', error);
    }
}, 300);

/**
 * 履歴表示の更新
 */
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('processingHistory');
    const historyCount = document.getElementById('historyCount');
    
    if (!historyContainer) return;
    
    if (historyCount) {
        historyCount.textContent = `${videoProcessingService.processingHistory.length}件`;
    }
    
    if (videoProcessingService.processingHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <p class="mb-0">まだ処理履歴がありません</p>
            </div>
        `;
        return;
    }
    
    const historyHTML = videoProcessingService.processingHistory.map(item => {
        const yoloBadge = item.yolo_used ? 
            '<span class="badge bg-info ms-2" title="YOLO検出使用">YOLO</span>' : '';
        
        return `
            <div class="border-bottom py-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>タスクID:</strong> ${item.task_id.substring(0, 8)}...
                        <span class="badge bg-primary ms-2">${item.image_count}枚</span>
                        ${yoloBadge}
                    </div>
                    <div>
                        <small class="text-muted me-3">${item.date}</small>
                        <button class="btn btn-sm btn-outline-success" 
                                onclick="redownloadTask('${item.task_id}')">
                            <i class="fas fa-download"></i> 再ダウンロード
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = historyHTML;
}

/**
 * タスクの再ダウンロード
 * @param {string} taskId - タスクID
 */
function redownloadTask(taskId) {
    showLoading();
    
    const downloadUrl = `/video/download-zip/${taskId}`;
    window.location.href = downloadUrl;
    
    setTimeout(() => {
        hideLoading();
        showSuccessMessage('履歴タスクのダウンロードを開始しました');
    }, 1000);
}

/**
 * 現在のタスクIDを保存
 * @param {string} taskId - タスクID
 */
function saveCurrentTask(taskId) {
    localStorage.setItem('currentVideoTaskId', taskId);
}

/**
 * 現在のタスクIDを復元
 */
function restoreCurrentTask() {
    const savedTaskId = localStorage.getItem('currentVideoTaskId');
    if (savedTaskId) {
        videoProcessingService.currentTaskId = savedTaskId;
        checkProcessingStatus();
    }
}

// グローバル関数のエクスポート
window.openImageDetail = openImageDetail;
window.redownloadTask = redownloadTask;
window.detectSingleImageWithYolo = detectSingleImageWithYolo;