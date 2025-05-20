// 現在のタスクID
let currentTaskId = null;
let extractedImages = [];
let currentImageIndex = 0;
let statusCheckInterval = null;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', function() {
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
        fetch('/upload-video', {
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
        fetch('/upload-image', {
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
    fetch('/extracted-images/' + currentTaskId)
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
                <button class="btn btn-sm btn-outline-primary view-btn" data-index="${index}">
                    <i class="fas fa-search"></i>
                </button>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary save-male-btn" data-index="${index}">
                        <i class="fas fa-mars"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger save-female-btn" data-index="${index}">
                        <i class="fas fa-venus"></i>
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
    fetch('/save-to-dataset', {
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
        document.getElementById('maleCount').textContent = data.male_count;
        document.getElementById('femaleCount').textContent = data.female_count;
        document.getElementById('totalCount').textContent = data.total_count;
        
        // 割合の計算と表示
        const total = data.total_count || 1;  // ゼロ除算を避ける
        const malePercent = (data.male_count / total) * 100;
        const femalePercent = (data.female_count / total) * 100;
        
        document.getElementById('datasetMaleBar').style.width = malePercent + '%';
        document.getElementById('datasetFemaleBar').style.width = femalePercent + '%';
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
    document.getElementById('modelPlaceholder').classList.add('d-none');
    
    // 結果を表示
    document.getElementById('modelInfo').classList.remove('d-none');
    
    // 精度
    document.getElementById('accuracyValue').textContent = (data.accuracy * 100).toFixed(1) + '%';
    
    // 訓練情報
    document.getElementById('trainSamples').textContent = data.train_samples || '-';
    document.getElementById('modelMaleImages').textContent = data.male_images || '-';
    document.getElementById('modelFemaleImages').textContent = data.female_images || '-';
    
    // 特徴重要度
    if (data.feature_importance) {
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
    document.getElementById('classifyPlaceholder').classList.add('d-none');
    
    // 結果を表示
    document.getElementById('classifyResult').classList.remove('d-none');
    
    // 画像
    if (data.marked_image_url) {
        document.getElementById('resultImage').src = data.marked_image_url;
    }
    
    // 性別結果
    const genderResult = document.getElementById('genderResult');
    const gender = data.gender === 'male' ? 'オス' : 'メス';
    const confidence = (data.confidence * 100).toFixed(1);
    
    genderResult.textContent = `判別結果: ${gender} (信頼度: ${confidence}%)`;
    genderResult.className = 'alert';
    genderResult.classList.add(data.gender === 'male' ? 'alert-primary' : 'alert-danger');
    
    // 特徴重要度
    if (data.feature_importance) {
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

// ローディング表示
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('d-none');
}

// ローディング非表示
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
}