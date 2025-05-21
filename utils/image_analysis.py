"""
ウニ生殖乳頭分析システム - 画像分析ユーティリティ
サンプル画像の詳細な分析機能を提供する
"""

import os
import cv2
import numpy as np
import uuid
import traceback


def analyze_basic_stats(image_path, app_config):
    """
    画像の基本的な統計情報を分析する
    
    Parameters:
    - image_path: 分析する画像のパス
    - app_config: アプリケーション設定
    
    Returns:
    - dict: 画像の基本統計情報
    """
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
        traceback.print_exc()
        return {'mean': 0, 'std': 0, 'size': [0, 0]}


def analyze_edge_features(image_path, app_config):
    """
    画像のエッジに関する特徴を分析する
    
    Parameters:
    - image_path: 分析する画像のパス
    - app_config: アプリケーション設定
    
    Returns:
    - dict: エッジ特徴の分析結果
    """
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
        traceback.print_exc()
        return {'edge_count': 0, 'edge_density': 0}


def analyze_texture_features(image_path, app_config):
    """
    画像のテクスチャに関する特徴を分析する
    
    Parameters:
    - image_path: 分析する画像のパス
    - app_config: アプリケーション設定
    
    Returns:
    - dict: テクスチャ特徴の分析結果
    """
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
        traceback.print_exc()
        return {'contrast': 0, 'uniformity': 0}


def detect_papillae(image_path, app_config):
    """
    画像から生殖乳頭を検出する
    
    Parameters:
    - image_path: 分析する画像のパス
    - app_config: アプリケーション設定
    
    Returns:
    - dict: 検出結果
    """
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
        
        # utils/image_processing.pyから生殖乳頭検出関数をインポート
        from utils.image_processing import detect_papillae_improved
        
        # 検出実行
        papillae_contours, processed_img = detect_papillae_improved(
            img, 
            min_area=500, 
            max_area=5000,
            circularity_threshold=0.3
        )
        
        # 検出結果を可視化した画像を保存
        output_filename = f"detection_{uuid.uuid4().hex}.jpg"
        upload_folder = app_config.get('UPLOAD_FOLDER', 'uploads')
        output_path = os.path.join(upload_folder, output_filename)
        
        # 元の画像をコピー（後で検出結果を描画）
        detection_img = img.copy()
        
        # 検出された輪郭を描画
        cv2.drawContours(detection_img, papillae_contours, -1, (0, 255, 0), 2)
        
        # 検出情報を描画
        cv2.putText(
            detection_img, 
            f"Detected: {len(papillae_contours)}", 
            (10, 30), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            1, 
            (0, 255, 0), 
            2
        )
        
        # 結果画像を保存
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, detection_img)
        
        # 各乳頭の詳細情報を抽出
        papillae_details = []
        for i, cnt in enumerate(papillae_contours):
            area = cv2.contourArea(cnt)
            perimeter = cv2.arcLength(cnt, True)
            circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
            
            # 輪郭の中心点を計算
            M = cv2.moments(cnt)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                position = (cx, cy)
            else:
                position = (0, 0)
                
            papillae_details.append({
                'id': i + 1,
                'area': float(area),
                'perimeter': float(perimeter),
                'circularity': float(circularity),
                'position': position
            })
        
        return {
            'papillae_count': len(papillae_contours),
            'papillae_details': papillae_details,
            'image_path': output_path
        }
    except Exception as e:
        print(f"生殖乳頭検出エラー: {str(e)}")
        traceback.print_exc()
        return {
            'papillae_count': 0,
            'papillae_details': [],
            'image_path': '/uploads/detection_failed.jpg'
        }


def analyze_shape_features(annotation_path, app_config):
    """
    アノテーション画像から形状特性を分析する
    
    Parameters:
    - annotation_path: アノテーション画像のパス
    - app_config: アプリケーション設定
    
    Returns:
    - dict: 形状特性の分析結果
    """
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
        
        # 凸包
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        
        # 凸性（面積/凸包面積）
        solidity = area / hull_area if hull_area > 0 else 0
        
        # 楕円近似
        if len(contour) >= 5:  # 楕円フィッティングには少なくとも5点必要
            ellipse = cv2.fitEllipse(contour)
            ellipse_axes = ellipse[1]  # (長軸, 短軸)
            aspect_ratio = ellipse_axes[0] / ellipse_axes[1] if ellipse_axes[1] > 0 else 1.0
        else:
            aspect_ratio = 1.0
        
        print(f"形状特性分析結果: 面積={area}, 周囲長={perimeter}, 円形度={circularity}, 凸性={solidity}, アスペクト比={aspect_ratio}")
        
        return {
            'area': float(area),
            'perimeter': float(perimeter),
            'circularity': float(circularity),
            'solidity': float(solidity),
            'aspect_ratio': float(aspect_ratio)
        }
    except Exception as e:
        print(f"形状特性分析エラー: {str(e)}")
        traceback.print_exc()
        return {}