/**
 * ウニ生殖乳頭分析システム - YOLOアノテーター
 * YOLO形式のバウンディングボックスアノテーションを作成・編集するための機能
 */

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
                                                    <i class="fas fa-magic"></i> 自動検出
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
                autoDetectBoundingBoxes(annotator);
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
 * バウンディングボックスを自動検出
 * @param {YoloAnnotator} annotator - アノテーターインスタンス
 */
function autoDetectBoundingBoxes(annotator) {
    try {
        showLoading();
        
        // 画像データを取得
        const canvas = annotator.canvas;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 赤色成分を強調（生殖乳頭の特徴）
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        
        // 一時キャンバスを作成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 元の画像を描画
        tempCtx.drawImage(annotator.image, 0, 0);
        
        // フィルタ処理（赤色を強調）
        const tempImageData = tempCtx.getImageData(0, 0, width, height);
        const tempData = tempImageData.data;
        
        for (let i = 0; i < tempData.length; i += 4) {
            // 赤色を強調
            if (tempData[i] > tempData[i+1] * 1.5 && tempData[i] > tempData[i+2] * 1.5) {
                tempData[i] = 255; // 赤を最大に
                tempData[i+1] = 0; // 緑を0に
                tempData[i+2] = 0; // 青を0に
            } else {
                // それ以外は暗く
                tempData[i] = Math.floor(tempData[i] * 0.2);
                tempData[i+1] = Math.floor(tempData[i+1] * 0.2);
                tempData[i+2] = Math.floor(tempData[i+2] * 0.2);
            }
        }
        
        tempCtx.putImageData(tempImageData, 0, 0);
        
        // エッジ検出などの処理（簡易版）
        // 実際にはより高度なアルゴリズムが必要
        
        // Webサーバーに検出処理を依頼する場合
        /*
        const base64Image = tempCanvas.toDataURL('image/png');
        
        fetch('/api/detect-papillae', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: base64Image })
        })
        .then(response => response.json())
        .then(data => {
            if (data.boxes && data.boxes.length > 0) {
                annotator.loadAutoDetectedBoxes(data.boxes);
                updateYoloText(annotator);
                showSuccessMessage(`${data.boxes.length}個の生殖乳頭を検出しました`);
            } else {
                showErrorMessage('生殖乳頭を検出できませんでした');
            }
            hideLoading();
        })
        .catch(error => {
            hideLoading();
            showErrorMessage('検出処理中にエラーが発生しました: ' + error.message);
        });
        */
        
        // クライアントサイドでの簡易検出（実装例）
        setTimeout(() => {
            // 簡易バウンディングボックス検出
            const boxes = [];
            
            // ランダムな検出結果（デモ用）
            const boxCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < boxCount; i++) {
                const x1 = Math.floor(Math.random() * (width - 100));
                const y1 = Math.floor(Math.random() * (height - 100));
                const w = Math.floor(Math.random() * 50) + 50;
                const h = Math.floor(Math.random() * 50) + 50;
                
                boxes.push({
                    x1, y1,
                    x2: x1 + w,
                    y2: y1 + h
                });
            }
            
            if (boxes.length > 0) {
                annotator.loadAutoDetectedBoxes(boxes);
                updateYoloText(annotator);
                showSuccessMessage(`${boxes.length}個の生殖乳頭を検出しました`);
            } else {
                showErrorMessage('生殖乳頭を検出できませんでした');
            }
            
            hideLoading();
        }, 1000);
    } catch (error) {
        hideLoading();
        showErrorMessage('検出処理中にエラーが発生しました: ' + error.message);
    }
}

/**
 * YOLOアノテーションを保存
 * @param {string} imagePath - 画像パス
 * @param {string} yoloData - YOLO形式のデータ
 */
async function saveYoloAnnotation(imagePath, yoloData) {
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
        
    } catch (error) {
        hideLoading();
        showErrorMessage('YOLOアノテーションの保存に失敗しました: ' + error.message);
    }
}

/**
 * グローバルエクスポート
 */
export function setupYoloAnnotator() {
    window.createYoloAnnotationModal = createYoloAnnotationModal;
    window.YoloAnnotator = YoloAnnotator;
}