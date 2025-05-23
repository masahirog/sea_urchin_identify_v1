/**
 * YOLOバウンディングボックスをXY座標に変換
 * @param {Object} yoloBox - YOLO形式のバウンディングボックス（中心x, 中心y, 幅, 高さ）
 * @param {number} imgWidth - 画像の幅
 * @param {number} imgHeight - 画像の高さ
 * @returns {Object} X1Y1X2Y2形式のバウンディングボックス
 */
export function yoloToXY(yoloBox, imgWidth, imgHeight) {
    const [centerX, centerY, width, height] = yoloBox;
    
    // 中心座標と幅・高さを実際のピクセル値に変換
    const x_center = centerX * imgWidth;
    const y_center = centerY * imgHeight;
    const w = width * imgWidth;
    const h = height * imgHeight;
    
    // 左上と右下の座標を計算
    return {
        x1: Math.max(0, x_center - w / 2),
        y1: Math.max(0, y_center - h / 2),
        x2: Math.min(imgWidth, x_center + w / 2),
        y2: Math.min(imgHeight, y_center + h / 2)
    };
}

/**
 * XY座標をYOLOバウンディングボックスに変換
 * @param {Object} xyBox - X1Y1X2Y2形式のバウンディングボックス
 * @param {number} imgWidth - 画像の幅
 * @param {number} imgHeight - 画像の高さ
 * @returns {Array} YOLO形式のバウンディングボックス（中心x, 中心y, 幅, 高さ）
 */
export function xyToYolo(xyBox, imgWidth, imgHeight) {
    const { x1, y1, x2, y2 } = xyBox;
    
    // 中心座標と幅・高さを計算
    const width = (x2 - x1) / imgWidth;
    const height = (y2 - y1) / imgHeight;
    const centerX = (x1 + (x2 - x1) / 2) / imgWidth;
    const centerY = (y1 + (y2 - y1) / 2) / imgHeight;
    
    return [centerX, centerY, width, height];
}

/**
 * YOLOフォーマットの文字列を解析
 * @param {string} yoloStr - YOLO形式の文字列（"class_id center_x center_y width height"）
 * @returns {Object} 解析されたオブジェクト
 */
export function parseYoloFormat(yoloStr) {
    const parts = yoloStr.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error('不正なYOLO形式文字列です');
    }
    
    return {
        classId: parseInt(parts[0]),
        centerX: parseFloat(parts[1]),
        centerY: parseFloat(parts[2]),
        width: parseFloat(parts[3]),
        height: parseFloat(parts[4])
    };
}

/**
 * YOLOフォーマットの文字列を生成
 * @param {number} classId - クラスID
 * @param {number} centerX - 中心X座標（0-1）
 * @param {number} centerY - 中心Y座標（0-1）
 * @param {number} width - 幅（0-1）
 * @param {number} height - 高さ（0-1）
 * @returns {string} YOLO形式の文字列
 */
export function formatYolo(classId, centerX, centerY, width, height) {
    return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
}

/**
 * バウンディングボックスのIoU（Intersection over Union）を計算
 * @param {Object} box1 - 1つ目のバウンディングボックス（x1, y1, x2, y2）
 * @param {Object} box2 - 2つ目のバウンディングボックス（x1, y1, x2, y2）
 * @returns {number} IoU値（0-1）
 */
export function calculateIoU(box1, box2) {
    // 交差領域の計算
    const xOverlap = Math.max(0, Math.min(box1.x2, box2.x2) - Math.max(box1.x1, box2.x1));
    const yOverlap = Math.max(0, Math.min(box1.y2, box2.y2) - Math.max(box1.y1, box2.y1));
    const intersectionArea = xOverlap * yOverlap;
    
    // 各ボックスの面積
    const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
    const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
    
    // 合併領域の計算
    const unionArea = box1Area + box2Area - intersectionArea;
    
    // IoUの計算
    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * 画像をロードしてサイズを取得
 * @param {string} imageUrl - 画像URL
 * @returns {Promise<Object>} 画像サイズ（width, height）
 */
export function getImageDimensions(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
        img.src = imageUrl;
    });
}

