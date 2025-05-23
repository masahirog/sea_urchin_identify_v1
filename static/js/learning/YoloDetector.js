/**
 * ウニ生殖乳頭分析システム - YOLO検出関連機能
 * アノテーションモーダルとAI検出機能
 */

import { YoloAnnotator } from './AnnotationManager.js';

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    showWarningMessage,
    yoloToXY,
    xyToYolo
} from '../utilities.js';

// ===========================================================
// YOLOアノテーションモーダル
// ===========================================================

/**
 * YOLOアノテーションモーダルを作成
 * @param {string} imagePath - 画像パス
 * @param {boolean} isEdit - 編集モードかどうか
 * @param {string} yoloData - YOLO形式のデータ（編集モードの場合）
 * @returns {Promise} モーダルインスタンス
 */
export function createYoloAnnotationModal(imagePath, isEdit = false, yoloData = null) {
    return new Promise((resolve, reject) => {
        // 既存のモーダルを削除
        const existingModal = document.getElementById('yoloAnnotationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // モーダルHTMLを作成
        const modalHTML = `
        <div class="modal fade" id="yoloAnnotationModal" tabindex="-1" aria-labelledby="yoloAnnotationModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="yoloAnnotationModalLabel">
                            ${isEdit ? 'YOLOアノテーション編集' : 'YOLOアノテーション作成'}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-3">
                            <i class="fas fa-info-circle me-2"></i>
                            各生殖乳頭を囲むバウンディングボックスを描画してください。複数の乳頭がある場合は、それぞれにボックスを作成します。
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-8">
                                <div class="annotation-area">
                                    <canvas id="yoloCanvas" class="annotation-canvas"></canvas>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card mb-3">
                                    <div class="card-header">
                                        <h6 class="mb-0">ツール</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="btn-group w-100 mb-3" role="group">
                                            <button type="button" class="btn btn-outline-primary active" id="createTool" title="新規作成">
                                                <i class="fas fa-draw-polygon"></i> 作成
                                            </button>
                                            <button type="button" class="btn btn-outline-warning" id="editTool" title="移動・編集">
                                                <i class="fas fa-edit"></i> 編集
                                            </button>
                                            <button type="button" class="btn btn-outline-danger" id="deleteTool" title="削除">
                                                <i class="fas fa-trash"></i> 削除
                                            </button>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">クラス:</label>
                                            <select id="yoloClassSelect" class="form-select">
                                                <option value="0" selected>生殖乳頭</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">操作:</label>
                                            <div class="d-grid gap-2">
                                                <button type="button" class="btn btn-outline-secondary" id="undoBtn">
                                                    <i class="fas fa-undo"></i> 元に戻す
                                                </button>
                                                <button type="button" class="btn btn-outline-secondary" id="redoBtn">
                                                    <i class="fas fa-redo"></i> やり直し
                                                </button>
                                                <button type="button" class="btn btn-outline-secondary" id="clearBtn">
                                                    <i class="fas fa-trash-alt"></i> すべて消去
                                                </button>
                                                <button type="button" class="btn btn-outline-success" id="autoDetectBtn">
                                                    <i class="fas fa-magic"></i> AI自動検出
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0">YOLO形式</h6>
                                    </div>
                                    <div class="card-body">
                                        <textarea id="yoloTextArea" class="form-control" rows="6" readonly></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                        <button type="button" class="btn btn-primary" id="saveYoloAnnotation">
                            <i class="fas fa-save me-1"></i> 保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // モーダルをDOMに追加
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // モーダルを表示
        const modal = new bootstrap.Modal(document.getElementById('yoloAnnotationModal'));
        
        // 画像とキャンバスの設定
        const canvas = document.getElementById('yoloCanvas');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            // キャンバスのサイズを画像に合わせる
            canvas.width = img.width;
            canvas.height = img.height;
            
            // YOLOアノテーターを初期化
            const annotator = new YoloAnnotator(canvas, img);
            
            // 編集モードの場合、既存のアノテーションを読み込む
            if (isEdit && yoloData) {
                annotator.loadFromYoloFormat(yoloData);
            }
            
            // 初期描画
            annotator.redraw();
            
            // ツールボタンのイベント
            document.getElementById('createTool').addEventListener('click', function() {
                annotator.setMode('create');
                updateToolButtons('createTool');
            });
            
            document.getElementById('editTool').addEventListener('click', function() {
                annotator.setMode('edit');
                updateToolButtons('editTool');
            });
            
            document.getElementById('deleteTool').addEventListener('click', function() {
                annotator.setMode('delete');
                updateToolButtons('deleteTool');
            });
            
            // クラス選択の変更
            document.getElementById('yoloClassSelect').addEventListener('change', function() {
                annotator.setCurrentClass(parseInt(this.value));
            });
            
            // 元に戻す・やり直しボタン
            document.getElementById('undoBtn').addEventListener('click', function() {
                annotator.undo();
                updateYoloText(annotator);
            });
            
            document.getElementById('redoBtn').addEventListener('click', function() {
                annotator.redo();
                updateYoloText(annotator);
            });
            
            // クリアボタン
            document.getElementById('clearBtn').addEventListener('click', function() {
                if (confirm('すべてのアノテーションを削除してもよろしいですか？')) {
                    annotator.clearAnnotations();
                    updateYoloText(annotator);
                }
            });
            
            // 自動検出ボタン
            document.getElementById('autoDetectBtn').addEventListener('click', function() {
                runAIDetection(annotator, imagePath)
                    .then(() => {
                        updateYoloText(annotator);
                    });
            });
            
            // 保存ボタン
            document.getElementById('saveYoloAnnotation').addEventListener('click', function() {
                // YOLOデータを取得
                const yoloData = annotator.exportToYoloFormat();
                
                // 保存処理
                saveYoloAnnotation(imagePath, yoloData);
            });
            
            // YOLOテキストの初期更新
            updateYoloText(annotator);
            
            // モーダルが閉じられたときの処理
            document.getElementById('yoloAnnotationModal').addEventListener('hidden.bs.modal', function() {
                // クリーンアップ
                this.remove();
            });
            
            // Promise解決
            resolve({ modal, annotator });
        };
        
        img.onerror = function() {
            reject(new Error('画像の読み込みに失敗しました'));
        };
        
        // 画像のロード
        if (imagePath.startsWith('/')) {
            img.src = imagePath;
        } else {
            img.src = '/sample/' + imagePath;
        }
    });
}

/**
 * ツールボタンの状態を更新
 * @param {string} activeButtonId - アクティブにするボタンのID
 */
function updateToolButtons(activeButtonId) {
    const buttons = ['createTool', 'editTool', 'deleteTool'];
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.remove('active');
            if (buttonId === activeButtonId) {
                button.classList.add('active');
            }
        }
    });
}

/**
 * YOLOテキストエリアを更新
 * @param {YoloAnnotator} annotator - アノテーターインスタンス
 */
function updateYoloText(annotator) {
    const textArea = document.getElementById('yoloTextArea');
    if (textArea) {
        textArea.value = annotator.exportToYoloFormat();
    }
}

/**
 * AI自動検出を実行
 * @param {YoloAnnotator} annotator - アノテーターインスタンス
 * @param {string} imagePath - 画像パス
 * @returns {Promise} 検出結果のPromise
 */
export async function runAIDetection(annotator, imagePath) {
    try {
        showLoading();
        
        // 検出APIを呼び出す
        const response = await fetch('/yolo/detect-in-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: imagePath,
                confidence: 0.25  // デフォルト信頼度閾値
            })
        });
        
        if (!response.ok) {
            throw new Error('検出リクエストに失敗しました');
        }
        
        const data = await response.json();
        hideLoading();
        
        if (data.error) {
            showErrorMessage('検出エラー: ' + data.error);
            return;
        }
        
        // 検出結果がある場合、アノテーションに変換
        if (data.detections && data.detections.length > 0) {
            const boxes = data.detections.map(detection => ({
                x1: detection.xmin,
                y1: detection.ymin,
                x2: detection.xmax,
                y2: detection.ymax
            }));
            
            // アノテーターに追加
            annotator.loadAutoDetectedBoxes(boxes);
            
            showSuccessMessage(`${boxes.length}個の生殖乳頭を検出しました`);
            return boxes;
        } else {
            showWarningMessage('生殖乳頭を検出できませんでした');
            return [];
        }
    } catch (error) {
        hideLoading();
        showErrorMessage('検出処理中にエラーが発生しました: ' + error.message);
        throw error;
    }
}

/**
 * YOLOアノテーションを保存
 * @param {string} imagePath - 画像パス
 * @param {string} yoloData - YOLO形式のデータ
 * @returns {Promise} 保存結果のPromise
 */
export async function saveYoloAnnotation(imagePath, yoloData) {
    try {
        showLoading();
        
        const response = await fetch('/yolo/save-annotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: imagePath,
                yolo_data: yoloData
            })
        });
        
        if (!response.ok) throw new Error('保存リクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('YOLOアノテーションを保存しました');
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('yoloAnnotationModal'));
        if (modal) {
            modal.hide();
        }
        
        // コールバック
        if (typeof window.onYoloAnnotationSaved === 'function') {
            window.onYoloAnnotationSaved(imagePath, data);
        }
        
        return data;
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLOアノテーションの保存に失敗しました: ' + error.message);
        throw error;
    }
}

/**
 * 複数画像の自動検出
 * @param {Array} imagePaths - 画像パスの配列
 * @param {number} confidence - 信頼度閾値
 * @returns {Promise} 検出結果のPromise
 */
export async function batchDetectImages(imagePaths, confidence = 0.25) {
    try {
        showLoading();
        
        const response = await fetch('/yolo/batch-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_paths: imagePaths,
                confidence: confidence
            })
        });
        
        if (!response.ok) throw new Error('一括検出リクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        const totalDetections = Object.values(data.results).reduce((sum, item) => sum + item.count, 0);
        showSuccessMessage(`${imagePaths.length}枚の画像から合計${totalDetections}個の生殖乳頭を検出しました`);
        
        return data.results;
        
    } catch (error) {
        hideLoading();
        showErrorMessage('一括検出中にエラーが発生しました: ' + error.message);
        throw error;
    }
}

/**
 * バッチでYOLOアノテーションを保存
 * @param {Object} detectionResults - 検出結果のオブジェクト
 * @returns {Promise} 保存結果のPromise
 */
export async function saveBatchAnnotations(detectionResults) {
    try {
        showLoading();
        
        const response = await fetch('/yolo/save-batch-annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detection_results: detectionResults
            })
        });
        
        if (!response.ok) throw new Error('一括保存リクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage(`${data.saved_count}件のアノテーションを保存しました`);
        
        return data;
        
    } catch (error) {
        hideLoading();
        showErrorMessage('一括保存中にエラーが発生しました: ' + error.message);
        throw error;
    }
}

/**
 * 検出モデルの情報を取得
 * @returns {Promise} モデル情報のPromise
 */
export async function getDetectionModelInfo() {
    try {
        const response = await fetch('/yolo/model-info');
        
        if (!response.ok) throw new Error('モデル情報の取得に失敗しました');
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
        
    } catch (error) {
        console.error('モデル情報取得エラー:', error);
        return {
            error: error.message,
            model_name: 'unknown',
            last_trained: 'unknown'
        };
    }
}

/**
 * モデルの再学習を開始
 * @param {Object} options - 学習オプション
 * @returns {Promise} 学習開始結果のPromise
 */
export async function startModelTraining(options = {}) {
    try {
        showLoading();
        
        const defaultOptions = {
            epochs: 100,
            batch_size: 16,
            img_size: 640,
            patience: 20,
            use_pretrained: true
        };
        
        const trainingOptions = { ...defaultOptions, ...options };
        
        const response = await fetch('/yolo/start-training', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trainingOptions)
        });
        
        if (!response.ok) throw new Error('学習開始リクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('モデルの学習を開始しました。処理状況は学習管理画面で確認できます');
        
        return data;
        
    } catch (error) {
        hideLoading();
        showErrorMessage('学習開始中にエラーが発生しました: ' + error.message);
        throw error;
    }
}

/**
 * モデルの学習状況を取得
 * @returns {Promise} 学習状況のPromise
 */
export async function getTrainingStatus() {
    try {
        const response = await fetch('/yolo/training-status');
        
        if (!response.ok) throw new Error('学習状況の取得に失敗しました');
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
        
    } catch (error) {
        console.error('学習状況取得エラー:', error);
        return {
            error: error.message,
            is_training: false,
            progress: 0,
            status: 'unknown'
        };
    }
}

/**
 * 実行中の学習をキャンセル
 * @returns {Promise} キャンセル結果のPromise
 */
export async function cancelTraining() {
    try {
        showLoading();
        
        const response = await fetch('/yolo/cancel-training', {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('学習キャンセルリクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('モデルの学習をキャンセルしました');
        
        return data;
        
    } catch (error) {
        hideLoading();
        showErrorMessage('学習キャンセル中にエラーが発生しました: ' + error.message);
        throw error;
    }
}