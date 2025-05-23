/**
 * ウニ生殖乳頭分析システム - アノテーションツール（改善版）
 * 画像アノテーションのための機能を提供
 */

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    calculateImageSize,
    saveToSession
} from '../utilities.js';

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
    history: [], // 操作履歴（Undo用）
    historyIndex: -1, // 現在の履歴インデックス
};

/**
 * 学習データ画像をクリックした時の処理
 * @param {string} imagePath - 画像パス
 */
export function selectImageForAnnotation(imagePath) {
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
    // 既存のアノテーション情報を確認
    checkExistingAnnotation(imagePath)
        .then(annotationInfo => {
            createImageDetailModal(imagePath, annotationInfo);
        })
        .catch(error => {
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
            // YOLOアノテーション情報も確認
            const yoloInfo = await checkYoloAnnotation(imagePath);
            
            return {
                exists: true,
                path: annotationPath,
                url: `/static/${annotationPath}`,
                yolo: yoloInfo
            };
        }
        
        // YOLOアノテーションのみを確認
        const yoloInfo = await checkYoloAnnotation(imagePath);
        if (yoloInfo && yoloInfo.exists) {
            return {
                exists: false,
                yolo: yoloInfo
            };
        }
        
        return { exists: false };
        
    } catch (error) {
        console.error('アノテーション情報確認エラー:', error);
        return null;
    }
}

/**
 * YOLOアノテーション情報を確認
 * @param {string} imagePath - 画像パス
 * @returns {Promise} YOLOアノテーション情報
 */
