/**
 * ウニ生殖乳頭分析システム - YOLO検出関連機能
 * アノテーションモーダルとAI検出機能
 */

import {
    showLoading,
    hideLoading,
    showSuccessMessage,
    showErrorMessage,
    showWarningMessage,
    apiRequest
} from '../utilities.js';

/**
 * YOLO検出マネージャークラス
 */
export class YoloDetector {
    constructor() {
        this.modalId = 'yoloAnnotationModal';
        this.annotator = null;
    }

    /**
     * YOLOアノテーションモーダルを作成
     * @param {string} imagePath - 画像パス
     * @param {boolean} isEdit - 編集モードかどうか
     * @param {string} yoloData - YOLO形式のデータ（編集モードの場合）
     * @returns {Promise} モーダルインスタンス
     */
    async createAnnotationModal(imagePath, isEdit = false, yoloData = null) {
        try {
            // 既存のモーダルを削除
            this.removeExistingModal();
            
            // モーダルHTMLを作成
            const modalHTML = this.generateModalHTML(isEdit);
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // 画像とアノテーターの初期化
            await this.initializeAnnotator(imagePath, isEdit, yoloData);
            
            // モーダルを表示
            const modal = new bootstrap.Modal(document.getElementById(this.modalId));
            modal.show();
            
            return { modal, annotator: this.annotator };
        } catch (error) {
            showErrorMessage('モーダルの作成に失敗しました: ' + error.message);
            throw error;
        }
    }

