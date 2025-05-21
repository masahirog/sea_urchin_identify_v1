/**
 * ウニ生殖乳頭分析システム - 画像マーキングモジュール
 * 画像のマーキング処理に関する機能
 */

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

/**
 * マーキングツールの初期化
 */
function initMarkingTools() {
    // マーキングモーダルが存在する場合のみ初期化
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
}

/**
 * マーキングモーダルを開く
 */
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

/**
 * ツールボタンの状態を更新
 */
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

/**
 * 描画開始
 */
function startDrawing(e) {
    isDrawing = true;
    
    // キャンバス上の座標を取得
    const rect = markingCanvas.getBoundingClientRect();
    const scaleX = markingCanvas.width / rect.width;
    const scaleY = markingCanvas.height / rect.height;
    
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
}

/**
 * 描画中
 */
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

/**
 * 描画終了
 */
function stopDrawing() {
    isDrawing = false;
}

/**
 * マーキング画像の保存
 */
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

/**
 * マーキング画像をデータセットに保存
 */
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

// モジュールとしてエクスポート（必要に応じて）
// export { initMarkingTools, openMarkingModal, saveMarkedImage, saveMarkedImageToDataset };