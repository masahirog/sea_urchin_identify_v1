/**
 * ウニ生殖乳頭分析システム - アノテーションツール
 * 画像アノテーションのための機能を提供
 */

// モジュール内のデータを保持するための変数
const annotationTools = {
    selectedCard: null,
    canvas: null,
    context: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentTool: 'pen',
    toolSize: 5,
};

/**
 * 学習データ画像をクリックした時の処理
 * @param {string} imagePath - 画像パス
 */
export function selectImageForAnnotation(imagePath) {
    console.log('画像詳細表示:', imagePath);
    
    if (!imagePath) {
        alert('画像が指定されていません');
        return;
    }
    
    // 画像詳細モーダルを表示
    openImageDetailModal(imagePath);
}

/**
 * 画像詳細モーダルを開く
 * @param {string} imagePath - 画像パス
 */
export function openImageDetailModal(imagePath) {
    console.log('画像詳細モーダル表示:', imagePath);
    
    // 既存のアノテーション情報を確認
    checkExistingAnnotation(imagePath)
        .then(annotationInfo => {
            createImageDetailModal(imagePath, annotationInfo);
        })
        .catch(error => {
            console.error('アノテーション情報取得エラー:', error);
            createImageDetailModal(imagePath, null);
        });
}

/**
 * 既存のアノテーション情報を確認
 * @param {string} imagePath - 画像パス
 * @returns {Promise} アノテーション情報
 */
async function checkExistingAnnotation(imagePath) {
    try {
        // アノテーションマッピングから確認
        const response = await fetch('/static/annotation_mapping.json');
        if (!response.ok) {
            return null;
        }
        
        const mapping = await response.json();
        const annotationPath = mapping[imagePath];
        
        if (annotationPath) {
            return {
                exists: true,
                path: annotationPath,
                url: `/static/${annotationPath}`
            };
        }
        
        return { exists: false };
        
    } catch (error) {
        console.error('アノテーション確認エラー:', error);
        return null;
    }
}