    /**
     * モーダルHTMLを生成
     * @param {boolean} isEdit - 編集モードかどうか
     * @returns {string} モーダルHTML
     */
    generateModalHTML(isEdit) {
        return `
        <div class="modal fade" id="${this.modalId}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            ${isEdit ? 'YOLOアノテーション編集' : 'YOLOアノテーション作成'}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-3">
                            <i class="fas fa-info-circle me-2"></i>
                            各生殖乳頭を囲むバウンディングボックスを描画してください。
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-8">
                                <div class="annotation-area">
                                    <canvas id="yoloCanvas" class="annotation-canvas"></canvas>
                                </div>
                            </div>
                            <div class="col-md-4">
                                ${this.generateToolsPanel()}
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
    }

    /**
     * ツールパネルを生成
     * @returns {string} ツールパネルHTML
     */
    generateToolsPanel() {
        return `
            <div class="card mb-3">
                <div class="card-header"><h6 class="mb-0">ツール</h6></div>
                <div class="card-body">
                    <div class="btn-group w-100 mb-3" role="group">
                        <button type="button" class="btn btn-outline-primary active" id="createTool">
                            <i class="fas fa-draw-polygon"></i> 作成
                        </button>
                        <button type="button" class="btn btn-outline-warning" id="editTool">
                            <i class="fas fa-edit"></i> 編集
                        </button>
                        <button type="button" class="btn btn-outline-danger" id="deleteTool">
                            <i class="fas fa-trash"></i> 削除
                        </button>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">クラス:</label>
                        <select id="yoloClassSelect" class="form-select">
                            <option value="0" selected>生殖乳頭</option>
                        </select>
                    </div>
                    
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
            
            <div class="card">
                <div class="card-header"><h6 class="mb-0">YOLO形式</h6></div>
                <div class="card-body">
                    <textarea id="yoloTextArea" class="form-control" rows="6" readonly></textarea>
                </div>
            </div>
        `;
    }

    /**
     * アノテーターを初期化
     * @param {string} imagePath - 画像パス
     * @param {boolean} isEdit - 編集モードかどうか
     * @param {string} yoloData - YOLO形式のデータ
     */
    async initializeAnnotator(imagePath, isEdit, yoloData) {
        const canvas = document.getElementById('yoloCanvas');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = () => {
                // キャンバスのサイズを画像に合わせる
                canvas.width = img.width;
                canvas.height = img.height;
                
                // YOLOアノテーターを初期化（別途インポートが必要）
                if (window.YoloAnnotator) {
                    this.annotator = new window.YoloAnnotator(canvas, img);
                    
                    if (isEdit && yoloData) {
                        this.annotator.loadFromYoloFormat(yoloData);
                    }
                    
                    this.annotator.redraw();
                    this.setupEventListeners(imagePath);
                    this.updateYoloText();
                    
                    resolve();
                } else {
                    reject(new Error('YoloAnnotatorクラスが見つかりません'));
                }
            };
            
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            
            // 画像のロード
            img.src = imagePath.startsWith('/') ? imagePath : `/sample/${imagePath}`;
        });
    }

    /**
     * イベントリスナーを設定
     * @param {string} imagePath - 画像パス
     */
    setupEventListeners(imagePath) {
        // ツールボタン
        const toolButtons = {
            'createTool': 'create',
            'editTool': 'edit',
            'deleteTool': 'delete'
        };
        
        Object.entries(toolButtons).forEach(([id, mode]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    this.annotator.setMode(mode);
                    this.updateToolButtons(id);
                });
            }
        });
        
        // アクションボタン
        const actionButtons = {
            'undoBtn': () => { this.annotator.undo(); this.updateYoloText(); },
            'redoBtn': () => { this.annotator.redo(); this.updateYoloText(); },
            'clearBtn': () => {
                if (confirm('すべてのアノテーションを削除してもよろしいですか？')) {
                    this.annotator.clearAnnotations();
                    this.updateYoloText();
                }
            },
            'autoDetectBtn': () => this.runAIDetection(imagePath),
            'saveYoloAnnotation': () => this.saveAnnotation(imagePath)
        };
        
        Object.entries(actionButtons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) button.addEventListener('click', handler);
        });
        
        // クラス選択
        const classSelect = document.getElementById('yoloClassSelect');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                this.annotator.setCurrentClass(parseInt(e.target.value));
            });
        }
        
        // モーダルが閉じられたときの処理
        const modal = document.getElementById(this.modalId);
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    /**
     * ツールボタンの状態を更新
     * @param {string} activeButtonId - アクティブにするボタンのID
     */
    updateToolButtons(activeButtonId) {
        ['createTool', 'editTool', 'deleteTool'].forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.classList.toggle('active', id === activeButtonId);
            }
        });
    }

    /**
     * YOLOテキストエリアを更新
     */
    updateYoloText() {
        const textArea = document.getElementById('yoloTextArea');
        if (textArea && this.annotator) {
            textArea.value = this.annotator.exportToYoloFormat();
        }
    }

    /**
     * AI自動検出を実行
     * @param {string} imagePath - 画像パス
     */
    async runAIDetection(imagePath) {
        try {
            showLoading();
            
            const data = await apiRequest('/yolo/detect-in-image', {
                method: 'POST',
                body: JSON.stringify({
                    image_path: imagePath,
                    confidence: 0.25
                })
            });
            
            hideLoading();
            
            if (data.error) {
                showErrorMessage('検出エラー: ' + data.error);
                return;
            }
            
            if (data.detections && data.detections.length > 0) {
                const boxes = data.detections.map(detection => ({
                    x1: detection.xmin,
                    y1: detection.ymin,
                    x2: detection.xmax,
                    y2: detection.ymax
                }));
                
                this.annotator.loadAutoDetectedBoxes(boxes);
                this.updateYoloText();
                showSuccessMessage(`${boxes.length}個の生殖乳頭を検出しました`);
            } else {
                showWarningMessage('生殖乳頭を検出できませんでした');
            }
        } catch (error) {
            hideLoading();
            showErrorMessage('検出処理中にエラーが発生しました: ' + error.message);
        }
    }

    /**
     * アノテーションを保存
     * @param {string} imagePath - 画像パス
     */
    async saveAnnotation(imagePath) {
        try {
            showLoading();
            
            const yoloData = this.annotator.exportToYoloFormat();
            
            const data = await apiRequest('/yolo/save-annotation', {
                method: 'POST',
                body: JSON.stringify({
                    image_path: imagePath,
                    yolo_data: yoloData
                })
            });
            
            hideLoading();
            
            if (data.error) throw new Error(data.error);
            
            showSuccessMessage('YOLOアノテーションを保存しました');
            
            // モーダルを閉じる
            const modal = bootstrap.Modal.getInstance(document.getElementById(this.modalId));
            if (modal) modal.hide();
            
            // コールバック実行
            if (window.onAnnotationSaved) {
                window.onAnnotationSaved();
            }
            
        } catch (error) {
            hideLoading();
            showErrorMessage('YOLOアノテーションの保存に失敗しました: ' + error.message);
        }
    }

    /**
     * 既存のモーダルを削除
     */
    removeExistingModal() {
        const existingModal = document.getElementById(this.modalId);
        if (existingModal) {
            existingModal.remove();
        }
    }

    /**
     * 検出モデルの情報を取得
     * @returns {Promise<Object>} モデル情報
     */
    async getModelInfo() {
        try {
            return await apiRequest('/yolo/model-info');
        } catch (error) {
            console.error('モデル情報取得エラー:', error);
            return {
                error: error.message,
                model_name: 'unknown',
                last_trained: 'unknown'
            };
        }
    }
}

// シングルトンインスタンス
const yoloDetector = new YoloDetector();

// グローバル関数として公開
window.createYoloAnnotationModal = (imagePath, isEdit, yoloData) => {
    return yoloDetector.createAnnotationModal(imagePath, isEdit, yoloData);
};

window.runAIDetection = (annotator, imagePath) => {
    yoloDetector.annotator = annotator;
    return yoloDetector.runAIDetection(imagePath);
};

window.saveYoloAnnotation = (imagePath, yoloData) => {
    return yoloDetector.saveAnnotation(imagePath);
};


export default yoloDetector;
