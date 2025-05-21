/**
 * ウニ生殖乳頭分析システム - タスク管理モジュール
 * 処理タスクの状態管理と履歴表示に関する機能
 */

/**
 * タスク管理モジュールの初期化
 */
function initTaskManager() {
    // 必要なイベントハンドラの設定など
}

/**
 * 状態チェックの開始
 */
function startStatusCheck() {
    // 既存のタイマーをクリア
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 新しいタイマーの設定
    statusCheckInterval = setInterval(checkTaskStatus, 1000);
}

/**
 * タスク状態のチェック
 */
function checkTaskStatus() {
    if (!currentTaskId) return;
    
    fetch('/task-status/' + currentTaskId)
    .then(response => response.json())
    .then(data => {
        // 状態の表示
        updateTaskStatus(data);
        
        // 完了または失敗時の処理
        if (data.status === 'completed' || data.status === 'error') {
            // タイマーの停止
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            // 完了時は画像を読み込む
            if (data.status === 'completed' && data.image_count > 0) {
                loadExtractedImages();
            }
            
            // 訓練結果の表示
            if (data.status === 'completed' && data.accuracy !== undefined) {
                showTrainingResult(data);
            }
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
    });
}

/**
 * タスク状態の更新
 */
function updateTaskStatus(data) {
    const statusElement = document.getElementById('processingStatus');
    const progressElement = document.getElementById('progressBar');
    const trainingStatusElement = document.getElementById('trainingStatus');
    const trainingProgressElement = document.getElementById('trainingProgressBar');
    
    // 処理状態の更新
    if (statusElement && progressElement) {
        // ステータスメッセージ
        statusElement.textContent = data.message || '処理中...';
        
        // ステータスクラス
        statusElement.className = 'alert';
        if (data.status === 'processing' || data.status === 'queued') {
            statusElement.classList.add('alert-info');
        } else if (data.status === 'completed') {
            statusElement.classList.add('alert-success');
        } else if (data.status === 'error') {
            statusElement.classList.add('alert-danger');
        }
        
        // プログレスバー
        if (data.progress !== undefined) {
            progressElement.style.width = data.progress + '%';
            progressElement.textContent = Math.round(data.progress) + '%';
        }
    }
    
    // 訓練状態の更新
    if (trainingStatusElement && trainingProgressElement) {
        // ステータスメッセージ
        trainingStatusElement.textContent = data.message || '処理中...';
        
        // ステータスクラス
        trainingStatusElement.className = 'alert';
        if (data.status === 'processing' || data.status === 'queued') {
            trainingStatusElement.classList.add('alert-info');
        } else if (data.status === 'completed') {
            trainingStatusElement.classList.add('alert-success');
        } else if (data.status === 'error') {
            trainingStatusElement.classList.add('alert-danger');
        }
        
        // プログレスバー
        if (data.progress !== undefined) {
            trainingProgressElement.style.width = data.progress + '%';
            trainingProgressElement.textContent = Math.round(data.progress) + '%';
        }
    }
}

/**
 * タスク履歴の読み込み
 */
function loadTaskHistory() {
    fetch('/task-history')
    .then(response => response.json())
    .then(data => {
        const historyTable = document.getElementById('taskHistoryTable');
        if (!historyTable) return;
        
        const tableBody = historyTable.getElementsByTagName('tbody')[0];
        
        tableBody.innerHTML = '';
        
        if (data.tasks.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 4;
            cell.className = 'text-center text-muted';
            cell.textContent = '処理履歴がありません';
            return;
        }
        
        data.tasks.forEach(task => {
            const row = tableBody.insertRow();
            
            // 日時
            const dateCell = row.insertCell(0);
            dateCell.textContent = task.date;
            
            // タスクID
            const idCell = row.insertCell(1);
            idCell.textContent = task.task_id.substring(0, 8) + '...';
            idCell.title = task.task_id;
            
            // 画像数
            const countCell = row.insertCell(2);
            countCell.textContent = task.image_count + '枚';
            
            // 操作ボタン
            const actionCell = row.insertCell(3);
            actionCell.innerHTML = `
                <button class="btn btn-sm btn-primary view-history-btn" data-task-id="${task.task_id}">
                    <i class="fas fa-eye"></i> 表示
                </button>
            `;
        });
        
        // イベントリスナーの設定
        document.querySelectorAll('.view-history-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const taskId = this.dataset.taskId;
                loadHistoryImages(taskId);
            });
        });
    })
    .catch(error => {
        console.error('タスク履歴の取得エラー:', error);
    });
}