/**
 * 画像詳細モーダルを作成
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
function createImageDetailModal(imagePath, annotationInfo) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('imageDetailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const hasAnnotation = annotationInfo && annotationInfo.exists;
    const displayImageUrl = hasAnnotation ? annotationInfo.url : `/sample/${imagePath}`;
    const filename = imagePath.split('/').pop();
    
    const modalHTML = `
    <div class="modal fade" id="imageDetailModal" tabindex="-1" aria-labelledby="imageDetailModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="imageDetailModalLabel">
                        <i class="fas fa-image me-2"></i>
                        ${filename}
                        ${hasAnnotation ? '<span class="badge bg-success ms-2">アノテーション済み</span>' : '<span class="badge bg-secondary ms-2">未アノテーション</span>'}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
                </div>
                <div class="modal-body">
                    <div class="text-center mb-3">
                        <img id="modalDetailImage" src="${displayImageUrl}" alt="${filename}" 
                             style="max-width: 100%; max-height: 60vh;" class="img-fluid rounded">
                    </div>
                    <div id="modalImageInfo">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>ファイル情報</h6>
                                <p><strong>ファイル名:</strong> ${filename}</p>
                                <p><strong>カテゴリ:</strong> ${imagePath.includes('/male/') ? 'オス' : imagePath.includes('/female/') ? 'メス' : '不明'}</p>
                                <p><strong>パス:</strong> <code>${imagePath}</code></p>
                            </div>
                            <div class="col-md-6">
                                <h6>アノテーション状況</h6>
                                ${hasAnnotation ? `
                                    <p class="text-success"><i class="fas fa-check-circle me-1"></i> アノテーション済み</p>
                                    <p><strong>アノテーション画像:</strong><br><code>${annotationInfo.path}</code></p>
                                ` : `
                                    <p class="text-muted"><i class="fas fa-circle me-1"></i> 未アノテーション</p>
                                    <p class="small">アノテーションを追加すると学習精度が向上します</p>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="btn-group me-auto" role="group">
                        ${hasAnnotation ? `
                            <button type="button" class="btn btn-outline-warning" id="editAnnotationBtn">
                                <i class="fas fa-edit me-1"></i> アノテーション編集
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="deleteAnnotationBtn">
                                <i class="fas fa-trash me-1"></i> アノテーション削除
                            </button>
                        ` : `
                            <button type="button" class="btn btn-success" id="createAnnotationBtn">
                                <i class="fas fa-plus me-1"></i> アノテーション作成
                            </button>
                        `}
                    </div>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-outline-secondary" id="moveToDatasetBtn">
                            <i class="fas fa-copy me-1"></i> データセットに移動
                        </button>
                        <button type="button" class="btn btn-outline-danger" id="deleteImageBtn">
                            <i class="fas fa-trash me-1"></i> 画像削除
                        </button>
                    </div>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // イベントリスナーの設定
    setupImageDetailModalEvents(imagePath, annotationInfo);
    
    // モーダルを表示
    const modal = new bootstrap.Modal(document.getElementById('imageDetailModal'));
    
    // モーダルが閉じられたときのクリーンアップ
    document.getElementById('imageDetailModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
    
    modal.show();
}

/**
 * 画像詳細モーダルのイベントリスナー設定
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
function setupImageDetailModalEvents(imagePath, annotationInfo) {
    const hasAnnotation = annotationInfo && annotationInfo.exists;
    
    // アノテーション作成ボタン
    const createBtn = document.getElementById('createAnnotationBtn');
    if (createBtn) {
        createBtn.addEventListener('click', function() {
            // 現在のモーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            // アノテーション作成モーダルを開く
            setTimeout(() => openAnnotationModal(imagePath), 300);
        });
    }
    
    // アノテーション編集ボタン
    const editBtn = document.getElementById('editAnnotationBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            // 現在のモーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            // アノテーション編集モーダルを開く
            setTimeout(() => openAnnotationEditModal(imagePath, annotationInfo), 300);
        });
    }
    
    // アノテーション削除ボタン
    const deleteAnnotationBtn = document.getElementById('deleteAnnotationBtn');
    if (deleteAnnotationBtn) {
        deleteAnnotationBtn.addEventListener('click', function() {
            deleteAnnotation(imagePath, annotationInfo);
        });
    }
    
    // データセット移動ボタン
    const moveBtn = document.getElementById('moveToDatasetBtn');
    if (moveBtn) {
        moveBtn.addEventListener('click', function() {
            moveImageToDataset(imagePath);
        });
    }
    
    // 画像削除ボタン
    const deleteImageBtn = document.getElementById('deleteImageBtn');
    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', function() {
            deleteImage(imagePath);
        });
    }
}

/**
 * アノテーション編集モーダルを開く
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
export function openAnnotationEditModal(imagePath, annotationInfo) {
    console.log('アノテーション編集モーダル表示:', imagePath);
    
    // アノテーション作成と同じモーダルを使用するが、既存のアノテーションを読み込む
    openAnnotationModal(imagePath, true, annotationInfo);
}

/**
 * アノテーション削除
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
async function deleteAnnotation(imagePath, annotationInfo) {
    if (!confirm('このアノテーションを削除してもよろしいですか？')) {
        return;
    }
    
    try {
        const response = await fetch('/learning/delete-annotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                image_path: imagePath,
                annotation_path: annotationInfo.path 
            })
        });
        
        if (!response.ok) throw new Error('削除リクエストに失敗しました');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // 成功メッセージ
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showSuccessMessage('アノテーションを削除しました');
        } else {
            alert('アノテーションを削除しました');
        }
        
        // モーダルを閉じる
        bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
        
        // データを更新
        if (typeof window.onAnnotationSaved === 'function') {
            window.onAnnotationSaved();
        }
        
    } catch (error) {
        console.error('アノテーション削除エラー:', error);
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showError('アノテーション削除に失敗しました: ' + error.message);
        } else {
            alert('アノテーション削除に失敗しました: ' + error.message);
        }
    }
}

/**
 * データセットへの移動
 * @param {string} imagePath - 画像パス
 */
