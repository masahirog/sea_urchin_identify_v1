/**
 * ウニ生殖乳頭分析システム - YOLOアノテータークラス
 * キャンバス上でのアノテーション機能を提供
 */

export class YoloAnnotator {
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
        
        // コールバック
        this.onAnnotationsChanged = null;
        
        // イベントリスナーの設定
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
        
        // タッチイベント
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        if (this.mode === 'create') {
            this.isDrawing = true;
            this.startX = x;
            this.startY = y;
            this.currentX = x;
            this.currentY = y;
        } else if (this.mode === 'edit') {
            this.selectedAnnotation = this.findAnnotationAt(x, y);
            this.redraw();
        } else if (this.mode === 'delete') {
            const index = this.findAnnotationAt(x, y);
            if (index !== -1) {
                this.saveToHistory();
                this.annotations.splice(index, 1);
                this.selectedAnnotation = -1;
                this.redraw();
            }
        }
    }
    
    handleMouseMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        if (this.mode === 'create' && this.isDrawing) {
            this.currentX = x;
            this.currentY = y;
            this.redraw();
            this.drawTempBox();
        }
    }
    
    handleMouseUp(e) {
        e.preventDefault();
        
        if (this.mode === 'create' && this.isDrawing) {
            this.isDrawing = false;
            
            if (Math.abs(this.currentX - this.startX) > 5 && Math.abs(this.currentY - this.startY) > 5) {
                this.saveToHistory();
                
                const [x1, y1, x2, y2] = this.normalizeCoordinates(
                    this.startX, this.startY, this.currentX, this.currentY
                );
                
                this.annotations.push({ x1, y1, x2, y2, class: this.currentClass });
                this.redraw();

                // コールバック実行
                if (this.onAnnotationsChanged) {
                    this.onAnnotationsChanged();
                }
            }
        }
    }
    
    handleMouseOut(e) {
        if (this.isDrawing) {
            this.handleMouseUp(e);
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseDown(mouseEvent);
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.handleMouseUp(new MouseEvent('mouseup'));
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' && this.selectedAnnotation !== -1) {
            this.saveToHistory();
            this.annotations.splice(this.selectedAnnotation, 1);
            this.selectedAnnotation = -1;
            this.redraw();

            // コールバック実行
            if (this.onAnnotationsChanged) {
                this.onAnnotationsChanged();
            }
        }
        
        if (e.ctrlKey && e.key === 'z') {
            this.undo();
        }
        
        if (e.ctrlKey && e.key === 'y') {
            this.redo();
        }
    }
    
    saveToHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(JSON.parse(JSON.stringify(this.annotations)));
        this.historyIndex = this.history.length - 1;
        
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedAnnotation = -1;
            this.redraw();
            if (this.onAnnotationsChanged) {
                this.onAnnotationsChanged();
            }
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedAnnotation = -1;
            this.redraw();
            if (this.onAnnotationsChanged) {
                this.onAnnotationsChanged();
            }
        }
    }
    
    normalizeCoordinates(x1, y1, x2, y2) {
        return [
            Math.min(x1, x2),
            Math.min(y1, y2),
            Math.max(x1, x2),
            Math.max(y1, y2)
        ];
    }
    
    findAnnotationAt(x, y) {
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            if (x >= ann.x1 && x <= ann.x2 && y >= ann.y1 && y <= ann.y2) {
                return i;
            }
        }
        return -1;
    }
    
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.image) {
            this.ctx.drawImage(this.image, 0, 0);
        }
        
        for (let i = 0; i < this.annotations.length; i++) {
            this.drawAnnotation(this.annotations[i], i === this.selectedAnnotation);
        }
    }
    
    drawTempBox() {
        const [x1, y1, x2, y2] = this.normalizeCoordinates(
            this.startX, this.startY, this.currentX, this.currentY
        );
        
        this.ctx.strokeStyle = this.classes[this.currentClass].color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.setLineDash([]);
    }
    
    drawAnnotation(ann, isSelected = false) {
        const classInfo = this.classes[ann.class] || this.classes[0];
        
        this.ctx.strokeStyle = isSelected ? 'rgba(255, 255, 0, 0.9)' : classInfo.color;
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 87, 34, 0.1)';
        this.ctx.fillRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.9)' : classInfo.color;
        this.ctx.fillText(classInfo.name, ann.x1, ann.y1 - 5);
    }
    
    loadAnnotations(annotations) {
        this.annotations = annotations;
        this.selectedAnnotation = -1;
        this.redraw();
        this.history = [JSON.parse(JSON.stringify(annotations))];
        this.historyIndex = 0;
    }
    
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
                
                const x1 = centerX - width / 2;
                const y1 = centerY - height / 2;
                const x2 = centerX + width / 2;
                const y2 = centerY + height / 2;
                
                annotations.push({ x1, y1, x2, y2, class: classId });
            } catch (e) {
                console.error('YOLOフォーマットの解析エラー:', e);
            }
        }
        
        this.loadAnnotations(annotations);
    }
    
    exportToYoloFormat() {
        const imgWidth = this.canvas.width;
        const imgHeight = this.canvas.height;
        
        const lines = this.annotations.map(ann => {
            const centerX = (ann.x1 + ann.x2) / 2 / imgWidth;
            const centerY = (ann.y1 + ann.y2) / 2 / imgHeight;
            const width = (ann.x2 - ann.x1) / imgWidth;
            const height = (ann.y2 - ann.y1) / imgHeight;
            
            return `${ann.class} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
        });
        
        return lines.join('\n');
    }
    
    loadAutoDetectedBoxes(boxes) {
        this.saveToHistory();
        
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
        if (this.onAnnotationsChanged) {
            this.onAnnotationsChanged();
        }
    }
    
    clearAnnotations() {
        this.saveToHistory();
        this.annotations = [];
        this.selectedAnnotation = -1;
        this.redraw();
        if (this.onAnnotationsChanged) {
            this.onAnnotationsChanged();
        }
    }
    
    setMode(mode) {
        if (['create', 'edit', 'delete'].includes(mode)) {
            this.mode = mode;
            this.selectedAnnotation = -1;
            this.redraw();
        }
    }
    
    setCurrentClass(classId) {
        if (classId >= 0 && classId < this.classes.length) {
            this.currentClass = classId;
        }
    }
}