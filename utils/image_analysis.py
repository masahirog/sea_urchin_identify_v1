import os
import cv2
import numpy as np
import uuid
import traceback

def analyze_basic_stats(image_path, app_config):
    """画像の基本的な統計情報を分析する"""
    try:
        # 画像パスの修正（必要に応じて）
        if not os.path.exists(image_path) and image_path.startswith('samples/'):
            image_path = os.path.join('static', image_path)
        
        # 画像の読み込み
        img = cv2.imread(image_path)
        if img is None:
            print(f"画像の読み込みに失敗: {image_path}")
            return {'mean': 0, 'std': 0, 'size': [0, 0]}
        
        # グレースケールに変換
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 基本統計
        mean = np.mean(gray)
        std = np.std(gray)
        height, width = gray.shape
        
        return {
            'mean': mean,
            'std': std,
            'size': [height, width]
        }
    except Exception as e:
        print(f"基本統計分析エラー: {str(e)}")
        return {'mean': 0, 'std': 0, 'size': [0, 0]}

def analyze_edge_features(image_path, app_config):
    """画像のエッジに関する特徴を分析する"""
    try:
        # 画像パスの修正（必要に応じて）
        if not os.path.exists(image_path) and image_path.startswith('samples/'):
            image_path = os.path.join('static', image_path)
        
        # 画像の読み込み
        img = cv2.imread(image_path)
        if img is None:
            print(f"画像の読み込みに失敗: {image_path}")
            return {'edge_count': 0, 'edge_density': 0}
        
        # グレースケールに変換
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Cannyエッジ検出
        edges = cv2.Canny(gray, 100, 200)
        
        # エッジピクセル数
        edge_count = np.sum(edges > 0)
        
        # エッジ密度（エッジピクセル数 / 総ピクセル数）
        height, width = gray.shape
        total_pixels = height * width
        edge_density = edge_count / total_pixels if total_pixels > 0 else 0
        
        return {
            'edge_count': int(edge_count),
            'edge_density': float(edge_density)
        }
    except Exception as e:
        print(f"エッジ特徴分析エラー: {str(e)}")
        return {'edge_count': 0, 'edge_density': 0}

def analyze_texture_features(image_path, app_config):
    """画像のテクスチャに関する特徴を分析する"""
    try:
        # 画像パスの修正（必要に応じて）
        if not os.path.exists(image_path) and image_path.startswith('samples/'):
            image_path = os.path.join('static', image_path)
        
        # 画像の読み込み
        img = cv2.imread(image_path)
        if img is None:
            print(f"画像の読み込みに失敗: {image_path}")
            return {'contrast': 0, 'uniformity': 0}
        
        # グレースケールに変換
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # GLCMの計算（Gray-Level Co-occurrence Matrix）
        # 簡易版: ヒストグラムベース
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist / hist.sum()  # 正規化
        
        # コントラスト（分散に近い）
        indices = np.arange(256)
        mean = np.sum(indices * hist.flatten())
        contrast = np.sum(((indices - mean) ** 2) * hist.flatten())
        
        # 均一性
        uniformity = np.sum(hist ** 2)
        
        return {
            'contrast': float(contrast),
            'uniformity': float(uniformity)
        }
    except Exception as e:
        print(f"テクスチャ特徴分析エラー: {str(e)}")
        return {'contrast': 0, 'uniformity': 0}

def detect_papillae(image_path, app_config):
    """画像から生殖乳頭を検出する"""
    try:
        # 画像パスの修正（必要に応じて）
        if not os.path.exists(image_path) and image_path.startswith('samples/'):
            full_path = os.path.join('static', image_path)
        else:
            full_path = image_path
        
        # 画像の読み込み
        img = cv2.imread(full_path)
        if img is None:
            print(f"画像の読み込みに失敗: {full_path}")
            return {
                'papillae_count': 0,
                'papillae_details': [],
                'image_path': '/uploads/detection_failed.jpg'
            }
        
        # ここでは簡易的な検出を行う（実際はモデルを使用）
        # 検出結果を可視化した画像を保存
        output_filename = f"detection_{uuid.uuid4().hex}.jpg"
        output_path = os.path.join(app_config['UPLOAD_FOLDER'], output_filename)
        
        # 元の画像をコピー（後で検出結果を描画）
        detection_img = img.copy()
        
        # 簡易的な検出結果（ここでは0個としています）
        # 実際のアプリケーションでは、AIモデルによる検出を実装
        papillae_count = 0
        papillae_details = []
        
        # 結果を描画
        cv2.putText(
            detection_img, 
            f"Detected: {papillae_count}", 
            (10, 30), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            1, 
            (0, 255, 0), 
            2
        )
        
        # 結果画像を保存
        cv2.imwrite(output_path, detection_img)
        
        return {
            'papillae_count': papillae_count,
            'papillae_details': papillae_details,
            'image_path': output_path
        }
    except Exception as e:
        print(f"生殖乳頭検出エラー: {str(e)}")
        return {
            'papillae_count': 0,
            'papillae_details': [],
            'image_path': '/uploads/detection_failed.jpg'
        }

def analyze_shape_features(annotation_path, app_config):
    """アノテーション画像から形状特性を分析する"""
    try:
        print(f"形状特性分析開始: {annotation_path}")
        
        # アノテーション画像を読み込み
        annotation_img = cv2.imread(annotation_path)
        if annotation_img is None:
            print(f"アノテーション画像の読み込みに失敗: {annotation_path}")
            return {}
        
        # 赤色のみを抽出
        # HSV色空間に変換
        hsv = cv2.cvtColor(annotation_img, cv2.COLOR_BGR2HSV)
        
        # 赤色の範囲を定義（HSV色空間）
        lower_red1 = np.array([0, 100, 100])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 100, 100])
        upper_red2 = np.array([180, 255, 255])
        
        # 赤色マスクの作成（色相が循環するため2つの範囲を設定）
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        # 輪郭検出
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            print("赤色輪郭が検出されませんでした")
            return {}
        
        # 最大の輪郭を使用（最も大きな生殖乳頭と仮定）
        contour = max(contours, key=cv2.contourArea)
        
        # 面積
        area = cv2.contourArea(contour)
        
        # 周囲長
        perimeter = cv2.arcLength(contour, True)
        
        # 円形度 (4π × 面積 / 周囲長²)
        circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
        
        print(f"形状特性分析結果: 面積={area}, 周囲長={perimeter}, 円形度={circularity}")
        
        return {
            'area': float(area),
            'perimeter': float(perimeter),
            'circularity': float(circularity)
        }
    except Exception as e:
        print(f"形状特性分析エラー: {str(e)}")
        traceback.print_exc()  # スタックトレースを出力
        return {}