/**
 * バウンディングボックスを画像上に描画
 * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
 * @param {Object} box - バウンディングボックス（x1, y1, x2, y2）
 * @param {string} label - ラベルテキスト
 * @param {string} color - 枠線の色
 * @param {number} lineWidth - 線の太さ
 */
export function drawBoundingBox(ctx, box, label = '', color = 'rgba(255, 0, 0, 0.7)', lineWidth = 2) {
    const { x1, y1, x2, y2 } = box;
    
    // ボックスの描画
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    
    // ラベルの描画（指定されている場合）
    if (label) {
        const fontSize = Math.max(12, Math.min(16, Math.floor((x2 - x1) / 10)));
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = color;
        
        // ラベル背景
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color.replace('0.7', '0.7'); // 同じ色で不透明度調整
        ctx.fillRect(x1, y1 - fontSize - 4, textWidth + 6, fontSize + 4);
        
        // ラベルテキスト
        ctx.fillStyle = 'white';
        ctx.fillText(label, x1 + 3, y1 - 4);
    }
}

/**
 * 検出結果の信頼度に基づく色を取得
 * @param {number} confidence - 信頼度（0-1）
 * @returns {string} 色のRGBA文字列
 */
export function getConfidenceColor(confidence) {
    if (confidence >= 0.7) {
        return 'rgba(40, 167, 69, 0.7)'; // 緑（高信頼度）
    } else if (confidence >= 0.5) {
        return 'rgba(255, 193, 7, 0.7)'; // 黄色（中信頼度）
    } else {
        return 'rgba(220, 53, 69, 0.7)'; // 赤（低信頼度）
    }
}

/**
 * YOLOデータセットの準備状況を確認
 * @returns {Promise<Object>} データセット情報
 */
export async function checkYoloDatasetStatus() {
    try {
        const response = await fetch('/yolo/dataset-status');
        if (!response.ok) throw new Error('データセット状態の取得に失敗しました');
        
        return await response.json();
    } catch (error) {
        console.error('YOLOデータセット確認エラー:', error);
        return {
            status: 'error',
            message: error.message,
            images: { train: 0, val: 0 },
            labels: { train: 0, val: 0 }
        };
    }
}

/**
 * ランダムなRGB色を生成
 * @param {number} alpha - 不透明度（0-1）
 * @returns {string} RGBA文字列
 */
export function getRandomColor(alpha = 0.7) {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * キャンバスからバウンディングボックスを検出
 * 赤色の輪郭を検出してバウンディングボックスに変換
 * @param {HTMLCanvasElement} canvas - キャンバス要素
 * @returns {Array<Object>} 検出されたバウンディングボックスの配列
 */
export function detectBoundingBoxesFromCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // 赤色のピクセルを検出
    const redPixels = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // 赤色のピクセル（R > G*2 かつ R > B*2 かつ R > 100）
            if (data[idx] > data[idx+1] * 2 && data[idx] > data[idx+2] * 2 && data[idx] > 100) {
                redPixels.push({ x, y });
            }
        }
    }
    
    // 赤色のピクセルがない場合は空配列を返す
    if (redPixels.length === 0) {
        return [];
    }
    
    // 連結成分を見つける（簡易版）
    const visited = new Set();
    const components = [];
    
    for (const pixel of redPixels) {
        const key = `${pixel.x},${pixel.y}`;
        if (visited.has(key)) continue;
        
        // 新しい連結成分を開始
        const component = [];
        const queue = [pixel];
        visited.add(key);
        
        // 幅優先探索
        while (queue.length > 0) {
            const current = queue.shift();
            component.push(current);
            
            // 隣接ピクセルを確認（4方向）
            const neighbors = [
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y },
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 }
            ];
            
            for (const neighbor of neighbors) {
                const nKey = `${neighbor.x},${neighbor.y}`;
                if (neighbor.x >= 0 && neighbor.x < width && 
                    neighbor.y >= 0 && neighbor.y < height && 
                    !visited.has(nKey)) {
                    
                    // 赤色のピクセルか確認
                    const idx = (neighbor.y * width + neighbor.x) * 4;
                    if (data[idx] > data[idx+1] * 2 && data[idx] > data[idx+2] * 2 && data[idx] > 100) {
                        queue.push(neighbor);
                        visited.add(nKey);
                    }
                }
            }
        }
        
        components.push(component);
    }
    
    // 各連結成分のバウンディングボックスを計算
    const boundingBoxes = components.map(component => {
        // 最小・最大のX,Y座標を見つける
        let minX = width, minY = height, maxX = 0, maxY = 0;
        
        for (const pixel of component) {
            minX = Math.min(minX, pixel.x);
            minY = Math.min(minY, pixel.y);
            maxX = Math.max(maxX, pixel.x);
            maxY = Math.max(maxY, pixel.y);
        }
        
        // 小さすぎるバウンディングボックスを除外
        const boxWidth = maxX - minX;
        const boxHeight = maxY - minY;
        
        if (boxWidth < 5 || boxHeight < 5) {
            return null;
        }
        
        return {
            x1: minX,
            y1: minY,
            x2: maxX,
            y2: maxY,
            width: boxWidth,
            height: boxHeight,
            area: boxWidth * boxHeight
        };
    }).filter(box => box !== null);
    
    // エリアでソート（大きい順）
    boundingBoxes.sort((a, b) => b.area - a.area);
    
    // IoUに基づいて重複するボックスを除去
    const finalBoxes = [];
    for (const box of boundingBoxes) {
        let shouldAdd = true;
        
        for (const existingBox of finalBoxes) {
            const iou = calculateIoU(box, existingBox);
            if (iou > 0.5) {
                shouldAdd = false;
                break;
            }
        }
        
        if (shouldAdd) {
            finalBoxes.push(box);
        }
    }
    
    return finalBoxes;
}

