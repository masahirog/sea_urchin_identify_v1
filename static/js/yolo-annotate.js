/**
 * YOLOアノテーションページ用スクリプト
 */

import { YoloAnnotator } from './learning/YoloAnnotator.js';
import { 
    showLoading, 
    hideLoading, 
    showSuccessMessage, 
    showErrorMessage,
    apiRequest 
} from './utilities.js';

class YoloAnnotationPage {
    constructor() {
        this.annotator = null;
        this.currentImageId = null;
    }

    async initialize() {
        // 要素の取得
        this.elements = {
            canvas: document.getElementById('annotation-canvas'),
            image: document.getElementById('annotation-image'),
            imageSelector: document.getElementById('image-selector'),
            noImageMessage: document.getElementById('no-image-message'),
            annotationList: document.getElementById('annotation-list')
        };
        
        // 画像リストの読み込み
        await this.loadImageList();
        
        // イベントリスナーの設定
        this.setupEventListeners();
    }

    async loadImageList() {
        try {
            const data = await apiRequest('/yolo/api/images');
            
            if (data.status === 'success' && data.images) {
                this.elements.imageSelector.innerHTML = '<option value="">-- 画像を選択 --</option>';
                
                data.images.forEach(img => {
                    const option = document.createElement('option');
                    option.value = img.id;
                    option.textContent = img.filename;
                    option.dataset.url = img.url;
                    this.elements.imageSelector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('画像リスト取得エラー:', error);
            showErrorMessage('画像リストの取得中にエラーが発生しました。');
        }
    }

    setupEventListeners() {
        // 画像セレクター
        this.elements.imageSelector.addEventListener('change', (e) => this.handleImageSelection(e));
        
        // ツールボタン
        this.setupToolButtons();
        
        // アクションボタン
        this.setupActionButtons();
    }

    async handleImageSelection(event) {
        const selectedOption = event.target.options[event.target.selectedIndex];
        
        if (!selectedOption.value) {
            this.clearCanvas();
            return;
        }
        
        this.currentImageId = selectedOption.value;
        await this.loadImage(selectedOption.dataset.url);
    }

    async loadImage(url) {
        this.elements.image.src = url;
        this.elements.image.style.display = 'block';
        this.elements.noImageMessage.style.display = 'none';
        
        this.elements.image.onload = () => {
            // キャンバスサイズの設定
            this.elements.canvas.width = this.elements.image.width;
            this.elements.canvas.height = this.elements.image.height;
            
            // アノテーターの初期化
            this.annotator = new YoloAnnotator(this.elements.canvas, this.elements.image);
            this.annotator.setMode('create');
            this.annotator.onAnnotationsChanged = () => this.updateAnnotationList();
            
            // アノテーションの読み込み
            this.loadAnnotations(this.currentImageId);
        };
    }

    async loadAnnotations(imageId) {
        if (!this.annotator) return;
        
        try {
            const data = await apiRequest(`/yolo/api/annotations/${imageId}`);
            
            if (data.annotations) {
                this.annotator.loadAnnotations(data.annotations);
            } else {
                this.annotator.clearAnnotations();
            }
            
            this.updateAnnotationList();
        } catch (error) {
            console.error('アノテーション読み込みエラー:', error);
            this.annotator.clearAnnotations();
            this.updateAnnotationList();
        }
    }

    setupToolButtons() {
        const buttons = {
            'createTool': 'create',
            'editTool': 'edit',
            'deleteTool': 'delete'
        };
        
        Object.entries(buttons).forEach(([id, mode]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    if (this.annotator) {
                        this.annotator.setMode(mode);
                        this.updateToolButtons(id);
                    }
                });
            }
        });
    }

