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
    processingHistory: []
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
}

// インポートしていた関数の代替実装
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('d-none');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

function showSuccessMessage(message, duration = 3000) {
    showUserMessage(message, 'success', duration);
}

function showErrorMessage(message, duration = 5000) {
    showUserMessage(message, 'danger', duration);
}

function showWarningMessage(message, duration = 4000) {
    showUserMessage(message, 'warning', duration);
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
    
    // 修正：APIエンドポイントを/api/task-status/から/video/status/に変更
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
        
        showSuccessMessage(`${imageCount}枚の生殖乳頭画像を抽出しました`);
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
        
        return `
            <div class="image-card" data-image-url="${imageUrl}" data-image-name="${fileName}">
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
            
            return `
                <div class="col-md-3 col-sm-4 col-6">
                    <div class="card image-selection-card" data-image-name="${fileName}">
                        <div class="card-body p-2">
                            <div class="form-check mb-2">
                                <input class="form-check-input image-checkbox" type="checkbox" 
                                       value="${fileName}" id="img_${index}">
                                <label class="form-check-label" for="img_${index}">
                                    選択
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
        modalInfo.innerHTML = `
            <h6>ファイル情報</h6>
            <p><strong>ファイル名:</strong> ${fileName}</p>
            <p><strong>URL:</strong> <code>${imageUrl}</code></p>
        `;
    }
    
    // 単一ダウンロード用にファイル名を保存
    document.getElementById('downloadSingleBtn').dataset.imageUrl = imageUrl;
    document.getElementById('downloadSingleBtn').dataset.fileName = fileName;
    
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
        return `
            <div class="border-bottom py-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>タスクID:</strong> ${item.task_id.substring(0, 8)}...
                        <span class="badge bg-primary ms-2">${item.image_count}枚</span>
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