function moveImageToDataset(imagePath) {
    // データセット移動の実装
    console.log('データセット移動:', imagePath);
    
    // 性別選択ダイアログを表示
    const gender = prompt('移動先を選択してください:\n1: オス (male)\n2: メス (female)\n\n番号を入力してください:');
    
    let targetGender;
    if (gender === '1') targetGender = 'male';
    else if (gender === '2') targetGender = 'female';
    else {
        alert('キャンセルされました');
        return;
    }
    
    // 移動処理の実装（実際のAPIコールが必要）
    console.log(`${imagePath} を ${targetGender} カテゴリに移動`);
    if (window.unifiedLearningSystem) {
        window.unifiedLearningSystem.showSuccessMessage(`画像を${targetGender}カテゴリに移動しました`);
    } else {
        alert(`画像を${targetGender}カテゴリに移動しました`);
    }
}

/**
 * クイック削除確認ダイアログ
 * @param {string} imagePath - 削除する画像のパス
 */
export function showQuickDeleteConfirm(imagePath) {
    const filename = imagePath.split('/').pop();
    
    if (confirm(`「${filename}」を削除してもよろしいですか？\n\nアノテーションがある場合は一緒に削除されます。`)) {
        deleteImage(imagePath);
    }
}

/**
 * 画像削除処理
 * @param {string} imagePath - 削除する画像のパス
 */
export async function deleteImage(imagePath) {
    try {
        showLoading();
        
        const response = await fetch('/learning/delete-data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({path: imagePath})
        });
        
        if (!response.ok) throw new Error('削除に失敗しました');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        hideLoading();
        
        // 成功メッセージ表示
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showSuccessMessage(data.message);
            
            // データ更新
            await window.unifiedLearningSystem.refreshDatasetStats();
            await window.unifiedLearningSystem.loadLearningData();
        } else {
            alert(data.message);
            // フォールバック: ページリロード
            window.location.reload();
        }
        
        // モーダルが開いている場合は閉じる
        const modal = document.getElementById('imageDetailModal');
        if (modal) {
            bootstrap.Modal.getInstance(modal).hide();
        }
        
    } catch (error) {
        hideLoading();
        console.error('削除エラー:', error);
        
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.showError('削除中にエラーが発生しました: ' + error.message);
        } else {
            alert('削除中にエラーが発生しました: ' + error.message);
        }
    }
}

/**
 * アノテーションモーダルを開く
 * @param {string} paramImagePath - 画像パス
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
export function openAnnotationModal(paramImagePath, isEdit = false, existingAnnotation = null) {
    console.log('アノテーションモーダルを開く:', paramImagePath, isEdit ? '(編集モード)' : '(新規作成)');
    
    if (!paramImagePath) {
        alert('画像が指定されていません');
        return;
    }
    
    // 擬似カードオブジェクトを作成
    annotationTools.selectedCard = {
        dataset: {
            path: paramImagePath
        }
    };
    
    // モーダルを作成
    createAnnotationModal(isEdit, existingAnnotation);
    
    // Bootstrapモーダルを初期化して表示
    const annotationModal = new bootstrap.Modal(document.getElementById('annotationModal'));
    
    // キャンバスの設定
    setupAnnotationCanvas(annotationTools.selectedCard, isEdit, existingAnnotation);
    
    // モーダルが閉じられたときのクリーンアップ
    document.getElementById('annotationModal').addEventListener('hidden.bs.modal', cleanupAnnotationModal);
    
    // モーダルを表示
    annotationModal.show();
}

/**
 * アノテーションモーダルのHTMLを作成
 */
