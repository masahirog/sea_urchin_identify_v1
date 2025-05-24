/**
 ウニ生殖乳頭分析システム - アノテーション管理
 * 画像アノテーション機能の中核部分
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
 * アノテーション管理クラス
 */
export class AnnotationManager {
    constructor() {
        this.annotationModalId = 'imageDetailModal';
        this.callbacks = {
            onSaved: null,
            onDeleted: null
        };
    }

    /**
     * コールバック設定
     * @param {Object} callbacks - コールバック関数のオブジェクト
     */
    setCallbacks(callbacks) {
        Object.assign(this.callbacks, callbacks);
    }

    /**
     * 画像詳細モーダルを開く
     * @param {string} imagePath - 画像パス
     */
    async openImageDetailModal(imagePath) {
        try {
            const annotationInfo = await this.checkExistingAnnotation(imagePath);
            this.createImageDetailModal(imagePath, annotationInfo);
        } catch (error) {
            this.createImageDetailModal(imagePath, null);
        }
    }

    /**
     * 既存のアノテーション情報を確認
     * @param {string} imagePath - 画像パス
     * @returns {Promise<Object>} アノテーション情報
     */
    async checkExistingAnnotation(imagePath) {
        try {
            const filename = imagePath.split('/').pop();
            const basename = filename.split('.')[0];
            const labelPath = `data/yolo_dataset/labels/train/${basename}.txt`;
            
            const response = await fetch(`/api/check-file?path=${encodeURIComponent(labelPath)}`);
            const data = await response.json();
            
            return {
                exists: data.exists,
                yolo: { exists: data.exists, path: labelPath }
            };
        } catch (error) {
            console.error('アノテーション情報確認エラー:', error);
            return { exists: false };
        }
    }

    /**
     * 画像詳細モーダルを作成
     * @param {string} imagePath - 画像パス
     * @param {Object} annotationInfo - アノテーション情報
     */
    createImageDetailModal(imagePath, annotationInfo) {
        this.removeExistingModal(this.annotationModalId);
        
        const modalHTML = this.generateModalHTML(imagePath, annotationInfo);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        this.setupModalEventListeners(imagePath, annotationInfo);
        this.showModal();
    }

