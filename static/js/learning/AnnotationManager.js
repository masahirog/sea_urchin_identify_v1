/**
 * ウニ生殖乳頭分析システム - アノテーション管理
 * 画像アノテーション機能の中核部分
 */

import { 
    createYoloAnnotationModal, 
    runAIDetection, 
    saveYoloAnnotation 
} from './YoloDetector.js';

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    yoloToXY,
    xyToYolo,
    parseYoloFormat,
    formatYolo,
    calculateIoU,
    getConfidenceColor,
    getRandomColor
} from '../utilities.js';

// ===========================================================
// YOLOアノテータークラス
// ===========================================================

/**
 * YOLOアノテータークラス
 */
export class YoloAnnotator {
    /**
     * コンストラクタ
     * @param {HTMLCanvasElement} canvas - キャンバス要素
     * @param {HTMLImageElement} image - 画像要素
     */
    constructor(canvas, image) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = image;
        
        // アノテーションデータ
        this.annotations = [];
        this.selectedAnnotation = -1;
        
        // 描画状態
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        // モード
        this.mode = 'create'; // create, edit, delete
        
        // クラス情報
        this.classes = [
            { id: 0, name: '生殖乳頭', color: 'rgba(255, 87, 34, 0.7)' }
        ];
        this.currentClass = 0;
        
        // 変更履歴
        this.history = [];
        this.historyIndex = -1;
        