function createAnnotationModal(isEdit = false, existingAnnotation = null) {
    const modalTitle = isEdit ? '生殖乳頭アノテーション編集' : '生殖乳頭アノテーション';
    const saveButtonText = isEdit ? '更新して保存' : '学習データとして保存';
    
    const modalHTML = `
    <div class="modal fade" id="annotationModal" tabindex="-1" aria-labelledby="annotationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="annotationModalLabel">${modalTitle}</h5>
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
                            ${isEdit ? `
                            <button type="button" class="btn btn-outline-warning" id="clearTool">
                                <i class="fas fa-undo"></i> リセット
                            </button>
                            ` : ''}
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
                        <i class="fas fa-save me-1"></i> ${saveButtonText}
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * アノテーションキャンバスの設定
 * @param {object} selectedCard - 選択されたカード情報
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
function setupAnnotationCanvas(selectedCard, isEdit = false, existingAnnotation = null) {
    const canvas = document.getElementById('annotationCanvas');
    annotationTools.canvas = canvas;
    annotationTools.context = canvas.getContext('2d');
    
    // 画像の読み込み
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        // キャンバスのサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 画像を描画
        annotationTools.context.drawImage(img, 0, 0);
        
        // 編集モードの場合、既存のアノテーションを読み込み
        if (isEdit && existingAnnotation) {
            loadExistingAnnotation(existingAnnotation);
        }
        
        // アノテーションツールの初期化
        initAnnotationToolButtons(isEdit);
        initAnnotationEvents();
    };
    img.onerror = function() {
        console.error('画像の読み込みに失敗しました:', img.src);
        alert('画像の読み込みに失敗しました');
    };
    
    // 画像パスの整形
    let imagePath = selectedCard.dataset.path;
    
    // パスの先頭に/sampleを追加（必要に応じて）
    if (!imagePath.startsWith('/')) {
        imagePath = '/sample/' + imagePath;
    } else {
        imagePath = '/sample' + imagePath;
    }
    
    console.log('読み込む画像パス:', imagePath);
    img.src = imagePath;
}

/**
 * 既存のアノテーションを読み込み
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
function loadExistingAnnotation(existingAnnotation) {
    if (!existingAnnotation || !existingAnnotation.url) return;
    
    const annotationImg = new Image();
    annotationImg.crossOrigin = 'anonymous';
    annotationImg.onload = function() {
        // 既存のアノテーションを合成
        annotationTools.context.globalCompositeOperation = 'source-over';
        annotationTools.context.drawImage(annotationImg, 0, 0);
    };
    annotationImg.src = existingAnnotation.url;
}

/**
 * アノテーションツールのボタン初期化
 */
function initAnnotationToolButtons(isEdit = false) {
    // ツール選択
    document.getElementById('penTool').addEventListener('click', function() {
        annotationTools.currentTool = 'pen';
        updateToolButtons();
    });
    
    document.getElementById('eraserTool').addEventListener('click', function() {
        annotationTools.currentTool = 'eraser';
        updateToolButtons();
    });
    
    document.getElementById('circleTool').addEventListener('click', function() {
        annotationTools.currentTool = 'circle';
        updateToolButtons();
    });
    
    // リセットボタン（編集モードのみ）
    if (isEdit) {
        const clearBtn = document.getElementById('clearTool');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                // キャンバスをクリア
                annotationTools.context.clearRect(0, 0, annotationTools.canvas.width, annotationTools.canvas.height);
                // 元の画像を再描画
                const selectedCard = annotationTools.selectedCard;
                if (selectedCard) {
                    setupAnnotationCanvas(selectedCard, false, null);
                }
            });
        }
    }
    
    // ツールサイズの変更
    document.getElementById('toolSize').addEventListener('input', function() {
        annotationTools.toolSize = parseInt(this.value);
        document.getElementById('toolSizeValue').textContent = annotationTools.toolSize;
    });
    
    // 保存ボタン
    document.getElementById('saveAnnotation').addEventListener('click', saveAnnotationData);
    
    // 初期状態のボタン更新
    updateToolButtons();
}

/**
 * ツールボタンの状態を更新
 */
function updateToolButtons() {
    document.getElementById('penTool').classList.remove('active');
    document.getElementById('eraserTool').classList.remove('active');
    document.getElementById('circleTool').classList.remove('active');
    
    if (annotationTools.currentTool === 'pen') {
        document.getElementById('penTool').classList.add('active');
    } else if (annotationTools.currentTool === 'eraser') {
        document.getElementById('eraserTool').classList.add('active');
    } else if (annotationTools.currentTool === 'circle') {
        document.getElementById('circleTool').classList.add('active');
    }
}

/**
 * アノテーションキャンバスのイベント初期化
 */
function initAnnotationEvents() {
    const canvas = annotationTools.canvas;
    
    // 描画開始
    canvas.addEventListener('mousedown', function(e) {
        annotationTools.isDrawing = true;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        annotationTools.lastX = (e.clientX - rect.left) * scaleX;
        annotationTools.lastY = (e.clientY - rect.top) * scaleY;
        
        if (annotationTools.currentTool === 'circle') {
            // 円ツールの場合は一時的な円を描画
            const ctx = annotationTools.context;
            ctx.beginPath();
            ctx.arc(annotationTools.lastX, annotationTools.lastY, annotationTools.toolSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
        }
    });
    
    // 描画中
    canvas.addEventListener('mousemove', function(e) {
        if (!annotationTools.isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const ctx = annotationTools.context;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = annotationTools.toolSize;
        
        if (annotationTools.currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            
            ctx.beginPath();
            ctx.moveTo(annotationTools.lastX, annotationTools.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (annotationTools.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            
            ctx.beginPath();
            ctx.moveTo(annotationTools.lastX, annotationTools.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        
        annotationTools.lastX = x;
        annotationTools.lastY = y;
    });
    
    // 描画終了
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // タッチデバイス対応
    enableTouchSupport(canvas);
}

/**
 * 描画停止処理
 */
function stopDrawing() {
    annotationTools.isDrawing = false;
    // 元の描画モードに戻す
    annotationTools.context.globalCompositeOperation = 'source-over';
}

/**
 * タッチデバイス対応の有効化
 * @param {HTMLCanvasElement} canvas - 対象のキャンバス要素
 */
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
    
    canvas.addEventListener('touchstart', e => touchToMouse(e, 'mousedown'), { passive: false });
    canvas.addEventListener('touchmove', e => touchToMouse(e, 'mousemove'), { passive: false });
    canvas.addEventListener('touchend', e => touchToMouse(e, 'mouseup'), { passive: false });
    canvas.addEventListener('touchcancel', e => touchToMouse(e, 'mouseout'), { passive: false });
}

/**
 * アノテーションデータを保存
 */
function saveAnnotationData() {
    try {
        showLoading(); // ローディング表示を追加
        console.log('アノテーション保存開始');

        // キャンバスのデータをBase64形式で取得
        const annotationData = annotationTools.canvas.toDataURL('image/png');
        console.log('Base64データサイズ:', calculateImageSize(annotationData), 'KB');

        const selectedCard = annotationTools.selectedCard;
        console.log('選択カード:', selectedCard.dataset.path);

        // 画像データをサーバーに送信
        fetch('/learning/save-annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: annotationData,
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
                
                // 学習管理画面のデータ更新コールバック
                if (typeof window.onAnnotationSaved === 'function') {
                    window.onAnnotationSaved();
                }
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
}

/**
 * アノテーションモーダルのクリーンアップ
 */
function cleanupAnnotationModal() {
    // リソースの解放やイベントリスナーの削除など
    annotationTools.canvas = null;
    annotationTools.context = null;
    annotationTools.isDrawing = false;
    
    // モーダル要素の削除
    const modal = document.getElementById('annotationModal');
    if (modal) {
        modal.remove();
    }
}

// ユーティリティ関数の参照（utilities.jsから）
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

function calculateImageSize(base64String) {
    if (!base64String) return '0.00';
    
    // Base64のヘッダー部分を削除
    const base64Data = base64String.includes(',') ? 
        base64String.split(',')[1] : base64String;
    
    // Base64のデータサイズを計算（バイト単位）
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    // KB単位に変換（小数点以下2桁）
    return (sizeInBytes / 1024).toFixed(2);
}

function saveToSession(key, value) {
    try {
        if (!key) throw new Error('キーが指定されていません');
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('セッションストレージへの保存エラー:', e);
        return false;
    }
}

// アノテーションツール初期化
export function initAnnotationTools() {
    console.log('アノテーションツール初期化');
    // 必要な初期化処理があればここに追加
}

// グローバルエクスポートのためのラッパー
export function setupAnnotationTools() {
    window.selectImageForAnnotation = selectImageForAnnotation;
    window.openImageDetailModal = openImageDetailModal;
    window.openAnnotationEditModal = openAnnotationEditModal;
    window.openAnnotationModal = openAnnotationModal;
    window.showQuickDeleteConfirm = showQuickDeleteConfirm;
    window.deleteImage = deleteImage;
    
    console.log('アノテーションツールのグローバル関数を設定しました');
}