async function checkYoloAnnotation(imagePath) {
    try {
        const filename = imagePath.split('/').pop();
        const basename = filename.split('.')[0];
        
        // YOLOラベルファイルのパスを作成
        const labelPath = `data/yolo_dataset/labels/train/${basename}.txt`;
        
        // ファイルの存在を確認（APIを作成する必要あり）
        const response = await fetch(`/api/check-file?path=${encodeURIComponent(labelPath)}`);
        const data = await response.json();
        
        return {
            exists: data.exists,
            path: labelPath
        };
    } catch (error) {
        console.error('YOLOアノテーション確認エラー:', error);
        return { exists: false };
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
    const hasYoloAnnotation = annotationInfo && annotationInfo.yolo && annotationInfo.yolo.exists;
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
                        ${hasAnnotation ? 
                          '<span class="badge bg-success ms-2">アノテーション済み</span>' : 
                          '<span class="badge bg-secondary ms-2">未アノテーション</span>'}
                        ${hasYoloAnnotation ? 
                          '<span class="badge bg-info ms-2">YOLO形式あり</span>' : 
                          ''}
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
                                ${hasYoloAnnotation ? `
                                    <p class="text-info"><i class="fas fa-check-circle me-1"></i> YOLO形式あり</p>
                                    <p><strong>YOLOラベル:</strong><br><code>${annotationInfo.yolo.path}</code></p>
                                ` : ''}
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
                            ${!hasYoloAnnotation ? `
                                <button type="button" class="btn btn-outline-info" id="convertToYoloBtn">
                                    <i class="fas fa-exchange-alt me-1"></i> YOLO変換
                                </button>
                            ` : ''}
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
    const hasYoloAnnotation = annotationInfo && annotationInfo.yolo && annotationInfo.yolo.exists;
    
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
    
    // YOLO変換ボタン
    const convertToYoloBtn = document.getElementById('convertToYoloBtn');
    if (convertToYoloBtn) {
        convertToYoloBtn.addEventListener('click', function() {
            convertToYoloFormat(imagePath, annotationInfo);
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
 * アノテーションをYOLO形式に変換
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
async function convertToYoloFormat(imagePath, annotationInfo) {
    if (!annotationInfo || !annotationInfo.exists) {
        showErrorMessage('変換元のアノテーションが見つかりません');
        return;
    }
    
    try {
        showLoading();
        
        // 変換APIを呼び出す
        const response = await fetch('/learning/convert-to-yolo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                image_path: imagePath,
                annotation_path: annotationInfo.path
            })
        });
        
        if (!response.ok) throw new Error('変換リクエストに失敗しました');
        
        const data = await response.json();
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('YOLO形式に変換しました');
        
        // モーダルを閉じる
        bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
        
        // 必要に応じてデータを更新
        if (typeof window.onAnnotationSaved === 'function') {
            window.onAnnotationSaved();
        }
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLO形式への変換に失敗しました: ' + error.message);
    }
}

/**
 * アノテーション編集モーダルを開く
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
export function openAnnotationEditModal(imagePath, annotationInfo) {
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
        showLoading();
        
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
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('アノテーションを削除しました');
        
        // モーダルを閉じる
        bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
        
        // データを更新
        if (typeof window.onAnnotationSaved === 'function') {
            window.onAnnotationSaved();
        }
        
    } catch (error) {
        hideLoading();
        showErrorMessage('アノテーション削除に失敗しました: ' + error.message);
    }
}

/**
 * データセットへの移動
 * @param {string} imagePath - 画像パス
 */
function moveImageToDataset(imagePath) {
    // 性別選択ダイアログを表示
    const genderOptions = `
    <div class="form-check mb-2">
        <input class="form-check-input" type="radio" name="genderOption" id="genderMale" value="male" checked>
        <label class="form-check-label" for="genderMale">
            <i class="fas fa-mars text-primary"></i> オス
        </label>
    </div>
    <div class="form-check">
        <input class="form-check-input" type="radio" name="genderOption" id="genderFemale" value="female">
        <label class="form-check-label" for="genderFemale">
            <i class="fas fa-venus text-danger"></i> メス
        </label>
    </div>
    `;
    
    // 確認ダイアログを表示
    const modal = document.createElement('div');
    modal.innerHTML = `
    <div class="modal fade" id="moveToDatasetModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">データセットに移動</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>移動先カテゴリを選択してください:</p>
                    ${genderOptions}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                    <button type="button" class="btn btn-primary" id="confirmMoveBtn">移動する</button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.appendChild(modal);
    
    // モーダルを表示
    const moveModal = new bootstrap.Modal(document.getElementById('moveToDatasetModal'));
    moveModal.show();
    
    // 移動確認ボタンのイベント
    document.getElementById('confirmMoveBtn').addEventListener('click', async function() {
        const genderElements = document.getElementsByName('genderOption');
        let targetGender = 'unknown';
        
        for (const element of genderElements) {
            if (element.checked) {
                targetGender = element.value;
                break;
            }
        }
        
        try {
            showLoading();
            
            // 移動APIを呼び出す
            const response = await fetch('/learning/save-to-dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image_path: imagePath,
                    gender: targetGender
                })
            });
            
            if (!response.ok) throw new Error('移動リクエストに失敗しました');
            
            const data = await response.json();
            
            hideLoading();
            moveModal.hide();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // 詳細モーダルも閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            
            // 成功メッセージ
            showSuccessMessage(`画像を${targetGender === 'male' ? 'オス' : 'メス'}カテゴリに移動しました`);
            
            // データを更新
            if (typeof window.onAnnotationSaved === 'function') {
                window.onAnnotationSaved();
            }
            
        } catch (error) {
            hideLoading();
            showErrorMessage('データセットへの移動に失敗しました: ' + error.message);
        }
    });
    
    // モーダルが閉じられたときの処理
    document.getElementById('moveToDatasetModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
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
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ表示
        showSuccessMessage(data.message);
        
        // データ更新
        if (window.unifiedLearningSystem) {
            await window.unifiedLearningSystem.dataManager.refreshDatasetStats();
            await window.unifiedLearningSystem.dataManager.loadLearningData();
        }
        
        // モーダルが開いている場合は閉じる
        const modal = document.getElementById('imageDetailModal');
        if (modal) {
            bootstrap.Modal.getInstance(modal).hide();
        }
        
    } catch (error) {
        hideLoading();
        showErrorMessage('削除中にエラーが発生しました: ' + error.message);
    }
}

/**
 * アノテーションモーダルを開く
 * @param {string} paramImagePath - 画像パス
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
 */
export function openAnnotationModal(paramImagePath, isEdit = false, existingAnnotation = null) {
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
    
    // 履歴をクリア
    annotationTools.history = [];
    annotationTools.historyIndex = -1;
    
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
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {Object} existingAnnotation - 既存のアノテーション情報
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
                            <button type="button" class="btn btn-outline-primary" id="penTool" title="自由に描画">
                                <i class="fas fa-pen"></i> ペン
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="eraserTool" title="描画を消去">
                                <i class="fas fa-eraser"></i> 消しゴム
                            </button>
                            <button type="button" class="btn btn-outline-success" id="circleTool" title="円形を描画">
                                <i class="fas fa-circle"></i> 円形
                            </button>
                            <button type="button" class="btn btn-outline-secondary" id="undoTool" title="操作を戻す">
                                <i class="fas fa-undo"></i> 戻す
                            </button>
                            ${isEdit ? `
                            <button type="button" class="btn btn-outline-warning" id="clearTool" title="全て消去">
                                <i class="fas fa-trash-alt"></i> リセット
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label for="toolSize" class="form-label">ツールサイズ: <span id="toolSizeValue">5</span>px</label>
                        <input type="range" class="form-range" id="toolSize" min="1" max="20" value="5">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="autoYoloConvert" checked>
                        <label class="form-check-label" for="autoYoloConvert">
                            YOLO形式にも自動変換する
                        </label>
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
        
        // 履歴に初期状態を保存
        saveToHistory();
        
        // 編集モードの場合、既存のアノテーションを読み込み
        if (isEdit && existingAnnotation) {
            loadExistingAnnotation(existingAnnotation);
        }
        
        // アノテーションツールの初期化
        initAnnotationToolButtons(isEdit);
        initAnnotationEvents();
    };
    img.onerror = function() {
        alert('画像の読み込みに失敗しました');
    };
    
    // 画像パスの整形
    let imagePath = selectedCard.dataset.path;
    
    // パスの先頭に/sampleを追加（必要に応じて）
    if (!imagePath.startsWith('/')) {
        imagePath = '/sample/' + imagePath;
    }
    
    img.src = imagePath;
}

/**
 * 履歴に現在の状態を保存
 */
function saveToHistory() {
    // 現在のキャンバス状態を取得
    const imageData = annotationTools.context.getImageData(0, 0, annotationTools.canvas.width, annotationTools.canvas.height);
    
    // 履歴に追加（現在位置より後のものは削除）
    if (annotationTools.historyIndex < annotationTools.history.length - 1) {
        annotationTools.history = annotationTools.history.slice(0, annotationTools.historyIndex + 1);
    }
    
    annotationTools.history.push(imageData);
    annotationTools.historyIndex = annotationTools.history.length - 1;
    
    // 戻すボタンの状態を更新
    updateUndoButtonState();
}

/**
 * 履歴から状態を復元
 */
function restoreFromHistory() {
    if (annotationTools.historyIndex < 0 || annotationTools.historyIndex >= annotationTools.history.length) {
        return;
    }
    
    // 指定インデックスの状態を復元
    const imageData = annotationTools.history[annotationTools.historyIndex];
    annotationTools.context.putImageData(imageData, 0, 0);
    
    // 戻すボタンの状態を更新
    updateUndoButtonState();
}

/**
 * 戻すボタンの状態を更新
 */
function updateUndoButtonState() {
    const undoButton = document.getElementById('undoTool');
    if (undoButton) {
        // 履歴がある場合のみ有効化
        undoButton.disabled = annotationTools.historyIndex <= 0;
    }
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
        
        // 履歴に保存
        saveToHistory();
    };
    annotationImg.src = existingAnnotation.url;
}