        // イベントリスナーの設定
        this.setupEventListeners();
    }
    
    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
        
        // タッチイベント（モバイル対応）
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    /**
     * マウスダウンイベントハンドラ
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseDown(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        if (this.mode === 'create') {
            // 新しいバウンディングボックスの作成開始
            this.isDrawing = true;
            this.startX = x;
            this.startY = y;
            this.currentX = x;
            this.currentY = y;
        } else if (this.mode === 'edit') {
            // 既存のバウンディングボックスの選択
            this.selectedAnnotation = this.findAnnotationAt(x, y);
            this.redraw();
        } else if (this.mode === 'delete') {
            // バウンディングボックスの削除
            const index = this.findAnnotationAt(x, y);
            if (index !== -1) {
                // 履歴に保存
                this.saveToHistory();
                
                // アノテーションを削除
                this.annotations.splice(index, 1);
                this.selectedAnnotation = -1;
                this.redraw();
            }
        }
    }
    
    /**
     * マウス移動イベントハンドラ
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseMove(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        if (this.mode === 'create' && this.isDrawing) {
            // 描画中のバウンディングボックスを更新
            this.currentX = x;
            this.currentY = y;
            this.redraw();
            this.drawTempBox();
        } else if (this.mode === 'edit' && this.selectedAnnotation !== -1) {
            // 選択されたバウンディングボックスを移動
            const ann = this.annotations[this.selectedAnnotation];
            const width = ann.x2 - ann.x1;
            const height = ann.y2 - ann.y1;
            
            ann.x1 = x - width / 2;
            ann.y1 = y - height / 2;
            ann.x2 = ann.x1 + width;
            ann.y2 = ann.y1 + height;
            
            // 画像の境界内に収める
            this.constrainAnnotation(ann);
            
            this.redraw();
        }
    }
    
    /**
     * マウスアップイベントハンドラ
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseUp(e) {
        e.preventDefault();
        
        if (this.mode === 'create' && this.isDrawing) {
            // 描画終了、バウンディングボックスを確定
            this.isDrawing = false;
            
            // 最小サイズ以上の場合のみ追加
            if (Math.abs(this.currentX - this.startX) > 5 && Math.abs(this.currentY - this.startY) > 5) {
                // 履歴に保存
                this.saveToHistory();
                
                // 新しいアノテーションを追加
                const [x1, y1, x2, y2] = this.normalizeCoordinates(
                    this.startX, this.startY, this.currentX, this.currentY
                );
                
                this.annotations.push({
                    x1, y1, x2, y2,
                    class: this.currentClass
                });
                
                this.redraw();
            }
        } else if (this.mode === 'edit' && this.selectedAnnotation !== -1) {
            // 編集終了、履歴に保存
            this.saveToHistory();
        }
    }
    
    /**
     * マウスアウトイベントハンドラ
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseOut(e) {
        // マウスがキャンバス外に出た場合、描画終了
        if (this.isDrawing) {
            this.handleMouseUp(e);
        }
    }
    
    /**
     * タッチ開始イベントハンドラ
     * @param {TouchEvent} e - タッチイベント
     */
    handleTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                buttons: 1
            });
            this.handleMouseDown(mouseEvent);
        }
    }
    
    /**
     * タッチ移動イベントハンドラ
     * @param {TouchEvent} e - タッチイベント
     */
    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                buttons: 1
            });
            this.handleMouseMove(mouseEvent);
        }
    }
    
    /**
     * タッチ終了イベントハンドラ
     * @param {TouchEvent} e - タッチイベント
     */
    handleTouchEnd(e) {
        e.preventDefault();
        
        const mouseEvent = new MouseEvent('mouseup', {});
        this.handleMouseUp(mouseEvent);
    }
    
    /**
     * キーダウンイベントハンドラ
     * @param {KeyboardEvent} e - キーボードイベント
     */
    handleKeyDown(e) {
        // Deleteキー: 選択されたアノテーションを削除
        if (e.key === 'Delete' && this.selectedAnnotation !== -1) {
            // 履歴に保存
            this.saveToHistory();
            
            // アノテーションを削除
            this.annotations.splice(this.selectedAnnotation, 1);
            this.selectedAnnotation = -1;
            this.redraw();
        }
        
        // Ctrl+Z: 元に戻す
        if (e.ctrlKey && e.key === 'z') {
            this.undo();
        }
        
        // Ctrl+Y: やり直し
        if (e.ctrlKey && e.key === 'y') {
            this.redo();
        }
    }
    
    /**
     * 履歴に現在の状態を保存
     */
    saveToHistory() {
        // 現在位置より後の履歴を削除
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 深いコピーを作成
        const annotationsCopy = JSON.parse(JSON.stringify(this.annotations));
        
        // 履歴に追加
        this.history.push(annotationsCopy);
        this.historyIndex = this.history.length - 1;
        
        // 履歴が長すぎる場合、古いものを削除
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * 元に戻す
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedAnnotation = -1;
            this.redraw();
        }
    }
    
    /**
     * やり直し
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedAnnotation = -1;
            this.redraw();
        }
    }
    
    /**
     * 座標を正規化（左上から右下の形式に）
     * @param {number} x1 - 開始X座標
     * @param {number} y1 - 開始Y座標
     * @param {number} x2 - 終了X座標
     * @param {number} y2 - 終了Y座標
     * @returns {Array} 正規化された座標 [x1, y1, x2, y2]
     */
    normalizeCoordinates(x1, y1, x2, y2) {
        return [
            Math.min(x1, x2),
            Math.min(y1, y2),
            Math.max(x1, x2),
            Math.max(y1, y2)
        ];
    }
    
    /**
     * アノテーションを画像の境界内に収める
     * @param {Object} ann - アノテーション
     */
    constrainAnnotation(ann) {
        // X座標を境界内に収める
        if (ann.x1 < 0) {
            const width = ann.x2 - ann.x1;
            ann.x1 = 0;
            ann.x2 = ann.x1 + width;
        }
        if (ann.x2 > this.canvas.width) {
            const width = ann.x2 - ann.x1;
            ann.x2 = this.canvas.width;
            ann.x1 = ann.x2 - width;
        }
        
        // Y座標を境界内に収める
        if (ann.y1 < 0) {
            const height = ann.y2 - ann.y1;
            ann.y1 = 0;
            ann.y2 = ann.y1 + height;
        }
        if (ann.y2 > this.canvas.height) {
            const height = ann.y2 - ann.y1;
            ann.y2 = this.canvas.height;
            ann.y1 = ann.y2 - height;
        }
    }
    
    /**
     * 指定した座標にあるアノテーションを探す
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {number} アノテーションのインデックス、見つからない場合は-1
     */
    findAnnotationAt(x, y) {
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            if (x >= ann.x1 && x <= ann.x2 && y >= ann.y1 && y <= ann.y2) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * キャンバスを再描画
     */
    redraw() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 画像を描画
        if (this.image) {
            this.ctx.drawImage(this.image, 0, 0);
        }
        
        // すべてのアノテーションを描画
        for (let i = 0; i < this.annotations.length; i++) {
            const ann = this.annotations[i];
            const isSelected = i === this.selectedAnnotation;
            this.drawAnnotation(ann, isSelected);
        }
    }
    
    /**
     * 一時的なバウンディングボックスを描画
     */
    drawTempBox() {
        const [x1, y1, x2, y2] = this.normalizeCoordinates(
            this.startX, this.startY, this.currentX, this.currentY
        );
        
        // 点線で描画
        this.ctx.strokeStyle = this.classes[this.currentClass].color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.setLineDash([]);
    }
    
    /**
     * アノテーションを描画
     * @param {Object} ann - アノテーション
     * @param {boolean} isSelected - 選択されているかどうか
     */
    drawAnnotation(ann, isSelected = false) {
        const classInfo = this.classes[ann.class] || this.classes[0];
        
        // バウンディングボックスを描画
        this.ctx.strokeStyle = isSelected ? 'rgba(255, 255, 0, 0.9)' : classInfo.color;
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        // 半透明の塗りつぶし
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 87, 34, 0.1)';
        this.ctx.fillRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        // ラベルを描画
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.9)' : classInfo.color;
        this.ctx.fillText(classInfo.name, ann.x1, ann.y1 - 5);
        
        // 選択されている場合は制御点を描画
        if (isSelected) {
            this.drawControlPoints(ann);
        }
    }
    
    /**
     * 制御点を描画
     * @param {Object} ann - アノテーション
     */
    drawControlPoints(ann) {
        const points = [
            { x: ann.x1, y: ann.y1 }, // 左上
            { x: ann.x2, y: ann.y1 }, // 右上
            { x: ann.x1, y: ann.y2 }, // 左下
            { x: ann.x2, y: ann.y2 }  // 右下
        ];
        
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
        this.ctx.lineWidth = 1;
        
        for (const point of points) {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
    
    /**
     * アノテーションを読み込み
     * @param {Array} annotations - アノテーション配列
     */
    loadAnnotations(annotations) {
        this.annotations = annotations;
        this.selectedAnnotation = -1;
        this.redraw();
        
        // 履歴をクリア
        this.history = [JSON.parse(JSON.stringify(annotations))];
        this.historyIndex = 0;
    }
    
    /**
     * YOLOファイルからアノテーションを読み込み
     * @param {string} yoloText - YOLO形式のテキスト
     */
    loadFromYoloFormat(yoloText) {
        const lines = yoloText.trim().split('\n');
        const imgWidth = this.canvas.width;
        const imgHeight = this.canvas.height;
        
        const annotations = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                const parts = line.trim().split(/\s+/);
                if (parts.length !== 5) continue;
                
                const classId = parseInt(parts[0]);
                const centerX = parseFloat(parts[1]) * imgWidth;
                const centerY = parseFloat(parts[2]) * imgHeight;
                const width = parseFloat(parts[3]) * imgWidth;
                const height = parseFloat(parts[4]) * imgHeight;
                
                // 中心座標から左上と右下の座標を計算
                const x1 = centerX - width / 2;
                const y1 = centerY - height / 2;
                const x2 = centerX + width / 2;
                const y2 = centerY + height / 2;
                
                annotations.push({
                    x1, y1, x2, y2,
                    class: classId
                });
            } catch (e) {
                console.error('YOLOフォーマットの解析エラー:', e);
            }
        }
        
        this.loadAnnotations(annotations);
    }
    
    /**
     * アノテーションをYOLO形式に変換
     * @returns {string} YOLO形式のテキスト
     */
    exportToYoloFormat() {
        const imgWidth = this.canvas.width;
        const imgHeight = this.canvas.height;
        
        const lines = this.annotations.map(ann => {
            // バウンディングボックスの中心座標と幅・高さを計算
            const centerX = (ann.x1 + ann.x2) / 2 / imgWidth;
            const centerY = (ann.y1 + ann.y2) / 2 / imgHeight;
            const width = (ann.x2 - ann.x1) / imgWidth;
            const height = (ann.y2 - ann.y1) / imgHeight;
            
            // YOLO形式の文字列を生成
            return `${ann.class} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
        });
        
        return lines.join('\n');
    }
    
    /**
     * 自動検出されたバウンディングボックスを読み込み
     * @param {Array} boxes - バウンディングボックス配列
     */
    loadAutoDetectedBoxes(boxes) {
        // 履歴に保存
        this.saveToHistory();
        
        // バウンディングボックスを追加
        for (const box of boxes) {
            this.annotations.push({
                x1: box.x1,
                y1: box.y1,
                x2: box.x2,
                y2: box.y2,
                class: this.currentClass
            });
        }
        
        this.redraw();
    }
    
    /**
     * すべてのアノテーションを削除
     */
    clearAnnotations() {
        // 履歴に保存
        this.saveToHistory();
        
        this.annotations = [];
        this.selectedAnnotation = -1;
        this.redraw();
    }
    
    /**
     * モードを設定
     * @param {string} mode - モード（'create', 'edit', 'delete'）
     */
    setMode(mode) {
        if (['create', 'edit', 'delete'].includes(mode)) {
            this.mode = mode;
            this.selectedAnnotation = -1;
            this.redraw();
        }
    }
    
    /**
     * 現在のクラスを設定
     * @param {number} classId - クラスID
     */
    setCurrentClass(classId) {
        if (classId >= 0 && classId < this.classes.length) {
            this.currentClass = classId;
        }
    }
    
    /**
     * クラスリストを設定
     * @param {Array} classes - クラスリスト
     */
    setClasses(classes) {
        this.classes = classes;
        this.redraw();
    }
}

// ===========================================================
// 画像管理関連機能
// ===========================================================

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
        // YOLOアノテーション情報を確認
        const yoloInfo = await checkYoloAnnotation(imagePath);
        
        return {
            exists: !!yoloInfo?.exists,
            yolo: yoloInfo
        };
    } catch (error) {
        console.error('アノテーション情報確認エラー:', error);
        return { exists: false };
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
        
        // ファイルの存在を確認
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
    
    const hasYoloAnnotation = annotationInfo && annotationInfo.yolo && annotationInfo.yolo.exists;
    const displayImageUrl = `/sample/${imagePath}`;
    const filename = imagePath.split('/').pop();
    
    const modalHTML = `
    <div class="modal fade" id="imageDetailModal" tabindex="-1" aria-labelledby="imageDetailModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="imageDetailModalLabel">
                        <i class="fas fa-image me-2"></i>
                        ${filename}
                        ${hasYoloAnnotation ? 
                          '<span class="badge bg-info ms-2">YOLO形式あり</span>' : 
                          '<span class="badge bg-secondary ms-2">未アノテーション</span>'}
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
                                ${hasYoloAnnotation ? `
                                    <p class="text-info"><i class="fas fa-check-circle me-1"></i> YOLO形式あり</p>
                                    <p><strong>YOLOラベル:</strong><br><code>${annotationInfo.yolo.path}</code></p>
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
                        ${hasYoloAnnotation ? `
                            <button type="button" class="btn btn-outline-warning" id="editYoloAnnotationBtn">
                                <i class="fas fa-edit me-1"></i> YOLOアノテーション編集
                            </button>
                            <button type="button" class="btn btn-outline-danger" id="deleteYoloAnnotationBtn">
                                <i class="fas fa-trash me-1"></i> YOLOアノテーション削除
                            </button>
                        ` : `
                            <button type="button" class="btn btn-success" id="createYoloAnnotationBtn">
                                <i class="fas fa-plus me-1"></i> YOLOアノテーション作成
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
    const hasYoloAnnotation = annotationInfo && annotationInfo.yolo && annotationInfo.yolo.exists;
    
    // YOLOアノテーション作成ボタン
    const createYoloBtn = document.getElementById('createYoloAnnotationBtn');
    if (createYoloBtn) {
        createYoloBtn.addEventListener('click', function() {
            // モーダルを閉じる
            bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
            // YOLOアノテーションモーダルを開く
            setTimeout(() => createYoloAnnotationModal(imagePath), 300);
        });
    }
    
    // YOLOアノテーション編集ボタン
    const editYoloBtn = document.getElementById('editYoloAnnotationBtn');
    if (editYoloBtn && hasYoloAnnotation) {
        editYoloBtn.addEventListener('click', async function() {
            try {
                // YOLOデータの取得
                const response = await fetch(`/yolo/get-annotation?path=${encodeURIComponent(imagePath)}`);
                if (!response.ok) throw new Error('アノテーションデータの取得に失敗しました');
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // モーダルを閉じる
                bootstrap.Modal.getInstance(document.getElementById('imageDetailModal')).hide();
                
                // YOLOアノテーション編集モーダルを開く
                setTimeout(() => createYoloAnnotationModal(imagePath, true, data.yolo_data), 300);
                
            } catch (error) {
                showErrorMessage('アノテーションの読み込みに失敗しました: ' + error.message);
            }
        });
    }
    
    // YOLOアノテーション削除ボタン
    const deleteYoloBtn = document.getElementById('deleteYoloAnnotationBtn');
    if (deleteYoloBtn && hasYoloAnnotation) {
        deleteYoloBtn.addEventListener('click', function() {
            deleteYoloAnnotation(imagePath, annotationInfo);
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
 * YOLOアノテーションの削除
 * @param {string} imagePath - 画像パス
 * @param {Object} annotationInfo - アノテーション情報
 */
async function deleteYoloAnnotation(imagePath, annotationInfo) {
    if (!confirm('このYOLOアノテーションを削除してもよろしいですか？')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/yolo/delete-annotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                image_path: imagePath
            })
        });
        
        if (!response.ok) throw new Error('削除リクエストに失敗しました');
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 成功メッセージ
        showSuccessMessage('YOLOアノテーションを削除しました');
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageDetailModal'));
        if (modal) modal.hide();
        
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

// ===========================================================
// グローバルエクスポート
// ===========================================================

/**
 * グローバルエクスポートのためのラッパー
 */
export function setupAnnotationTools() {
    window.selectImageForAnnotation = openImageDetailModal;
    window.openImageDetailModal = openImageDetailModal;
    window.createYoloAnnotationModal = createYoloAnnotationModal;
    window.showQuickDeleteConfirm = showQuickDeleteConfirm;
    window.deleteImage = deleteImage;
}

/**
 * YOLO関連機能のセットアップ
 */
export function setupYoloAnnotator() {
    window.createYoloAnnotationModal = createYoloAnnotationModal;
    window.YoloAnnotator = YoloAnnotator;
}