    /**
     * モーダルHTMLを生成
     * @param {string} imagePath - 画像パス
     * @param {Object} annotationInfo - アノテーション情報
     * @returns {string} モーダルHTML
     */
    generateModalHTML(imagePath, annotationInfo) {
        const hasYolo = annotationInfo?.yolo?.exists;
        const displayImageUrl = `/sample/${imagePath}`;
        const filename = imagePath.split('/').pop();
        const category = this.detectCategory(imagePath);
        
        const annotationButtons = hasYolo ? `
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
        `;

        return `
            <div class="modal fade" id="${this.annotationModalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-image me-2"></i>${filename}
                                ${hasYolo ? 
                                  '<span class="badge bg-info ms-2">YOLO形式あり</span>' : 
                                  '<span class="badge bg-secondary ms-2">未アノテーション</span>'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-3">
                                <img src="${displayImageUrl}" alt="${filename}" 
                                     style="max-width: 100%; max-height: 60vh;" class="img-fluid rounded">
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>ファイル情報</h6>
                                    <p><strong>ファイル名:</strong> ${filename}</p>
                                    <p><strong>カテゴリ:</strong> ${category}</p>
                                    <p><strong>パス:</strong> <code>${imagePath}</code></p>
                                </div>
                                <div class="col-md-6">
                                    <h6>アノテーション状況</h6>
                                    ${this.generateAnnotationStatus(annotationInfo)}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <div class="btn-group me-auto">${annotationButtons}</div>
                            <div class="btn-group">
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
    }

    /**
     * カテゴリを検出
     * @param {string} imagePath - 画像パス
     * @returns {string} カテゴリ名
     */
    detectCategory(imagePath) {
        if (imagePath.includes('/male/')) return 'オス';
        if (imagePath.includes('/female/')) return 'メス';
        return '不明';
    }

    /**
     * アノテーション状況HTMLを生成
     * @param {Object} annotationInfo - アノテーション情報
     * @returns {string} 状況HTML
     */
    generateAnnotationStatus(annotationInfo) {
        if (annotationInfo?.yolo?.exists) {
            return `
                <p class="text-info"><i class="fas fa-check-circle me-1"></i> YOLO形式あり</p>
                <p><strong>YOLOラベル:</strong><br><code>${annotationInfo.yolo.path}</code></p>
            `;
        }
        return `
            <p class="text-muted"><i class="fas fa-circle me-1"></i> 未アノテーション</p>
            <p class="small">アノテーションを追加すると学習精度が向上します</p>
        `;
    }

    /**
     * モーダルイベントリスナーを設定
     * @param {string} imagePath - 画像パス
     * @param {Object} annotationInfo - アノテーション情報
     */
    setupModalEventListeners(imagePath, annotationInfo) {
        const modal = document.getElementById(this.annotationModalId);
        
        // YOLOアノテーション関連
        this.setupYoloButtons(imagePath, annotationInfo);
        
        // その他のボタン
        const moveBtn = document.getElementById('moveToDatasetBtn');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => this.moveImageToDataset(imagePath));
        }
        
        const deleteBtn = document.getElementById('deleteImageBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteImage(imagePath));
        }
        
        // モーダルが閉じられたときのクリーンアップ
        modal.addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    /**
     * YOLOボタンの設定
     * @param {string} imagePath - 画像パス
     * @param {Object} annotationInfo - アノテーション情報
     */
    setupYoloButtons(imagePath, annotationInfo) {
        const createBtn = document.getElementById('createYoloAnnotationBtn');
        const editBtn = document.getElementById('editYoloAnnotationBtn');
        const deleteBtn = document.getElementById('deleteYoloAnnotationBtn');
        
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.closeModal();
                setTimeout(() => {
                    if (window.createYoloAnnotationModal) {
                        window.createYoloAnnotationModal(imagePath);
                    }
                }, 300);
            });
        }
        
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                try {
                    const data = await this.fetchYoloAnnotation(imagePath);
                    this.closeModal();
                    setTimeout(() => {
                        if (window.createYoloAnnotationModal) {
                            window.createYoloAnnotationModal(imagePath, true, data.yolo_data);
                        }
                    }, 300);
                } catch (error) {
                    showErrorMessage('アノテーションの読み込みに失敗しました: ' + error.message);
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteYoloAnnotation(imagePath, annotationInfo));
        }
    }

    /**
     * YOLOアノテーションを取得
     * @param {string} imagePath - 画像パス
     * @returns {Promise<Object>} アノテーションデータ
     */
    async fetchYoloAnnotation(imagePath) {
        const response = await fetch(`/yolo/get-annotation?path=${encodeURIComponent(imagePath)}`);
        if (!response.ok) throw new Error('アノテーションデータの取得に失敗しました');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        return data;
    }

    /**
     * YOLOアノテーションを削除
     * @param {string} imagePath - 画像パス
     * @param {Object} annotationInfo - アノテーション情報
     */
    async deleteYoloAnnotation(imagePath, annotationInfo) {
        if (!confirm('このYOLOアノテーションを削除してもよろしいですか？')) return;
        
        try {
            showLoading();
            
            const data = await apiRequest('/yolo/delete-annotation', {
                method: 'POST',
                body: JSON.stringify({ image_path: imagePath })
            });
            
            hideLoading();
            
            if (data.error) throw new Error(data.error);
            
            showSuccessMessage('YOLOアノテーションを削除しました');
            this.closeModal();
            
            if (this.callbacks.onSaved) {
                this.callbacks.onSaved();
            }
            
        } catch (error) {
            hideLoading();
            showErrorMessage('アノテーション削除に失敗しました: ' + error.message);
        }
    }

    /**
     * データセットへ画像を移動
     * @param {string} imagePath - 画像パス
     */
    async moveImageToDataset(imagePath) {
        const modal = this.createGenderSelectionModal();
        document.body.appendChild(modal);
        
        const moveModal = new bootstrap.Modal(modal);
        moveModal.show();
        
        const confirmBtn = modal.querySelector('#confirmMoveBtn');
        confirmBtn.addEventListener('click', async () => {
            const gender = modal.querySelector('input[name="genderOption"]:checked').value;
            
            try {
                showLoading();
                
                const data = await apiRequest('/learning/save-to-dataset', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        image_path: imagePath,
                        gender: gender
                    })
                });
                
                hideLoading();
                moveModal.hide();
                
                if (data.error) throw new Error(data.error);
                
                this.closeModal();
                showSuccessMessage(`画像を${gender === 'male' ? 'オス' : 'メス'}カテゴリに移動しました`);
                
                if (this.callbacks.onSaved) {
                    this.callbacks.onSaved();
                }
                
            } catch (error) {
                hideLoading();
                showErrorMessage('データセットへの移動に失敗しました: ' + error.message);
            }
        });
        
        modal.addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    /**
     * 性別選択モーダルを作成
     * @returns {HTMLElement} モーダル要素
     */
    createGenderSelectionModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="modal fade" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">データセットに移動</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>移動先カテゴリを選択してください:</p>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="genderOption" 
                                       id="genderMale" value="male" checked>
                                <label class="form-check-label" for="genderMale">
                                    <i class="fas fa-mars text-primary"></i> オス
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="genderOption" 
                                       id="genderFemale" value="female">
                                <label class="form-check-label" for="genderFemale">
                                    <i class="fas fa-venus text-danger"></i> メス
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
                            <button type="button" class="btn btn-primary" id="confirmMoveBtn">移動する</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return modal.firstElementChild;
    }

    /**
     * 画像を削除
     * @param {string} imagePath - 画像パス
     */
    async deleteImage(imagePath) {
        const filename = imagePath.split('/').pop();
        
        if (!confirm(`「${filename}」を削除してもよろしいですか？\n\nアノテーションがある場合は一緒に削除されます。`)) {
            return;
        }
        
        try {
            showLoading();
            
            const data = await apiRequest('/learning/delete-data', {
                method: 'POST',
                body: JSON.stringify({ path: imagePath })
            });
            
            hideLoading();
            
            if (data.error) throw new Error(data.error);
            
            showSuccessMessage(data.message);
            this.closeModal();
            
            if (this.callbacks.onDeleted) {
                this.callbacks.onDeleted();
            }
            
        } catch (error) {
            hideLoading();
            showErrorMessage('削除中にエラーが発生しました: ' + error.message);
        }
    }

    /**
     * 既存のモーダルを削除
     * @param {string} modalId - モーダルID
     */
    removeExistingModal(modalId) {
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
    }

    /**
     * モーダルを表示
     */
    showModal() {
        const modal = new bootstrap.Modal(document.getElementById(this.annotationModalId));
        modal.show();
    }

    /**
     * モーダルを閉じる
     */
    closeModal() {
        const modalElement = document.getElementById(this.annotationModalId);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
    }
}

// シングルトンインスタンス
const annotationManager = new AnnotationManager();

// グローバル関数として公開
window.openImageDetailModal = (imagePath) => annotationManager.openImageDetailModal(imagePath);
window.selectImageForAnnotation = window.openImageDetailModal;
window.showQuickDeleteConfirm = (imagePath) => {
    const filename = imagePath.split('/').pop();
    if (confirm(`「${filename}」を削除してもよろしいですか？\n\nアノテーションがある場合は一緒に削除されます。`)) {
        annotationManager.deleteImage(imagePath);
    }
};
window.deleteImage = (imagePath) => annotationManager.deleteImage(imagePath);

// アノテーションコールバック設定
annotationManager.setCallbacks({
    onSaved: () => {
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.dataManager.refreshDatasetStats();
            window.unifiedLearningSystem.dataManager.loadLearningData();
        }
    },
    onDeleted: () => {
        if (window.unifiedLearningSystem) {
            window.unifiedLearningSystem.dataManager.refreshDatasetStats();
            window.unifiedLearningSystem.dataManager.loadLearningData();
        }
    }
});

export default annotationManager;