/**
 * 履歴画像の読み込み
 */
function loadHistoryImages(taskId) {
    const container = document.getElementById('historyImagesContainer');
    if (!container) return;
    
    // ローディング表示
    container.innerHTML = `
        <div class="text-center py-5 w-100">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2">画像を読み込んでいます...</p>
        </div>
    `;
    
    fetch('/video/extracted-images/' + taskId)
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            container.innerHTML = `
                <div class="text-center text-muted py-5 w-100">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>エラー: ${data.error}</p>
                </div>
            `;
            return;
        }
        
        const images = data.images || [];
        displayHistoryImages(images, taskId);
    })
    .catch(error => {
        console.error('履歴画像の読み込みエラー:', error);
        container.innerHTML = `
            <div class="text-center text-muted py-5 w-100">
                <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                <p>画像の読み込み中にエラーが発生しました</p>
            </div>
        `;
    });
}

/**
 * 履歴画像の表示
 */
function displayHistoryImages(images, taskId) {
    const container = document.getElementById('historyImagesContainer');
    const countElement = document.getElementById('historyImageCount');
    
    if (!container || !countElement) return;
    
    // コンテナのクリア
    container.innerHTML = '';
    
    if (images.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5 w-100">
                <i class="fas fa-photo-video fa-3x mb-3"></i>
                <p>このタスクには画像がありません</p>
            </div>
        `;
        countElement.textContent = '0/0';
        return;
    }
    
    // 画像カードの作成
    images.forEach((imageUrl, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="履歴画像 ${index + 1}" class="image-preview">
            <div class="image-controls">
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary history-view-btn" data-index="${index}">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success history-mark-btn" data-index="${index}">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger history-delete-btn" data-index="${index}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="btn-group mt-1" role="group">
                    <button class="btn btn-sm btn-outline-primary history-male-btn" data-index="${index}">
                        <i class="fas fa-mars"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger history-female-btn" data-index="${index}">
                        <i class="fas fa-venus"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // カウンター更新
    countElement.textContent = `${images.length} 枚の画像`;
    
    // イベントリスナーの設定
    attachHistoryImageEventListeners(images, taskId);
}

/**
 * 履歴画像のイベントリスナーを設定
 */
function attachHistoryImageEventListeners(images, taskId) {
    // 表示ボタン
    document.querySelectorAll('.history-view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openHistoryImageModal(images[index]);
        });
    });
    
    // マークボタン
    document.querySelectorAll('.history-mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openMarkingModal(images[index]);
        });
    });

    // 削除ボタン
    document.querySelectorAll('.history-delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            deleteImage(images[index], () => {
                // 削除完了後に画像リストを更新
                loadHistoryImages(taskId);
            });
        });
    });
    
    // オス保存ボタン
    document.querySelectorAll('.history-male-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('male', images[index]);
        });
    });
    
    // メス保存ボタン
    document.querySelectorAll('.history-female-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('female', images[index]);
        });
    });
    
    // 画像プレビュークリックでもモーダルを開く
    document.querySelectorAll('.image-preview').forEach((img, index) => {
        img.addEventListener('click', function() {
            openHistoryImageModal(images[index]);
        });
    });
}

/**
 * 履歴画像モーダルを開く
 */
function openHistoryImageModal(imageUrl) {
    const modalImage = document.getElementById('modalImage');
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    
    // 画像の設定
    modalImage.src = imageUrl;
    
    // モーダルを表示
    modal.show();
}

// モジュールとしてエクスポート（必要に応じて）
// export { initTaskManager, startStatusCheck, checkTaskStatus, loadTaskHistory };