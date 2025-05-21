"""
ウニ生殖乳頭分析システム - 画像処理ユーティリティ
生殖乳頭の検出や分析に必要な画像処理機能を提供する
"""

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim


def variance_of_laplacian(image):
    """
    画像のピント合わせの度合いを計算（ラプラシアンの分散）
    値が大きいほどシャープでピントが合っている
    
    Parameters:
    - image: 入力画像（グレースケール）
    
    Returns:
    - float: ラプラシアンの分散値
    """
    return cv2.Laplacian(image, cv2.CV_64F).var()


def detect_papillae(frame, min_contour_area):
    """
    フレーム内の乳頭状構造を検出
    
    Parameters:
    - frame: 入力画像フレーム
    - min_contour_area: 検出する輪郭の最小サイズ
    
    Returns:
    - papillae_contours: 検出された生殖乳頭の輪郭
    - gray: グレースケール画像
    """
    # グレースケールに変換
    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame
    
    # ガウシアンブラーで前処理
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Cannyエッジ検出
    edges = cv2.Canny(blurred, 50, 150)
    
    # モルフォロジー演算でエッジをつなげる
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=1)
    
    # 輪郭検出
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 一定サイズ以上の輪郭をフィルタリング
    valid_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > min_contour_area]
    
    # 円形度の高い輪郭を選別（生殖乳頭は円または楕円に近い形状）
    papillae_contours = []
    for cnt in valid_contours:
        perimeter = cv2.arcLength(cnt, True)
        if perimeter > 0:
            circularity = 4 * np.pi * cv2.contourArea(cnt) / (perimeter * perimeter)
            if circularity > 0.5:  # 円形度のしきい値
                papillae_contours.append(cnt)
    
    return papillae_contours, gray


def is_similar_to_previous(current_frame, previous_frames, similarity_threshold=0.85):
    """
    現在のフレームが以前のフレームと似ているかを判定
    
    Parameters:
    - current_frame: 現在のフレーム
    - previous_frames: 以前のフレームのリスト
    - similarity_threshold: 類似度のしきい値
    
    Returns:
    - bool: 類似しているかどうか
    """
    if not previous_frames:
        return False
    
    # 画像のリサイズ（計算効率のため）
    current_small = cv2.resize(current_frame, (160, 120))
    
    for prev_frame in previous_frames:
        prev_small = cv2.resize(prev_frame, (160, 120))
        
        # グレースケールに変換
        if len(current_small.shape) == 3:
            current_gray = cv2.cvtColor(current_small, cv2.COLOR_BGR2GRAY)
        else:
            current_gray = current_small
            
        if len(prev_small.shape) == 3:
            prev_gray = cv2.cvtColor(prev_small, cv2.COLOR_BGR2GRAY)
        else:
            prev_gray = prev_small
        
        # 構造的類似性指標（SSIM）の計算
        score, _ = ssim(current_gray, prev_gray, full=True)
        
        if score > similarity_threshold:
            return True
            
    return False


def extract_features(image, contours):
    """
    画像と輪郭から特徴量を抽出
    
    Parameters:
    - image: 入力画像
    - contours: 検出された輪郭
    
    Returns:
    - features: 抽出された特徴量の配列
    """
    if not contours:
        return None
        
    features = []
    
    # 最大の輪郭を取得（主要な生殖乳頭と仮定）
    max_contour = max(contours, key=cv2.contourArea)
    
    # 輪郭の面積
    area = cv2.contourArea(max_contour)
    features.append(area)
    
    # 輪郭の周囲長
    perimeter = cv2.arcLength(max_contour, True)
    features.append(perimeter)
    
    # 円形度（4π*面積/周囲長^2）- 円に近いほど1に近づく
    if perimeter > 0:
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        features.append(circularity)
    else:
        features.append(0)
    
    # 凸包との比率（凸性）
    hull = cv2.convexHull(max_contour)
    hull_area = cv2.contourArea(hull)
    if hull_area > 0:
        solidity = float(area) / hull_area
        features.append(solidity)
    else:
        features.append(0)
    
    # 輪郭の向き（楕円近似）
    if len(max_contour) >= 5:  # 楕円フィッティングには少なくとも5点必要
        ellipse = cv2.fitEllipse(max_contour)
        features.append(ellipse[1][0] / ellipse[1][1])  # 長軸と短軸の比率
    else:
        features.append(1)
    
    return np.array(features)


def enhance_image(image):
    """
    画像の品質を向上させる
    
    Parameters:
    - image: 入力画像
    
    Returns:
    - enhanced: 強調された画像
    """
    # グレースケールに変換
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # CLAHE（コントラスト制限付き適応ヒストグラム平坦化）を適用
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # シャープニング
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    
    return sharpened


def enhance_sea_urchin_image(image):
    """
    ウニの生殖乳頭が見えやすくなるように画像を前処理
    
    Parameters:
    - image: 入力画像
    
    Returns:
    - result: 強調された画像
    """
    # グレースケール変換
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # コントラスト強調（CLAHE）
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # エッジ強調（アンシャープマスク）
    blur = cv2.GaussianBlur(enhanced, (0, 0), 3)
    sharp = cv2.addWeighted(enhanced, 1.5, blur, -0.5, 0)
    
    # 小さな構造を強調（モルフォロジー演算）
    kernel = np.ones((2, 2), np.uint8)
    morph = cv2.morphologyEx(sharp, cv2.MORPH_TOPHAT, kernel)
    
    # 元の強調画像と組み合わせ
    result = cv2.addWeighted(sharp, 0.7, morph, 0.3, 0)
    
    return result


def detect_papillae_improved(frame, min_area=100, max_area=1000, circularity_threshold=0.4):
    """
    生殖乳頭らしき構造を検出する改良版
    
    Parameters:
    - frame: 入力画像フレーム
    - min_area: 検出する輪郭の最小サイズ
    - max_area: 検出する輪郭の最大サイズ
    - circularity_threshold: 円形度のしきい値
    
    Returns:
    - papillae_contours: 検出された生殖乳頭の輪郭
    - processed: 処理された画像
    """
    # 画像の前処理
    processed = enhance_sea_urchin_image(frame)
    
    # 適応的二値化
    binary = cv2.adaptiveThreshold(
        processed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # 小さなノイズを除去
    kernel = np.ones((3, 3), np.uint8)
    clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    # 輪郭検出
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 面積と円形度に基づいてフィルタリング
    papillae_contours = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if min_area < area < max_area:
            perimeter = cv2.arcLength(cnt, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                # 生殖乳頭は比較的円に近い形状
                if circularity_threshold < circularity < 0.9:
                    # 追加のフィルタリング: アスペクト比
                    x, y, w, h = cv2.boundingRect(cnt)
                    aspect_ratio = float(w) / h
                    if 0.5 < aspect_ratio < 2.0:
                        papillae_contours.append(cnt)
    
    return papillae_contours, processed