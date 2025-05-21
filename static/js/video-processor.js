/**
 * ウニ生殖乳頭分析システム - 動画処理モジュール
 * 動画アップロードと処理、抽出画像の表示に関する機能
 */

// 動画処理関連の変数
let extractedImages = [];
let currentImageIndex = 0;
let statusCheckInterval = null;

/**
 * 動画処理モジュールの初期化
 */
function initVideoProcessor() {
    // 動画処理フォームの送信イベント設定
    const videoForm = document.getElementById('videoForm');
    if (videoForm) {
        videoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            processVideo();
        });
    }
}

/**
 * 動画を処理する
 */
function processVideo() {
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
}

/**
 * 抽出画像の読み込み
 */
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

/**
 * 抽出画像の表示
 */
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
    attachImageEventListeners();
}

/**
 * 画像のイベントリスナーをアタッチする
 */
function attachImageEventListeners() {
    // 表示ボタン
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openImageModal(index);
        });
    });
    
    // マークボタン
    document.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            openMarkingModal(extractedImages[index]);
        });
    });
    
    // 削除ボタン
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            deleteImage(extractedImages[index], () => {
                // 削除完了後に画像リストを更新
                loadExtractedImages();
            });
        });
    });
    
    // オス保存ボタン
    document.querySelectorAll('.save-male-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            saveImageToDataset('male', extractedImages[index]);
        });
    });
    
    // メス保存ボタン
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

/**
 * 画像詳細モーダルを開く
 */
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

/**
 * 画像を削除する
 */
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

// モジュールとしてエクスポート（必要に応じて）
// export { initVideoProcessor, loadExtractedImages, displayExtractedImages };