/**
 * 検出バウンディングボックスをYOLO形式に変換
 * @param {Array<Object>} boxes - バウンディングボックス配列
 * @param {number} imgWidth - 画像幅
 * @param {number} imgHeight - 画像高さ
 * @param {number} classId - クラスID
 * @returns {Array<string>} YOLO形式の文字列配列
 */
export function convertBoxesToYoloFormat(boxes, imgWidth, imgHeight, classId = 0) {
    return boxes.map(box => {
        const centerX = (box.x1 + box.x2) / 2 / imgWidth;
        const centerY = (box.y1 + box.y2) / 2 / imgHeight;
        const width = (box.x2 - box.x1) / imgWidth;
        const height = (box.y2 - box.y1) / imgHeight;
        
        return formatYolo(classId, centerX, centerY, width, height);
    });
}

/**
 * 2つの数値の間にランダムな値を生成
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} ランダムな値
 */
export function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * 検出結果の精度メトリクスを計算
 * @param {Array<Object>} predictions - 予測バウンディングボックス
 * @param {Array<Object>} groundTruth - 正解バウンディングボックス
 * @param {number} iouThreshold - IoUのしきい値
 * @returns {Object} 精度メトリクス
 */
export function calculateMetrics(predictions, groundTruth, iouThreshold = 0.5) {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    // 各予測に対して最も高いIoUを持つGTを見つける
    const matchedGT = new Set();
    
    for (const pred of predictions) {
        let bestIoU = 0;
        let bestGTIndex = -1;
        
        for (let i = 0; i < groundTruth.length; i++) {
            if (matchedGT.has(i)) continue; // 既にマッチングされたGTはスキップ
            
            const iou = calculateIoU(pred, groundTruth[i]);
            if (iou > bestIoU) {
                bestIoU = iou;
                bestGTIndex = i;
            }
        }
        
        if (bestIoU >= iouThreshold) {
            truePositives++;
            matchedGT.add(bestGTIndex);
        } else {
            falsePositives++;
        }
    }
    
    // 未マッチのGTは偽陰性
    falseNegatives = groundTruth.length - matchedGT.size;
    
    // メトリクスの計算
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * precision * recall / (precision + recall) || 0;
    
    return {
        precision,
        recall,
        f1Score,
        truePositives,
        falsePositives,
        falseNegatives,
        total: {
            predictions: predictions.length,
            groundTruth: groundTruth.length
        }
    };
}