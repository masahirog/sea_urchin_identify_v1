// 現在のタスクID
let currentTaskId = null;
let extractedImages = [];
let currentImageIndex = 0;
let statusCheckInterval = null;

// マーキングモーダル関連の変数
let markingCanvas = null;
let markingContext = null;
let markingImage = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'marker';  // 'marker' or 'eraser'
let markerSize = 5;
let markerOpacity = 0.5;
let originalImagePath = '';

// タスクIDをローカルストレージに保存
function saveTaskId(taskId) {
    localStorage.setItem('currentTaskId', taskId);
}

// タスクIDをローカルストレージから取得
function getTaskId() {
    return localStorage.getItem('currentTaskId');
}

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', function() {
    // 既存のコード...
    
    // 履歴タブが選択されたときに履歴を読み込む
    document.getElementById('history-tab').addEventListener('click', function() {
        loadTaskHistory();
    });
    
    // ローカルストレージからタスクIDを復元
    const savedTaskId = getTaskId();
    if (savedTaskId) {
        currentTaskId = savedTaskId;
        // タスク状態を確認し、処理結果を表示
        checkTaskStatus();
        // 抽出画像を読み込む
        loadExtractedImages();
    }
    
    // 動画処理フォームの送信
    document.getElementById('videoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
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
        
        // AJAX送信
        fetch('/video/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                alert('エラー: ' + data.error);
                return;
            }
            
            // タスクIDの保存
            currentTaskId = data.task_id;
            // タスクIDをローカルストレージに保存
            saveTaskId(currentTaskId);
            
            // 状態表示の初期化
            document.getElementById('processingStatus').classList.remove('d-none');
            document.getElementById('processingStatus').textContent = '処理を開始しました...';
            document.getElementById('progressContainer').classList.remove('d-none');
            document.getElementById('progressBar').style.width = '0%';
            
            // 状態チェックの開始
            startStatusCheck();
        })
        .catch(error => {
            hideLoading();
            alert('エラー: ' + error);
        });
    });
    
    // 画像判別フォームの送信
    document.getElementById('classifyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const imageFile = document.getElementById('imageFile').files[0];
        
        if (!imageFile) {
            alert('画像ファイルを選択してください');
            return;
        }
        
        // フォームデータの作成
        const formData = new FormData();
        formData.append('image', imageFile);
        
        // ローディング表示
        showLoading();
        
        // AJAX送信
        fetch('/image/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                alert('エラー: ' + data.error);
                return;
            }
            
            // 結果の表示
            showClassifyResult(data);
        })
        .catch(error => {
            hideLoading();
            alert('エラー: ' + error);
        });
    });
    
    // モデル訓練ボタン
    document.getElementById('trainModelBtn').addEventListener('click', function() {
        // データセット確認
        fetch('/dataset-info')
        .then(response => response.json())
        .then(data => {
            const totalCount = data.total_count;
            
            if (totalCount < 10) {
                alert('訓練データが少なすぎます。少なくとも10枚のラベル付き画像が必要です。');
                return;
            }
            
            if (data.male_count === 0 || data.female_count === 0) {
                alert('オスとメスの両方の画像が必要です。');
                return;
            }
            
            // 訓練開始
            startModelTraining();
        })
        .catch(error => {
            alert('エラー: ' + error);
        });
    });
    
    // データセット情報更新ボタン
    document.getElementById('refreshDatasetBtn').addEventListener('click', loadDatasetInfo);
    
    // 初期データセット情報の読み込み
    loadDatasetInfo();
    
    // モーダルの保存ボタン
    document.getElementById('saveMaleBtn').addEventListener('click', function() {
        saveImageToDataset('male');
    });
    
    document.getElementById('saveFemaleBtn').addEventListener('click', function() {
        saveImageToDataset('female');
    });
    
    // マーキング関連のイベントリスナー
    if (document.getElementById('markingModal')) {
        // マーキングツールの選択
        document.getElementById('markerTool').addEventListener('click', function() {
            currentTool = 'marker';
            updateToolButtons();
        });
        
        document.getElementById('eraserTool').addEventListener('click', function() {
            currentTool = 'eraser';
            updateToolButtons();
        });
        
        // クリアボタン
        document.getElementById('clearCanvas').addEventListener('click', function() {
            if (confirm('マーキングをクリアしてもよろしいですか？')) {
                // 画像を再描画
                markingContext.clearRect(0, 0, markingCanvas.width, markingCanvas.height);
                markingContext.drawImage(markingImage, 0, 0);
            }
        });
        
        // マーカーサイズの変更
        document.getElementById('markerSize').addEventListener('input', function() {
            markerSize = parseInt(this.value);
            document.getElementById('markerSizeValue').textContent = markerSize;
        });
        
        // マーカー不透明度の変更
        document.getElementById('markerOpacity').addEventListener('input', function() {
            markerOpacity = parseFloat(this.value);
            document.getElementById('markerOpacityValue').textContent = markerOpacity;
        });
        
        // 保存ボタン
        document.getElementById('saveMarkedImage').addEventListener('click', function() {
            saveMarkedImage();
        });
        
        // データセットに保存ボタン
        document.getElementById('saveMarkedMale').addEventListener('click', function() {
            saveMarkedImageToDataset('male');
        });
        
        document.getElementById('saveMarkedFemale').addEventListener('click', function() {
            saveMarkedImageToDataset('female');
        });
    }
});

