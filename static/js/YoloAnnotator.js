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
        this.isMoving = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;

        // 移動用の初期位置記録
        this.moveStartX = 0;
        this.moveStartY = 0;
        this.originalBox = null;
        
        // モード
        this.mode = 'create';
        
        // クラス情報
        this.classes = [
            { id: 0, name: '雄の生殖乳頭', color: 'rgba(33, 150, 243, 0.8)' },
            { id: 1, name: '雌の生殖乳頭', color: 'rgba(244, 67, 54, 0.8)' },
            { id: 2, name: '多孔板', color: 'rgba(76, 175, 80, 0.8)' }
        ];
        this.currentClass = 0;
        
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
            // 編集モード（選択・移動）
            const index = this.findAnnotationAt(x, y);
            if (index !== -1) {
                this.selectedAnnotation = index;
                this.isMoving = true;
                this.moveStartX = x;
                this.moveStartY = y;
                // 元のボックス位置を保存
                const ann = this.annotations[index];
                this.originalBox = {
                    x1: ann.x1,
                    y1: ann.y1,
                    x2: ann.x2,
                    y2: ann.y2
                };
                this.redraw();
            } else {
                this.selectedAnnotation = -1;
                this.redraw();
            }
        } else if (this.mode === 'delete') {
            const index = this.findAnnotationAt(x, y);
            if (index !== -1) {
                this.annotations.splice(index, 1);
                this.selectedAnnotation = -1;
                this.redraw();
                if (this.onAnnotationsChanged) {
                    this.onAnnotationsChanged();
                }
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
        } else if (this.mode === 'edit' && this.isMoving && this.selectedAnnotation !== -1) {
            // ボックスを移動
            const dx = x - this.moveStartX;
            const dy = y - this.moveStartY;
            
            const ann = this.annotations[this.selectedAnnotation];
            const width = ann.x2 - ann.x1;
            const height = ann.y2 - ann.y1;
            
            // 新しい位置を計算（originalBoxから計算するのではなく、現在位置から計算）
            let newX1 = this.originalBox.x1 + dx;
            let newY1 = this.originalBox.y1 + dy;
            let newX2 = newX1 + width;
            let newY2 = newY1 + height;
            
            // キャンバスの境界内に制限
            if (newX1 < 0) {
                newX1 = 0;
                newX2 = width;
            }
            if (newY1 < 0) {
                newY1 = 0;
                newY2 = height;
            }
            if (newX2 > this.canvas.width) {
                newX2 = this.canvas.width;
                newX1 = this.canvas.width - width;
            }
            if (newY2 > this.canvas.height) {
                newY2 = this.canvas.height;
                newY1 = this.canvas.height - height;
            }
            
            // 位置を更新
            ann.x1 = newX1;
            ann.y1 = newY1;
            ann.x2 = newX2;
            ann.y2 = newY2;
            
            this.redraw();
        } else if (this.mode === 'edit') {
            // カーソルの変更（ホバー時）
            const index = this.findAnnotationAt(x, y);
            this.canvas.style.cursor = index !== -1 ? 'move' : 'default';
        }
    }
    
    handleMouseUp(e) {
        e.preventDefault();
        
        if (this.mode === 'create' && this.isDrawing) {
            this.isDrawing = false;
            
            if (Math.abs(this.currentX - this.startX) > 5 && Math.abs(this.currentY - this.startY) > 5) {
                
                const [x1, y1, x2, y2] = this.normalizeCoordinates(
                    this.startX, this.startY, this.currentX, this.currentY
                );
                
                this.annotations.push({ x1, y1, x2, y2, class: this.currentClass });
                this.redraw();

                if (this.onAnnotationsChanged) {
                    this.onAnnotationsChanged();
                }
            }
        } else if (this.mode === 'edit' && this.isMoving) {
            // 移動完了
            this.isMoving = false;
            if (this.originalBox) {
                // 実際に移動があった場合のみ変更通知
                const ann = this.annotations[this.selectedAnnotation];
                const moved = ann.x1 !== this.originalBox.x1 || 
                             ann.y1 !== this.originalBox.y1 ||
                             ann.x2 !== this.originalBox.x2 ||
                             ann.y2 !== this.originalBox.y2;
                
                if (moved && this.onAnnotationsChanged) {
                    this.onAnnotationsChanged();
                }
            }
            this.originalBox = null;
            this.moveStartX = 0;
            this.moveStartY = 0;
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
            this.annotations.splice(this.selectedAnnotation, 1);
            this.selectedAnnotation = -1;
            this.redraw();

            // コールバック実行
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
        // クリック位置の周囲5ピクセルまで許容
        const tolerance = 5;
        
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            
            // バウンディングボックスの境界線上も含めて判定
            const onBorder = (
                // 上下の境界線
                (Math.abs(y - ann.y1) <= tolerance || Math.abs(y - ann.y2) <= tolerance) &&
                (x >= ann.x1 - tolerance && x <= ann.x2 + tolerance)
            ) || (
                // 左右の境界線
                (Math.abs(x - ann.x1) <= tolerance || Math.abs(x - ann.x2) <= tolerance) &&
                (y >= ann.y1 - tolerance && y <= ann.y2 + tolerance)
            );
            
            // 内部またはボーダー上にある場合
            const inside = x >= ann.x1 && x <= ann.x2 && y >= ann.y1 && y <= ann.y2;
            
            if (inside || onBorder) {
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
        
        // プレビュー用の点線ボックス
        this.ctx.strokeStyle = this.classes[this.currentClass].color;
        this.ctx.lineWidth = 4;  // 太く
        this.ctx.setLineDash([8, 4]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.setLineDash([]);
        
        // サイズ表示
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.font = '12px Arial';
        const sizeText = `${Math.round(width)} × ${Math.round(height)}`;
        const textMetrics = this.ctx.measureText(sizeText);
        this.ctx.fillRect(x1, y1 - 20, textMetrics.width + 8, 18);
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(sizeText, x1 + 4, y1 - 6);
    }
    
    drawAnnotation(ann, isSelected = false) {
        const classInfo = this.classes[ann.class] || this.classes[0];
        
        // 影を追加して線を強調
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // メインの線（さらに太く）
        this.ctx.strokeStyle = isSelected ? 'rgba(255, 255, 0, 1)' : classInfo.color;
        this.ctx.lineWidth = isSelected ? 8 : 6;  // 6→8, 4→6に変更
        this.ctx.strokeRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        // 影をリセット
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // 選択時の追加ハイライト
        if (isSelected) {
            // 外側の枠（点線）
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(ann.x1 - 4, ann.y1 - 4, ann.x2 - ann.x1 + 8, ann.y2 - ann.y1 + 8);
            this.ctx.setLineDash([]);
            
            // コーナーハンドル（リサイズ用・将来実装）
            this.drawCornerHandles(ann);
        }
        
        // 塗りつぶし（軽く）
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.1)' : classInfo.color.replace('0.8', '0.1');
        this.ctx.fillRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
        
        // ラベル表示の改善
        this.drawLabel(ann, classInfo, isSelected);
    }
    drawLabel(ann, classInfo, isSelected) {
        const label = classInfo.name;
        this.ctx.font = 'bold 16px Arial';  // フォントサイズを大きく
        const metrics = this.ctx.measureText(label);
        const labelHeight = 22;
        const padding = 6;
        
        // ラベルの位置（ボックスの上に配置）
        let labelX = ann.x1;
        let labelY = ann.y1 - labelHeight - 4;
        
        // 画面上部からはみ出す場合は内側に配置
        if (labelY < 0) {
            labelY = ann.y1 + 4;
        }
        
        // ラベル背景（角丸）
        this.ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';
        this.roundRect(labelX, labelY, metrics.width + padding * 2, labelHeight, 4);
        this.ctx.fill();
        
        // ラベルテキスト
        this.ctx.fillStyle = isSelected ? 'black' : 'white';
        this.ctx.fillText(label, labelX + padding, labelY + labelHeight - 6);
    }
    // コーナーハンドルの描画（将来的なリサイズ機能用）
    drawCornerHandles(ann) {
        const handleSize = 8;
        const handles = [
            { x: ann.x1, y: ann.y1 },  // 左上
            { x: ann.x2, y: ann.y1 },  // 右上
            { x: ann.x1, y: ann.y2 },  // 左下
            { x: ann.x2, y: ann.y2 }   // 右下
        ];
        
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.lineWidth = 2;
        
        handles.forEach(handle => {
            this.ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
            this.ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        });
    }
    
    // 角丸矩形を描画するヘルパーメソッド
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
    
    loadAnnotations(annotations) {
        this.annotations = annotations;
        this.selectedAnnotation = -1;
        this.redraw();
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
    
    setMode(mode) {
        if (['create', 'edit', 'delete'].includes(mode)) {
            this.mode = mode;
            this.selectedAnnotation = -1;
            this.isMoving = false;
            this.redraw();
            
            // カーソルの変更
            if (mode === 'create') {
                this.canvas.style.cursor = 'crosshair';
            } else if (mode === 'edit') {
                this.canvas.style.cursor = 'default';
            } else if (mode === 'delete') {
                this.canvas.style.cursor = 'pointer';
            }
        }
    }
    
    setCurrentClass(classId) {
        if (classId >= 0 && classId < this.classes.length) {
            this.currentClass = classId;
        }
    }
}