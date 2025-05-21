/**
 * ウニ生殖乳頭分析システム - アノテーションツール
 * 画像アノテーション機能を提供するスクリプト
 */

// アノテーションモーダルを開く関数
function openAnnotationModal(paramImagePath) {
    // 現在選択されている画像のパスを取得
    const selectedCard = document.querySelector('.sample-card.selected-sample');
    if (!selectedCard) {
        alert('先にサンプル画像を選択してください');
        return;
    }
    
    const imagePath = 'samples/' + selectedCard.dataset.path;
    
    // モーダルを作成
    const modalHTML = `
    <div class="modal fade" id="annotationModal" tabindex="-1" aria-labelledby="annotationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="annotationModalLabel">生殖乳頭アノテーション</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info mb-3">
                        <i class="fas fa-info-circle me-2"></i>
                        生殖乳頭の周囲を赤いペンで囲んでください。複数の乳頭がある場合は、それぞれを個別に囲みます。
                    </div>
                    <div class="text-center mb-3">
                        <canvas id="annotationCanvas" style="max-width: 100%; border: 1px solid #ddd;"></canvas>
                    </div>
                    <div class="d-flex justify-content-center mb-3">
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-outline-primary" id="penTool">
                                <i class="fas fa-pen"></i> ペン
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="eraserTool">
                                <i class="fas fa-eraser"></i> 消しゴム
                            </button>
                            <button type="button" class="btn btn-outline-success" id="circleTool">
                                <i class="fas fa-circle"></i> 円形
                            </button>
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label for="toolSize" class="form-label">ツールサイズ: <span id="toolSizeValue">5</span>px</label>
                        <input type="range" class="form-range" id="toolSize" min="1" max="20" value="5">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-primary" id="saveAnnotation">
                        <i class="fas fa-save me-1"></i> 学習データとして保存
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // モーダルをDOMに追加
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Bootstrapモーダルを初期化
    const annotationModal = new bootstrap.Modal(document.getElementById('annotationModal'));
    annotationModal.show();
    
    // キャンバスの設定
    const canvas = document.getElementById('annotationCanvas');
    const ctx = canvas.getContext('2d');
    
    // 画像の読み込み
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        // キャンバスのサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 画像を描画
        ctx.drawImage(img, 0, 0);
        
        // アノテーションツールの初期化
        initAnnotationTools(canvas, ctx, img);
    };
    img.src = '/sample/' + selectedCard.dataset.path;
    
    // モーダルが閉じられたときの処理
    document.getElementById('annotationModal').addEventListener('hidden.bs.modal', function () {
        document.getElementById('annotationModal').remove();
    });
}

// アノテーションツールの初期化
function initAnnotationTools(canvas, ctx, img) {
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pen';
    let toolSize = 5;
    
    // ツール選択
    document.getElementById('penTool').addEventListener('click', function() {
        currentTool = 'pen';
        updateToolButtons();
    });
    
    document.getElementById('eraserTool').addEventListener('click', function() {
        currentTool = 'eraser';
        updateToolButtons();
    });
    
    document.getElementById('circleTool').addEventListener('click', function() {
        currentTool = 'circle';
        updateToolButtons();
    });
    
    // ツールサイズの変更
    document.getElementById('toolSize').addEventListener('input', function() {
        toolSize = parseInt(this.value);
        document.getElementById('toolSizeValue').textContent = toolSize;
    });
    
    // ツールボタンの更新
    function updateToolButtons() {
        document.getElementById('penTool').classList.remove('active');
        document.getElementById('eraserTool').classList.remove('active');
        document.getElementById('circleTool').classList.remove('active');
        
        if (currentTool === 'pen') {
            document.getElementById('penTool').classList.add('active');
        } else if (currentTool === 'eraser') {
            document.getElementById('eraserTool').classList.add('active');
        } else if (currentTool === 'circle') {
            document.getElementById('circleTool').classList.add('active');
        }
    }
    
    // 描画開始
    canvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        lastX = (e.clientX - rect.left) * scaleX;
        lastY = (e.clientY - rect.top) * scaleY;
        
        if (currentTool === 'circle') {
            // 円ツールの場合は一時的な円を描画
            ctx.beginPath();
            ctx.arc(lastX, lastY, toolSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
        }
    });
    
    // 描画中
    canvas.addEventListener('mousemove', function(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = toolSize;
        
        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        
        lastX = x;
        lastY = y;
    });
    
    // 描画終了
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    function stopDrawing() {
        isDrawing = false;
        // 元の描画モードに戻す
        ctx.globalCompositeOperation = 'source-over';
    }
    
    // アノテーションの保存
    document.getElementById('saveAnnotation').addEventListener('click', function() {
        try {
            showLoading(); // ローディング表示を追加
            console.log('アノテーション保存開始');

            // キャンバスのデータをBase64形式で取得
            const annotationData = canvas.toDataURL('image/png');
            console.log('Base64データサイズ:', (annotationData.length / 1024).toFixed(2), 'KB');

            const selectedCard = document.querySelector('.sample-card.selected-sample');
            console.log('選択カード:', selectedCard.dataset.path);

            // 画像データをサーバーに送信
            fetch('/sample/save-annotation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image_data: annotationData,
                    // フルパスを相対パスに変換して一致するようにする
                    original_path: selectedCard.dataset.path
                })
            })
            .then(response => {
                console.log('サーバーレスポンスステータス:', response.status);
                if (!response.ok) {
                    throw new Error('サーバーレスポンスが不正です');
                }
                return response.json();
            })
            .then(data => {
                hideLoading(); // ローディング表示を非表示
                console.log('アノテーション保存レスポンス:', data);
                
                if (data.error) {
                    console.error('保存エラー:', data.error);
                    alert('エラー: ' + data.error);
                } else {
                    alert('アノテーションを保存しました');
                    saveToSession('annotationSaved', true);
                    console.log('保存成功フラグ設定');
                    // モーダルを閉じる
                    bootstrap.Modal.getInstance(document.getElementById('annotationModal')).hide();
                    analyzeSample(selectedCard.dataset.path);


                    
                    // // 少し待ってからリロード（サーバー処理の完了を待つ）
                    // console.log('1秒待機開始...');
                    // setTimeout(() => {
                    //     // 画像パスを保持してリロード
                    //     const currentPath = selectedCard.dataset.path;
                    //     saveToSession('lastSelectedSample', currentPath);
                    //     console.log('リロード実行');
                    //     location.reload();
                    // }, 500);
                }
            })
            .catch(error => {
                hideLoading();
                console.error('保存エラー:', error);
                alert('保存中にエラーが発生しました: ' + error);
            });
        } catch (e) {
            hideLoading();
            console.error('アノテーション処理エラー:', e);
            alert('アノテーションの保存中にエラーが発生しました: ' + e);
        }
    });
    
    // 初期状態のボタン更新
    updateToolButtons();
}

// タッチデバイス用の拡張（オプション）
function enableTouchSupport(canvas) {
    // タッチイベントをマウスイベントに変換
    function touchToMouse(touchEvent, mouseEventType) {
        touchEvent.preventDefault();
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        const mouseEvent = new MouseEvent(mouseEventType, {
            clientX: touch.clientX,
            clientY: touch.clientY,
            buttons: 1
        });
        canvas.dispatchEvent(mouseEvent);
    }
    
    canvas.addEventListener('touchstart', e => touchToMouse(e, 'mousedown'), false);
    canvas.addEventListener('touchmove', e => touchToMouse(e, 'mousemove'), false);
    canvas.addEventListener('touchend', e => touchToMouse(e, 'mouseup'), false);
    canvas.addEventListener('touchcancel', e => touchToMouse(e, 'mouseout'), false);
}