// 状態チェックの開始
function startStatusCheck() {
    // 既存のタイマーをクリア
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 新しいタイマーの設定
    statusCheckInterval = setInterval(checkTaskStatus, 1000);
}

// タスク状態のチェック
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
        }
    })
    .catch(error => {
        console.error('状態チェックエラー:', error);
    });
}

// タスク状態の更新
function updateTaskStatus(data) {
    const statusElement = document.getElementById('processingStatus');
    const progressElement = document.getElementById('progressBar');
    
    if (!statusElement || !progressElement) return;
    
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
    
    // トレーニング結果の表示
    if (data.status === 'completed' && data.accuracy !== undefined) {
        showTrainingResult(data);
    }
}

// 抽出画像の読み込み
function loadExtractedImages() {
    if (!currentTaskId) return;
    
    fetch('/video/extracted-images/' + currentTaskId)
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('画像読み込みエラー:', data.error);
            return;
        }
        
        extractedImages = data.images || [];
        currentImageIndex = 0;
        
        // 画像の表示
        displayExtractedImages();
    })
    .catch(error => {
        console.error('画像読み込みエラー:', error);
    });
}

// 抽出画像の表示
function displayExtractedImages() {
    const container = document.getElementById('extractedImagesContainer');
    const counterElement = document.getElementById('currentImage');
    
    if (!container || !counterElement) return;
    
    // コンテナのクリア
    container.innerHTML = '';
    
    if (extractedImages.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5 w-100">
                <i class="fas fa-photo-video fa-3x mb-3"></i>
                <p>抽出された画像がありません</p>
            </div>
        `;
        counterElement.textContent = '0/0';
        return;
    }
    
    // 画像カードの作成
    extractedImages.forEach((imageUrl, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="抽出画像 ${index + 1}" class="image-preview">
            <div class="image-controls">
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary view-btn" data-index="${index}">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success mark-btn" data-index="${index}">
                        <i class="fas fa-pen"></i> マーク
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-index="${index}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="btn-group mt-1" role="group">
                    <button class="btn btn-sm btn-outline-primary save-male-btn" data-index="${index}">
                        <i class="fas fa-mars"></i> オス
                    </button>
                    <button class="btn btn-sm btn-outline-danger save-female-btn" data-index="${index}">
                        <i class="fas fa-venus"></i> メス
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // カウンター更新
    counterElement.textContent = `${extractedImages.length} 枚の画像`;
    
    // イベントリスナーの設定
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openImageModal(index);
        });
    });
    
    document.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openMarkingModal(extractedImages[index]);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            deleteImage(extractedImages[index], () => {
                // 削除完了後に画像リストを更新
                loadExtractedImages();
            });
        });
    });
    
    document.querySelectorAll('.save-male-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('male', extractedImages[index]);
        });
    });
    
    document.querySelectorAll('.save-female-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('female', extractedImages[index]);
        });
    });
    
    // 画像プレビュークリックでもモーダルを開く
    document.querySelectorAll('.image-preview').forEach((img, index) => {
        img.addEventListener('click', function() {
            openImageModal(index);
        });
    });
}

// 画像モーダルを開く
function openImageModal(index) {
    const imageUrl = extractedImages[index];
    const modalImage = document.getElementById('modalImage');
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    
    // 画像の設定
    modalImage.src = imageUrl;
    modalImage.dataset.index = index;
    
    // モーダルを表示
    modal.show();
}

// データセットに画像を保存
function saveImageToDataset(gender, imagePath) {
    // imagePath が未指定の場合はモーダルから取得
    if (!imagePath) {
        const modalImage = document.getElementById('modalImage');
        imagePath = modalImage.src;
    }
    
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/image/save-to-dataset', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_path: imagePath,
            gender: gender
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージ
        alert(data.message);
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageModal'));
        if (modal) {
            modal.hide();
        }
        
        // データセット情報の更新
        loadDatasetInfo();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// データセット情報の読み込み
function loadDatasetInfo() {
    fetch('/dataset-info')
    .then(response => response.json())
    .then(data => {
        // 情報の表示
        if (document.getElementById('maleCount')) {
            document.getElementById('maleCount').textContent = data.male_count;
        }
        if (document.getElementById('femaleCount')) {
            document.getElementById('femaleCount').textContent = data.female_count;
        }
        if (document.getElementById('totalCount')) {
            document.getElementById('totalCount').textContent = data.total_count;
        }
        
        // 割合の計算と表示
        if (document.getElementById('datasetMaleBar') && document.getElementById('datasetFemaleBar')) {
            const total = data.total_count || 1;  // ゼロ除算を避ける
            const malePercent = (data.male_count / total) * 100;
            const femalePercent = (data.female_count / total) * 100;
            
            document.getElementById('datasetMaleBar').style.width = malePercent + '%';
            document.getElementById('datasetFemaleBar').style.width = femalePercent + '%';
        }
    })
    .catch(error => {
        console.error('データセット情報の読み込みエラー:', error);
    });
}

// モデル訓練の開始
function startModelTraining() {
    // ローディング表示
    showLoading();
    
    // リクエスト送信
    fetch('/train-model', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // タスクIDの保存
        currentTaskId = data.task_id;
        // タスクIDをローカルストレージに保存
        saveTaskId(currentTaskId);
        
        // 状態表示の初期化
        document.getElementById('trainingStatus').classList.remove('d-none');
        document.getElementById('trainingStatus').textContent = '訓練を開始しました...';
        document.getElementById('trainingProgressContainer').classList.remove('d-none');
        document.getElementById('trainingProgressBar').style.width = '0%';
        
        // 状態チェックの開始
        startStatusCheck();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// 訓練結果の表示
function showTrainingResult(data) {
    // プレースホルダーを非表示
    if (document.getElementById('modelPlaceholder')) {
        document.getElementById('modelPlaceholder').classList.add('d-none');
    }
    
    // 結果を表示
    if (document.getElementById('modelInfo')) {
        document.getElementById('modelInfo').classList.remove('d-none');
    }
    
    // 精度
    if (document.getElementById('accuracyValue')) {
        document.getElementById('accuracyValue').textContent = (data.accuracy * 100).toFixed(1) + '%';
    }
    
    // 訓練情報
    if (document.getElementById('trainSamples')) {
        document.getElementById('trainSamples').textContent = data.train_samples || '-';
    }
    if (document.getElementById('modelMaleImages')) {
        document.getElementById('modelMaleImages').textContent = data.male_images || '-';
    }
    if (document.getElementById('modelFemaleImages')) {
        document.getElementById('modelFemaleImages').textContent = data.female_images || '-';
    }
    
    // 特徴重要度
    if (data.feature_importance && document.getElementById('modelFeatureImportance')) {
        const importanceContainer = document.getElementById('modelFeatureImportance');
        importanceContainer.innerHTML = '';
        
        // 特徴量を重要度順にソート
        const sortedFeatures = Object.entries(data.feature_importance)
            .sort((a, b) => b[1] - a[1]);
        
        // 特徴バーの作成
        sortedFeatures.forEach(([feature, importance]) => {
            const percent = (importance * 100).toFixed(1);
            const bar = document.createElement('div');
            bar.className = 'mb-3';
            
            bar.innerHTML = `
                <div class="d-flex justify-content-between mb-1">
                    <span>${feature}</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
                </div>
            `;
            
            importanceContainer.appendChild(bar);
        });
    }
}

// 判別結果の表示
function showClassifyResult(data) {
    // プレースホルダーを非表示
    if (document.getElementById('classifyPlaceholder')) {
        document.getElementById('classifyPlaceholder').classList.add('d-none');
    }
    
    // 結果を表示
    if (document.getElementById('classifyResult')) {
        document.getElementById('classifyResult').classList.remove('d-none');
    }
    
    // 画像
    if (data.marked_image_url && document.getElementById('resultImage')) {
        document.getElementById('resultImage').src = data.marked_image_url;
    }
    
    // 性別結果
    if (document.getElementById('genderResult')) {
        const genderResult = document.getElementById('genderResult');
        const gender = data.gender === 'male' ? 'オス' : 'メス';
        const confidence = (data.confidence * 100).toFixed(1);
        
        genderResult.textContent = `判別結果: ${gender} (信頼度: ${confidence}%)`;
        genderResult.className = 'alert';
        genderResult.classList.add(data.gender === 'male' ? 'alert-primary' : 'alert-danger');
    }
    
    // 特徴重要度
    if (data.feature_importance && document.getElementById('featureImportance')) {
        const importanceContainer = document.getElementById('featureImportance');
        importanceContainer.innerHTML = '';
        
        // 特徴量を重要度順にソート
        const sortedFeatures = Object.entries(data.feature_importance)
            .sort((a, b) => b[1] - a[1]);
        
        // 特徴バーの作成
        sortedFeatures.forEach(([feature, importance]) => {
            const percent = (importance * 100).toFixed(1);
            const bar = document.createElement('div');
            bar.className = 'mb-3';
            
            bar.innerHTML = `
                <div class="d-flex justify-content-between mb-1">
                    <span>${feature}</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress feature-bar">
                    <div class="progress-bar" role="progressbar" style="width: ${percent}%"></div>
                </div>
            `;
            
            importanceContainer.appendChild(bar);
        });
    }
}

// タスク履歴の読み込み
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

// 履歴画像の読み込み
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

// 履歴画像の表示
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
    document.querySelectorAll('.history-view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openHistoryImageModal(images[index]);
        });
    });
    
    document.querySelectorAll('.history-mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openMarkingModal(images[index]);
        });
    });

    document.querySelectorAll('.history-delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            deleteImage(images[index], () => {
                // 削除完了後に画像リストを更新
                loadHistoryImages(taskId);
            });
        });
    });
    
    document.querySelectorAll('.history-male-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('male', images[index]);
        });
    });
    
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

// 履歴画像モーダルを開く
function openHistoryImageModal(imageUrl) {
    const modalImage = document.getElementById('modalImage');
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    
    // 画像の設定
    modalImage.src = imageUrl;
    
    // モーダルを表示
    modal.show();
}

// 画像の削除
function deleteImage(imagePath, callback) {
    if (!confirm('この画像を削除してもよろしいですか？')) {
        return;
    }
    
    // ローディング表示
    showLoading();
    
    fetch('/image/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_path: imagePath
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージ
        alert(data.message);
        
        // コールバック実行
        if (typeof callback === 'function') {
            callback();
        }
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// マーキングモーダルを開く
function openMarkingModal(imageUrl) {
    // モーダルの取得
    const markingModalElement = document.getElementById('markingModal');
    if (!markingModalElement) {
        alert('マーキング機能がロードされていません。ページを再読み込みしてください。');
        return;
    }
    
    const modal = new bootstrap.Modal(markingModalElement);
    originalImagePath = imageUrl;
    
    // キャンバスの取得
    markingCanvas = document.getElementById('markingCanvas');
    markingContext = markingCanvas.getContext('2d');
    
    // 画像の読み込み
    markingImage = new Image();
    markingImage.crossOrigin = 'anonymous';  // CORS対策
    markingImage.onload = function() {
        // キャンバスのサイズを画像に合わせる
        markingCanvas.width = markingImage.width;
        markingCanvas.height = markingImage.height;
        
        // 画像を描画
        markingContext.drawImage(markingImage, 0, 0);
        
        // モーダルを表示
        modal.show();
    };
    markingImage.onerror = function() {
        alert('画像の読み込みに失敗しました。');
    };
    markingImage.src = imageUrl;
    
    // キャンバスの描画イベント
    markingCanvas.addEventListener('mousedown', startDrawing);
    markingCanvas.addEventListener('mousemove', draw);
    markingCanvas.addEventListener('mouseup', stopDrawing);
    markingCanvas.addEventListener('mouseout', stopDrawing);
    
    // タッチデバイス対応
    markingCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        markingCanvas.dispatchEvent(mouseEvent);
    });
    
    markingCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        markingCanvas.dispatchEvent(mouseEvent);
    });
    
    markingCanvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup');
        markingCanvas.dispatchEvent(mouseEvent);
    });
    
    // ツールボタンの状態を更新
    updateToolButtons();
}

// ツールボタンの状態を更新
function updateToolButtons() {
    const markerTool = document.getElementById('markerTool');
    const eraserTool = document.getElementById('eraserTool');
    
    if (!markerTool || !eraserTool) return;
    
    markerTool.classList.remove('active');
    eraserTool.classList.remove('active');
    
    if (currentTool === 'marker') {
        markerTool.classList.add('active');
    } else {
        eraserTool.classList.add('active');
    }
}

// 描画開始
function startDrawing(e) {
    isDrawing = true;
    
    // キャンバス上の座標を取得
    const rect = markingCanvas.getBoundingClientRect();
    const scaleX = markingCanvas.width / rect.width;
    const scaleY = markingCanvas.height / rect.height;
    
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
}

// 描画中
function draw(e) {
    if (!isDrawing) return;
    
    // キャンバス上の座標を取得
    const rect = markingCanvas.getBoundingClientRect();
    const scaleX = markingCanvas.width / rect.width;
    const scaleY = markingCanvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // 描画設定
    markingContext.lineJoin = 'round';
    markingContext.lineCap = 'round';
    markingContext.lineWidth = markerSize;
    
    if (currentTool === 'marker') {
        // マーカーモード
        markingContext.globalCompositeOperation = 'source-over';
        markingContext.strokeStyle = `rgba(255, 0, 0, ${markerOpacity})`;
    } else {
        // 消しゴムモード
        markingContext.globalCompositeOperation = 'destination-out';
        markingContext.strokeStyle = 'rgba(255, 255, 255, 1)';
    }
    
    // 線を描画
    markingContext.beginPath();
    markingContext.moveTo(lastX, lastY);
    markingContext.lineTo(x, y);
    markingContext.stroke();
    
    lastX = x;
    lastY = y;
}

// 描画終了
function stopDrawing() {
    isDrawing = false;
}

// マーキング画像の保存
function saveMarkedImage() {
    if (!markingCanvas) {
        alert('マーキングキャンバスが初期化されていません。');
        return;
    }
    
    // キャンバスを画像データに変換
    const imageData = markingCanvas.toDataURL('image/jpeg');
    
    // ローディング表示
    showLoading();
    
    // サーバーに送信
    fetch('/image/save-marked-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_data: imageData,
            original_image_path: originalImagePath
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージ
        alert(data.message);
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('markingModal'));
        if (modal) {
            modal.hide();
        }
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// マーキング画像をデータセットに保存
function saveMarkedImageToDataset(gender) {
    if (!markingCanvas) {
        alert('マーキングキャンバスが初期化されていません。');
        return;
    }
    
    // キャンバスを画像データに変換
    const imageData = markingCanvas.toDataURL('image/jpeg');
    
    // ローディング表示
    showLoading();
    
    // まずサーバーに画像を保存
    fetch('/image/save-marked-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image_data: imageData,
            original_image_path: originalImagePath
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            hideLoading();
            alert('エラー: ' + data.error);
            return;
        }
        
        // 保存された画像をデータセットに追加
        return fetch('/image/save-to-dataset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_path: data.image_path,
                gender: gender
            })
        });
    })
    .then(response => {
        if (!response) return null;
        return response.json();
    })
    .then(data => {
        hideLoading();
        
        if (data && data.error) {
            alert('エラー: ' + data.error);
            return;
        }
        
        // 成功メッセージ
        if (data) {
            alert(data.message);
        }
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('markingModal'));
        if (modal) {
            modal.hide();
        }
        
        // データセット情報の更新
        loadDatasetInfo();
    })
    .catch(error => {
        hideLoading();
        alert('エラー: ' + error);
    });
}

// ローディング表示
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('d-none');
    }
}

// ローディング非表示
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}