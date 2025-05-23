/**
 * ウニ生殖乳頭分析システム - 動画処理サービス
 * 動画からの生殖乳頭画像抽出に特化したモジュール
 */

// 動画処理サービスの状態管理
const videoProcessingService = {
    currentTaskId: null,
    statusCheckInterval: null,
    extractedImages: [],
    selectedImages: [],
    processingHistory: [],
    yoloDetectionEnabled: false, // YOLO検出の有効状態
    lastYoloConfidence: 0.25     // YOLO検出の最後に使用した信頼度閾値
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
    // フォーム送信イベントの設定
    initVideoProcessingForm();
    
    // ボタンイベントの設定
    initActionButtons();
    
    // モーダル関連の設定
    initModals();
    
    // 処理履歴の読み込み
    loadProcessingHistory();
    
    // 保存されたタスクIDの復元
    restoreCurrentTask();
    
    // YOLOモデル状態のチェック
    checkYoloModelAvailability();
}

/**
 * YOLOモデルの利用可能性をチェック
 */
async function checkYoloModelAvailability() {
    try {
        const response = await fetch('/yolo/model-status');
        if (!response.ok) throw new Error('モデル状態の取得に失敗しました');
        
        const data = await response.json();
        videoProcessingService.yoloDetectionEnabled = data.exists;
        
        // UI要素の更新
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
    // YOLOオプションの表示/非表示
    const yoloOptions = document.getElementById('yolo-options');
    if (yoloOptions) {
        yoloOptions.style.display = available ? 'block' : 'none';
    }
    
    // YOLO検出ボタンの有効/無効
    const yoloDetectBtn = document.getElementById('yolo-detect-btn');
    if (yoloDetectBtn) {
        yoloDetectBtn.disabled = !available;
        yoloDetectBtn.title = available ? 
            'YOLOモデルで生殖乳頭を検出' : 
            'YOLOモデルが利用できません。学習ページでモデルを作成してください。';
    }
    
    // YOLOステータス表示
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

// ユーティリティ関数の定義
function showLoading() {
    if (typeof window.showLoading === 'function') {
        window.showLoading();
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('d-none');
        }
    }
}

function hideLoading() {
    if (typeof window.hideLoading === 'function') {
        window.hideLoading();
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    }
}

function showSuccessMessage(message, duration = 3000) {
    if (typeof window.showSuccessMessage === 'function') {
        window.showSuccessMessage(message, duration);
    } else {
        showUserMessage(message, 'success', duration);
    }
}

function showErrorMessage(message, duration = 5000) {
    if (typeof window.showErrorMessage === 'function') {
        window.showErrorMessage(message, duration);
    } else {
        showUserMessage(message, 'danger', duration);
    }
}

function showWarningMessage(message, duration = 4000) {
    if (typeof window.showWarningMessage === 'function') {
        window.showWarningMessage(message, duration);
    } else {
        showUserMessage(message, 'warning', duration);
    }
}

function showUserMessage(message, type, duration) {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    
    // タイプに応じたアイコンを選択
    const icon = type === 'success' ? 'check-circle' : 
                type === 'danger' ? 'exclamation-circle' : 
                type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    alertElement.innerHTML = `
        <i class="fas fa-${icon} me-2"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertElement, container.firstChild);
        
        if (duration > 0) {
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, duration);
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
    
    // YOLOオプション設定
    const useYoloCheckbox = document.getElementById('use-yolo-detection');
    if (useYoloCheckbox) {
        useYoloCheckbox.addEventListener('change', function() {
            const confidenceContainer = document.getElementById('yolo-confidence-container');
            if (confidenceContainer) {
                confidenceContainer.style.display = this.checked ? 'block' : 'none';
            }
        });
        
        // 信頼度スライダーの値表示更新
        const confidenceSlider = document.getElementById('yolo-confidence');
        const confidenceValue = document.getElementById('confidence-value');
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.addEventListener('input', function() {
                confidenceValue.textContent = this.value;
                videoProcessingService.lastYoloConfidence = parseFloat(this.value);
            });
            
            // 初期値を設定
            confidenceSlider.value = videoProcessingService.lastYoloConfidence;
            confidenceValue.textContent = confidenceSlider.value;
        }
    }
}

/**
 * アクションボタンの初期化
 */
function initActionButtons() {
    // ZIP一括ダウンロードボタン
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    if (downloadZipBtn) {
        downloadZipBtn.addEventListener('click', function() {
            downloadAllImagesAsZip();
        });
    }
    
    // 抽出結果表示ボタン
    const viewResultsBtn = document.getElementById('viewResultsBtn');
    if (viewResultsBtn) {
        viewResultsBtn.addEventListener('click', function() {
            displayExtractionResults();
        });
    }
    
    // 全画像ダウンロードボタン
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', function() {
            downloadAllImagesAsZip();
        });
    }
    
    // 選択ダウンロードボタン
    const selectImagesBtn = document.getElementById('selectImagesBtn');
    if (selectImagesBtn) {
        selectImagesBtn.addEventListener('click', function() {
            openImageSelectionModal();
        });
    }
    
    // 結果更新ボタン
    const refreshResultsBtn = document.getElementById('refreshResultsBtn');
    if (refreshResultsBtn) {
        refreshResultsBtn.addEventListener('click', function() {
            loadExtractedImages();
        });
    }
    
    // YOLO検出ボタン
    const yoloDetectBtn = document.getElementById('yolo-detect-btn');
    if (yoloDetectBtn) {
        yoloDetectBtn.addEventListener('click', function() {
            if (videoProcessingService.extractedImages.length === 0) {
                showWarningMessage('検出する画像がありません。まず動画から画像を抽出してください。');
                return;
            }
            
            // YOLO検出確認ダイアログを表示
            openYoloDetectionModal();
        });
    }
    
    // 学習データに送信ボタン
    const sendToLearningBtn = document.getElementById('send-to-learning-btn');
    if (sendToLearningBtn) {
        sendToLearningBtn.addEventListener('click', function() {
            if (videoProcessingService.extractedImages.length === 0) {
                showWarningMessage('送信する画像がありません。まず動画から画像を抽出してください。');
                return;
            }
            
            // 学習データ送信ダイアログを表示
            openSendToLearningModal();
        });
    }
}

/**
 * モーダル関連の初期化
 */
function initModals() {
    // 全選択ボタン
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            selectAllImages();
        });
    }
    
    // 全解除ボタン
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            deselectAllImages();
        });
    }
    
    // 選択画像ダウンロードボタン
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', function() {
            downloadSelectedImages();
        });
    }
    
    // 単一画像ダウンロードボタン
    const downloadSingleBtn = document.getElementById('downloadSingleBtn');
    if (downloadSingleBtn) {
        downloadSingleBtn.addEventListener('click', function() {
            downloadSingleImage();
        });
    }
    
    // YOLO検出実行ボタン
    const runYoloDetectionBtn = document.getElementById('run-yolo-detection');
    if (runYoloDetectionBtn) {
        runYoloDetectionBtn.addEventListener('click', function() {
            executeYoloDetection();
        });
    }
    
    // 学習データに送信実行ボタン
    const sendToLearningConfirmBtn = document.getElementById('send-to-learning-confirm');
    if (sendToLearningConfirmBtn) {
        sendToLearningConfirmBtn.addEventListener('click', function() {
            executeSendToLearning();
        });
    }
}

/**
 * 動画処理の実行
 */
function executeVideoProcessing() {
    const videoFile = document.getElementById('videoFile').files[0];
    const maxImages = document.getElementById('maxImages').value;
    
    if (!videoFile) {
        alert('動画ファイルを選択してください');
        return;
    }
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('max_images', maxImages);
    
    // YOLOオプションの取得
    const useYolo = document.getElementById('use-yolo-detection')?.checked || false;
    const confidence = document.getElementById('yolo-confidence')?.value || 0.25;
    
    if (useYolo) {
        if (!videoProcessingService.yoloDetectionEnabled) {
            showWarningMessage('YOLOモデルが利用できません。学習ページでモデルを作成してください。');
            return;
        }
        
        formData.append('use_yolo', 'true');
        formData.append('confidence', confidence);
        
        // 最後に使用した信頼度を保存
        videoProcessingService.lastYoloConfidence = parseFloat(confidence);
    }
    
    // ローディング表示
    showLoading();
    
    // 処理状況の初期化
    showProcessingStatus('処理を開始しています...', 'alert-info', 5);
    
    // AJAX送信
    fetch('/video/upload', {
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
        hideLoading();
        
        if (data.error) {
            showProcessingStatus('エラー: ' + data.error, 'alert-danger', 0);
            return;
        }
        
        // タスクIDの保存
        videoProcessingService.currentTaskId = data.task_id;
        saveCurrentTask(data.task_id);
        
        showProcessingStatus('動画を解析中...', 'alert-info', 10);
        
        // 状態チェック開始
        startStatusCheck();
        
        showSuccessMessage('動画の処理を開始しました');
    })
    .catch(error => {
        hideLoading();
        showProcessingStatus('処理中にエラーが発生しました: ' + error.message, 'alert-danger', 0);
        showErrorMessage('動画処理中にエラーが発生しました: ' + error.message);
    });
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
    }, 2000); // 2秒間隔
}

/**
 * 処理状態のチェック
 */
function checkProcessingStatus() {
    if (!videoProcessingService.currentTaskId) return;
    
    // APIエンドポイントを使用
    fetch('/video/status/' + videoProcessingService.currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('状態取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        updateProcessingStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error' || data.status === 'failed') {
            clearInterval(videoProcessingService.statusCheckInterval);
            videoProcessingService.statusCheckInterval = null;
            
            if (data.status === 'completed') {
                handleProcessingComplete(data);
            }
        }
    })
    .catch(error => {
        // エラーが続く場合は停止
        clearInterval(videoProcessingService.statusCheckInterval);
        videoProcessingService.statusCheckInterval = null;
    });
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
        
        // 完了時アクションを表示
        showProcessingActions();
        
        // 抽出画像を読み込み
        loadExtractedImages();
        
        // 履歴を更新
        loadProcessingHistory();
        
        // YOLO検出を使用した場合は特別なメッセージ
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
function loadExtractedImages() {
    if (!videoProcessingService.currentTaskId) {
        return;
    }
    
    fetch('/video/extracted-images/' + videoProcessingService.currentTaskId)
    .then(response => {
        if (!response.ok) {
            throw new Error('画像取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            return;
        }
        
        videoProcessingService.extractedImages = data.images || [];
        
        displayExtractionResults();
        updateImageCounter(videoProcessingService.extractedImages.length);
        
        // 結果更新ボタンを表示
        const refreshBtn = document.getElementById('refreshResultsBtn');
        if (refreshBtn) {
            refreshBtn.style.display = 'inline-block';
        }
    })
    .catch(error => {
        showErrorMessage('抽出画像の読み込みに失敗しました: ' + error.message);
    });
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
    
    // 画像カードの生成
    const imageCards = videoProcessingService.extractedImages.map((imageUrl, index) => {
        const fileName = imageUrl.split('/').pop();
        const hasYoloDetection = imageUrl.includes('_yolo_') || imageUrl.includes('_detected_');
        
        // YOLO検出されたかどうかのバッジ
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
    if (counter) {
        counter.textContent = `${count}枚`;
    }
}

/**
 * 全画像のZIPダウンロード
 */
function downloadAllImagesAsZip() {
    if (!videoProcessingService.currentTaskId) {
        alert('ダウンロードするタスクがありません');
        return;
    }
    
    showLoading();
    
    // ZIPダウンロードのURL
    const downloadUrl = `/video/download-zip/${videoProcessingService.currentTaskId}`;
    
    // ダウンロード実行
    window.location.href = downloadUrl;
    
    // 少し待ってからローディングを隠す
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
        alert('選択する画像がありません');
        return;
    }
    
    // モーダル内に画像を表示
    const container = document.getElementById('selectableImagesContainer');
    if (container) {
        const imageCards = videoProcessingService.extractedImages.map((imageUrl, index) => {
            const fileName = imageUrl.split('/').pop();
            const hasYoloDetection = imageUrl.includes('_yolo_') || imageUrl.includes('_detected_');
            
            // YOLO検出されたかどうかのバッジ
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
    
    // モーダル表示
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
    
    // 信頼度スライダーの初期値を設定
    const confidenceSlider = document.getElementById('yolo-detection-confidence');
    const confidenceValue = document.getElementById('yolo-detection-confidence-value');
    
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.value = videoProcessingService.lastYoloConfidence;
        confidenceValue.textContent = confidenceSlider.value;
        
        // スライダー変更イベント
        confidenceSlider.addEventListener('input', function() {
            confidenceValue.textContent = this.value;
        });
    }
    
    // 画像数の表示
    const imageCountElement = document.getElementById('yolo-detection-image-count');
    if (imageCountElement) {
        imageCountElement.textContent = videoProcessingService.extractedImages.length;
    }
    
    // モーダル表示
    const modal = new bootstrap.Modal(document.getElementById('yoloDetectionModal'));
    modal.show();
}

/**
 * 学習データ送信モーダルを開く
 */
function openSendToLearningModal() {
    // 画像数の表示
    const imageCountElement = document.getElementById('learning-image-count');
    if (imageCountElement) {
        imageCountElement.textContent = videoProcessingService.extractedImages.length;
    }
    
    // モーダル表示
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
        // ローディング表示
        showLoading();
        
        // YOLO検出APIを呼び出す
        const response = await fetch('/video/detect-yolo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                confidence: confidence
            })
        });
        
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ローディング非表示
        hideLoading();
        
        if (data.error) {
            showErrorMessage('YOLO検出エラー: ' + data.error);
            return;
        }
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('yoloDetectionModal'));
        if (modal) modal.hide();
        
        // 成功メッセージ
        showSuccessMessage(`${data.detected_count || 0}個の生殖乳頭を検出しました`);
        
        // 画像を再読み込み
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
        // ローディング表示
        showLoading();
        
        // 学習データ送信APIを呼び出す
        const response = await fetch('/video/send-to-learning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                gender: gender
            })
        });
        
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ローディング非表示
        hideLoading();
        
        if (data.error) {
            showErrorMessage('送信エラー: ' + data.error);
            return;
        }
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('sendToLearningModal'));
        if (modal) modal.hide();
        
        // 成功メッセージ
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
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

/**
 * 全画像選択を解除
 */
function deselectAllImages() {
    const checkboxes = document.querySelectorAll('.image-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

/**
 * 選択画像のダウンロード
 */
function downloadSelectedImages() {
    const checkboxes = document.querySelectorAll('.image-checkbox:checked');
    const selectedImageNames = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedImageNames.length === 0) {
        alert('ダウンロードする画像を選択してください');
        return;
    }
    
    showLoading();
    
    // 選択画像ダウンロードのリクエスト
    fetch('/video/download-selected', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            task_id: videoProcessingService.currentTaskId,
            image_names: selectedImageNames
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('ダウンロードに失敗しました');
        }
        return response.blob();
    })
    .then(blob => {
        hideLoading();
        
        // ダウンロード実行
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected_images_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageSelectionModal'));
        if (modal) {
            modal.hide();
        }
        
        showSuccessMessage(`${selectedImageNames.length}枚の画像をダウンロードしました`);
    })
    .catch(error => {
        hideLoading();
        showErrorMessage('選択画像のダウンロードに失敗しました: ' + error.message);
    });
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
    
    // 単一ダウンロード用にファイル名を保存
    document.getElementById('downloadSingleBtn').dataset.imageUrl = imageUrl;
    document.getElementById('downloadSingleBtn').dataset.fileName = fileName;
    
    // YOLOボタンの表示/非表示
    const singleYoloBtn = document.getElementById('detectSingleYoloBtn');
    if (singleYoloBtn) {
        // YOLO検出が有効かつまだ検出されていない場合のみ表示
        if (videoProcessingService.yoloDetectionEnabled && 
            !(imageUrl.includes('_yolo_') || imageUrl.includes('_detected_'))) {
            singleYoloBtn.style.display = 'inline-block';
            singleYoloBtn.dataset.imageUrl = imageUrl;
            singleYoloBtn.dataset.fileName = fileName;
        } else {
            singleYoloBtn.style.display = 'none';
        }
    }
    
    // モーダル表示
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
        alert('ダウンロード情報がありません');
        return;
    }
    
    // 画像ダウンロード実行
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
        alert('YOLO検出ができません');
        return;
    }
    
    try {
        // ローディング表示
        showLoading();
        
        // 単一画像YOLO検出APIを呼び出す
        const response = await fetch('/video/detect-single-yolo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: videoProcessingService.currentTaskId,
                image_url: imageUrl,
                confidence: videoProcessingService.lastYoloConfidence
            })
        });
        
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ローディング非表示
        hideLoading();
        
        if (data.error) {
            showErrorMessage('YOLO検出エラー: ' + data.error);
            return;
        }
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageDetailModal'));
        if (modal) modal.hide();
        
        // 成功メッセージ
        showSuccessMessage(`${data.detected_count || 0}個の生殖乳頭を検出しました`);
        
        // 画像を再読み込み
        loadExtractedImages();
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLO検出中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 処理履歴の読み込み
 */
function loadProcessingHistory() {
    fetch('/video/processing-history')
    .then(response => {
        if (!response.ok) {
            throw new Error('履歴取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        videoProcessingService.processingHistory = data.history || [];
        updateHistoryDisplay();
    })
    .catch(error => {
        // エラー処理
    });
}

/**
 * 履歴表示の更新
 */
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('processingHistory');
    const historyCount = document.getElementById('historyCount');
    
    if (!historyContainer) return;
    
    // 件数更新
    if (historyCount) {
        historyCount.textContent = `${videoProcessingService.processingHistory.length}件`;
    }
    
    // 履歴表示
    if (videoProcessingService.processingHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <p class="mb-0">まだ処理履歴がありません</p>
            </div>
        `;
        return;
    }
    
    // 履歴項目の生成
    const historyHTML = videoProcessingService.processingHistory.map(item => {
        // YOLO検出されたかどうかのバッジ
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
        
        // 状態確認
        checkProcessingStatus();
    }
}

// グローバル関数のエクスポート
window.selectAllImages = selectAllImages;
window.deselectAllImages = deselectAllImages;
window.openImageDetail = openImageDetail;
window.redownloadTask = redownloadTask;
window.detectSingleImageWithYolo = detectSingleImageWithYolo;