    setupActionButtons() {
        const actions = {
            'save-btn': () => this.saveAnnotations(),
            'undo-btn': () => {
                if (this.annotator) {
                    this.annotator.undo();
                    this.updateAnnotationList();
                }
            },
            'clear-btn': () => {
                if (this.annotator && confirm('すべてのアノテーションを消去しますか？')) {
                    this.annotator.clearAnnotations();
                    this.updateAnnotationList();
                }
            },
            'upload-btn': () => this.uploadImages()
        };
        
        Object.entries(actions).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) button.addEventListener('click', handler);
        });
    }

    updateToolButtons(activeId) {
        ['createTool', 'editTool', 'deleteTool'].forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.classList.toggle('active', id === activeId);
            }
        });
    }

    async saveAnnotations() {
        if (!this.annotator || !this.currentImageId) {
            showErrorMessage('保存する画像とアノテーションがありません。');
            return;
        }
        
        const saveModal = new bootstrap.Modal(document.getElementById('saveConfirmModal'));
        saveModal.show();
        
        // 保存確認ボタンの設定
        const confirmBtn = document.getElementById('confirm-save-btn');
        const handler = async () => {
            const convertToYolo = document.getElementById('convert-to-yolo').checked;
            await this.performSave(convertToYolo);
            saveModal.hide();
            confirmBtn.removeEventListener('click', handler);
        };
        
        confirmBtn.addEventListener('click', handler);
    }

    async performSave(convertToYolo = true) {
        try {
            showLoading();
            
            const annotations = this.annotator.annotations;
            const yoloData = this.annotator.exportToYoloFormat();
            
            const response = await apiRequest(`/yolo/api/annotations/${this.currentImageId}`, {
                method: 'POST',
                body: JSON.stringify({
                    annotations: annotations,
                    yolo_data: yoloData,
                    convert_to_yolo: convertToYolo
                })
            });
            
            hideLoading();
            
            if (response.status === 'success') {
                showSuccessMessage(convertToYolo ? 
                    'アノテーションを保存し、YOLO形式に変換しました。' : 
                    'アノテーションを保存しました。');
            } else {
                showErrorMessage('エラー: ' + response.message);
            }
        } catch (error) {
            hideLoading();
            showErrorMessage('アノテーションの保存中にエラーが発生しました。');
        }
    }

    async uploadImages() {
        const fileInput = document.getElementById('upload-images');
        if (!fileInput.files.length) {
            showErrorMessage('アップロードする画像を選択してください。');
            return;
        }
        
        const formData = new FormData();
        for (let file of fileInput.files) {
            formData.append('images[]', file);
        }
        
        try {
            showLoading('画像をアップロード中...');
            
            const response = await fetch('/yolo/upload_images', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            hideLoading();
            
            if (data.status === 'success') {
                showSuccessMessage(`${data.uploaded_count || 0}枚の画像をアップロードしました。`);
                await this.loadImageList();
                document.getElementById('upload-form').reset();
            } else {
                showErrorMessage('エラー: ' + data.message);
            }
        } catch (error) {
            hideLoading();
            showErrorMessage('画像のアップロード中にエラーが発生しました。');
        }
    }

    updateAnnotationList() {
        if (!this.annotator) {
            this.elements.annotationList.innerHTML = '<li class="list-group-item text-center text-muted">アノテーションがありません</li>';
            return;
        }
        
        const annotations = this.annotator.annotations;
        
        if (annotations.length === 0) {
            this.elements.annotationList.innerHTML = '<li class="list-group-item text-center text-muted">アノテーションがありません</li>';
            return;
        }
        
        this.elements.annotationList.innerHTML = '';
        
        annotations.forEach((ann, index) => {
            const item = this.createAnnotationListItem(ann, index);
            this.elements.annotationList.appendChild(item);
        });
    }

    createAnnotationListItem(annotation, index) {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        if (index === this.annotator.selectedAnnotation) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div>
                <span class="badge bg-primary me-2">${index + 1}</span>
                生殖乳頭
            </div>
            <button class="btn btn-sm btn-outline-danger delete-ann" data-index="${index}">削除</button>
        `;
        
        // リスト項目クリック
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-ann')) {
                this.annotator.selectAnnotation(index);
                this.updateAnnotationList();
            }
        });
        
        // 削除ボタン
        const deleteBtn = item.querySelector('.delete-ann');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.annotator.deleteAnnotation(index);
            this.updateAnnotationList();
        });
        
        return item;
    }

    clearCanvas() {
        this.currentImageId = null;
        this.elements.image.style.display = 'none';
        this.elements.noImageMessage.style.display = 'block';
        this.elements.canvas.width = 0;
        this.elements.canvas.height = 0;
        this.annotator = null;
        this.updateAnnotationList();
    }
}

// 拡張メソッドの追加
if (typeof YoloAnnotator !== 'undefined') {
    YoloAnnotator.prototype.selectAnnotation = function(index) {
        if (index >= 0 && index < this.annotations.length) {
            this.selectedAnnotation = index;
            this.redraw();
            
            if (typeof this.onAnnotationsChanged === 'function') {
                this.onAnnotationsChanged();
            }
        }
    };
    
    YoloAnnotator.prototype.deleteAnnotation = function(index) {
        if (index >= 0 && index < this.annotations.length) {
            this.saveToHistory();
            this.annotations.splice(index, 1);
            
            if (this.selectedAnnotation === index) {
                this.selectedAnnotation = -1;
            } else if (this.selectedAnnotation > index) {
                this.selectedAnnotation--;
            }
            
            this.redraw();
            
            if (typeof this.onAnnotationsChanged === 'function') {
                this.onAnnotationsChanged();
            }
        }
    };
}

// ページ初期化
document.addEventListener('DOMContentLoaded', async () => {
    const page = new YoloAnnotationPage();
    await page.initialize();
});