/**
 * アノテーションツールのボタン初期化
 * @param {boolean} isEdit - 編集モードかどうか
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
    
    // 戻すボタン
    document.getElementById('undoTool').addEventListener('click', function() {
        if (annotationTools.historyIndex > 0) {
            annotationTools.historyIndex--;
            restoreFromHistory();
        }
    });
    
    // リセットボタン（編集モードのみ）
    if (isEdit) {
        const clearBtn = document.getElementById('clearTool');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (confirm('すべてのアノテーションをクリアしますか？')) {
                    // キャンバスをクリア
                    annotationTools.context.clearRect(0, 0, annotationTools.canvas.width, annotationTools.canvas.height);
                    
                    // 元の画像を再描画
                    const selectedCard = annotationTools.selectedCard;
                    if (selectedCard) {
                        setupAnnotationCanvas(selectedCard, false, null);
                    }
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
    canvas.addEventListener('mouseup', function() {
        if (annotationTools.isDrawing) {
            annotationTools.isDrawing = false;
            // 元の描画モードに戻す
            annotationTools.context.globalCompositeOperation = 'source-over';
            // 履歴に保存
            saveToHistory();
        }
    });
    
    canvas.addEventListener('mouseout', function() {
        if (annotationTools.isDrawing) {
            annotationTools.isDrawing = false;
            // 元の描画モードに戻す
            annotationTools.context.globalCompositeOperation = 'source-over';
            // 履歴に保存
            saveToHistory();
        }
    });
    
    // タッチデバイス対応
    enableTouchSupport(canvas);
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
        showLoading();

        // キャンバスのデータをBase64形式で取得
        const annotationData = annotationTools.canvas.toDataURL('image/png');
        const annotationSize = calculateImageSize(annotationData);

        const selectedCard = annotationTools.selectedCard;

        // YOLO形式への自動変換フラグを取得
        const autoYoloConvert = document.getElementById('autoYoloConvert').checked;

        // 画像データをサーバーに送信
        fetch('/learning/save-annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: annotationData,
                original_path: selectedCard.dataset.path,
                convert_to_yolo: autoYoloConvert
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('サーバーレスポンスが不正です');
            }
            return response.json();
        })
        .then(data => {
            hideLoading();
            
            if (data.error) {
                showErrorMessage('エラー: ' + data.error);
                return;
            }
            
            showSuccessMessage(autoYoloConvert ? 
                'アノテーションを保存し、YOLO形式に変換しました' : 
                'アノテーションを保存しました');
                
            saveToSession('annotationSaved', true);
            
            // モーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('annotationModal')).hide();
            
            // 学習管理画面のデータ更新コールバック
            if (typeof window.onAnnotationSaved === 'function') {
                window.onAnnotationSaved();
            }
        })
        .catch(error => {
            hideLoading();
            showErrorMessage('保存中にエラーが発生しました: ' + error.message);
        });
    } catch (e) {
        hideLoading();
        showErrorMessage('アノテーションの保存中にエラーが発生しました: ' + e.message);
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
    annotationTools.history = [];
    annotationTools.historyIndex = -1;
    
    // モーダル要素の削除
    const modal = document.getElementById('annotationModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * グローバルエクスポートのためのラッパー
 */
export function setupAnnotationTools() {
    window.selectImageForAnnotation = selectImageForAnnotation;
    window.openImageDetailModal = openImageDetailModal;
    window.openAnnotationEditModal = openAnnotationEditModal;
    window.openAnnotationModal = openAnnotationModal;
    window.showQuickDeleteConfirm = showQuickDeleteConfirm;
    window.deleteImage = deleteImage;
}