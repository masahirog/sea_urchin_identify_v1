"""
ウニ生殖乳頭分析システム - 統合画像処理エンジン

統合対象:
- utils/image_processing.py (400行)
- utils/image_analysis.py の画像処理部分 (150行)
→ 約280行に統合（約49%削減）
"""

import cv2
import numpy as np
import os
import uuid
import json
import traceback
from datetime import datetime


class UnifiedProcessor:
    """統合画像処理エンジン"""
    
    def __init__(self):
        self.default_params = {
            'min_contour_area': 500,
            'max_contour_area': 5000,
            'circularity_threshold': 0.3,
            'aspect_ratio_min': 0.5,
            'aspect_ratio_max': 2.0,
            'gaussian_blur_kernel': 5,
            'canny_lower': 50,
            'canny_upper': 150,
            'clahe_clip_limit': 2.0,
            'clahe_tile_size': (8, 8)
        }

    # ================================
    # 生殖乳頭検出
    # ================================
    
    def detect_papillae(self, image, app_config=None, **kwargs):
        """
        メイン生殖乳頭検出インターface
        
        Args:
            image: 入力画像（numpy array or path）
            app_config: アプリケーション設定
            **kwargs: 検出パラメータのオーバーライド
            
        Returns:
            dict: 検出結果 {
                'papillae_count': int,
                'papillae_details': list,
                'image_path': str,
                'processed_image': numpy.ndarray
            }
        """
        try:
            # 画像読み込み
            if isinstance(image, str):
                img = self._load_image(image)
                if img is None:
                    return {'error': f'画像読み込み失敗: {image}'}
            else:
                img = image
            
            # パラメータ設定
            params = {**self.default_params, **kwargs}
            
            # 前処理
            enhanced = self.enhance_image(img)
            
            # 乳頭検出
            contours = self._detect_contours(enhanced, params)
            
            # 結果フィルタリング
            valid_contours = self._filter_papillae_contours(contours, params)
            
            # 詳細情報計算
            papillae_details = self._calculate_contour_details(valid_contours)
            
            # 結果画像生成
            result_image = self._create_result_image(img, valid_contours)
            
            # 結果画像保存（app_configが提供された場合）
            saved_path = None
            if app_config:
                saved_path = self._save_result_image(result_image, app_config)
            
            return {
                'papillae_count': len(valid_contours),
                'papillae_details': papillae_details,
                'image_path': saved_path,
                'processed_image': result_image
            }
            
        except Exception as e:
            print(f"生殖乳頭検出エラー: {str(e)}")
            traceback.print_exc()
            return {'error': f'検出処理エラー: {str(e)}'}

    def detect_papillae_improved(self, frame, min_area=500, max_area=5000, circularity_threshold=0.3):
        """
        改良された生殖乳頭検出（後方互換性用）
        
        Args:
            frame: 入力フレーム
            min_area: 最小面積
            max_area: 最大面積  
            circularity_threshold: 円形度しきい値
            
        Returns:
            tuple: (検出輪郭リスト, 処理済み画像)
        """
        params = {
            'min_contour_area': min_area,
            'max_contour_area': max_area,
            'circularity_threshold': circularity_threshold
        }
        
        enhanced = self.enhance_image(frame)
        contours = self._detect_contours(enhanced, params)
        valid_contours = self._filter_papillae_contours(contours, params)
        
        return valid_contours, enhanced

    # ================================
    # 画像分析
    # ================================
    
    def analyze_basic_stats(self, image_path):
        """
        基本統計情報の分析
        
        Args:
            image_path: 分析する画像のパス
            
        Returns:
            dict: 統計情報 {'mean': float, 'std': float, 'size': [h, w]}
        """
        try:
            img = self._load_image(image_path)
            if img is None:
                return {'mean': 0, 'std': 0, 'size': [0, 0]}
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            
            return {
                'mean': float(np.mean(gray)),
                'std': float(np.std(gray)),
                'size': list(gray.shape)
            }
            
        except Exception as e:
            print(f"基本統計分析エラー: {str(e)}")
            return {'mean': 0, 'std': 0, 'size': [0, 0]}

    def analyze_edge_features(self, image_path):
        """
        エッジ特徴の分析
        
        Args:
            image_path: 分析する画像のパス
            
        Returns:
            dict: エッジ特徴 {'edge_count': int, 'edge_density': float}
        """
        try:
            img = self._load_image(image_path)
            if img is None:
                return {'edge_count': 0, 'edge_density': 0}
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            edges = cv2.Canny(gray, 100, 200)
            
            edge_count = int(np.sum(edges > 0))
            total_pixels = gray.shape[0] * gray.shape[1]
            edge_density = float(edge_count / total_pixels) if total_pixels > 0 else 0
            
            return {
                'edge_count': edge_count,
                'edge_density': edge_density
            }
            
        except Exception as e:
            print(f"エッジ特徴分析エラー: {str(e)}")
            return {'edge_count': 0, 'edge_density': 0}

    def analyze_texture_features(self, image_path):
        """
        テクスチャ特徴の分析
        
        Args:
            image_path: 分析する画像のパス
            
        Returns:
            dict: テクスチャ特徴 {'contrast': float, 'uniformity': float}
        """
        try:
            img = self._load_image(image_path)
            if img is None:
                return {'contrast': 0, 'uniformity': 0}
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            
            # ヒストグラムベースの特徴量
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            hist = hist / hist.sum()  # 正規化
            
            # コントラスト（分散）
            indices = np.arange(256)
            mean = np.sum(indices * hist.flatten())
            contrast = float(np.sum(((indices - mean) ** 2) * hist.flatten()))
            
            # 均一性
            uniformity = float(np.sum(hist ** 2))
            
            return {
                'contrast': contrast,
                'uniformity': uniformity
            }
            
        except Exception as e:
            print(f"テクスチャ特徴分析エラー: {str(e)}")
            return {'contrast': 0, 'uniformity': 0}

    def analyze_shape_features(self, annotation_path):
        """
        アノテーション画像からの形状特徴分析
        
        Args:
            annotation_path: アノテーション画像のパス
            
        Returns:
            dict: 形状特徴 {
                'area': float, 'perimeter': float, 'circularity': float,
                'solidity': float, 'aspect_ratio': float
            }
        """
        try:
            annotation_img = cv2.imread(annotation_path)
            if annotation_img is None:
                return {}
            
            # 赤色領域抽出
            mask = self._extract_red_regions(annotation_img)
            
            # 輪郭検出
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return {}
            
            # 最大輪郭を使用
            contour = max(contours, key=cv2.contourArea)
            
            # 形状特徴計算
            area = cv2.contourArea(contour)
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            
            # 楕円近似
            if len(contour) >= 5:
                ellipse = cv2.fitEllipse(contour)
                aspect_ratio = ellipse[1][0] / ellipse[1][1] if ellipse[1][1] > 0 else 1.0
            else:
                aspect_ratio = 1.0
            
            return {
                'area': float(area),
                'perimeter': float(perimeter),
                'circularity': float(circularity),
                'solidity': float(solidity),
                'aspect_ratio': float(aspect_ratio)
            }
            
        except Exception as e:
            print(f"形状特徴分析エラー: {str(e)}")
            return {}

    # ================================
    # 画像強化・前処理
    # ================================
    
    def enhance_image(self, image):
        """
        統合画像強化
        
        Args:
            image: 入力画像
            
        Returns:
            numpy.ndarray: 強化された画像
        """
        # グレースケール変換
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        # CLAHE適用
        clahe = cv2.createCLAHE(
            clipLimit=self.default_params['clahe_clip_limit'],
            tileGridSize=self.default_params['clahe_tile_size']
        )
        enhanced = clahe.apply(gray)
        
        # エッジ強調（アンシャープマスク）
        blur = cv2.GaussianBlur(enhanced, (0, 0), 3)
        sharp = cv2.addWeighted(enhanced, 1.5, blur, -0.5, 0)
        
        # モルフォロジー操作
        kernel = np.ones((2, 2), np.uint8)
        morph = cv2.morphologyEx(sharp, cv2.MORPH_TOPHAT, kernel)
        
        # 結合
        result = cv2.addWeighted(sharp, 0.7, morph, 0.3, 0)
        
        return result

    # ================================
    # 内部メソッド
    # ================================
    
    def _load_image(self, image_path):
        """画像読み込み（パス調整含む）"""
        # パス調整
        if not os.path.exists(image_path) and image_path.startswith('samples/'):
            image_path = os.path.join('static', image_path)
        
        img = cv2.imread(image_path)
        if img is None:
            print(f"画像読み込み失敗: {image_path}")
        return img

    def _detect_contours(self, enhanced_image, params):
        """輪郭検出"""
        # 適応的二値化
        binary = cv2.adaptiveThreshold(
            enhanced_image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # ノイズ除去
        kernel = np.ones((3, 3), np.uint8)
        clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        
        # 輪郭検出
        contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        return contours

    def _filter_papillae_contours(self, contours, params):
        """生殖乳頭らしい輪郭をフィルタリング"""
        valid_contours = []
        
        for cnt in contours:
            # 面積チェック
            area = cv2.contourArea(cnt)
            if not (params['min_contour_area'] < area < params['max_contour_area']):
                continue
            
            # 円形度チェック
            perimeter = cv2.arcLength(cnt, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                if not (params['circularity_threshold'] < circularity < 0.9):
                    continue
            else:
                continue
            
            # アスペクト比チェック
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h
            if not (params['aspect_ratio_min'] < aspect_ratio < params['aspect_ratio_max']):
                continue
            
            valid_contours.append(cnt)
        
        return valid_contours

    def _calculate_contour_details(self, contours):
        """輪郭詳細情報の計算"""
        details = []
        
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            perimeter = cv2.arcLength(cnt, True)
            circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
            
            # 中心点計算
            M = cv2.moments(cnt)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                position = (cx, cy)
            else:
                position = (0, 0)
            
            details.append({
                'id': i + 1,
                'area': float(area),
                'perimeter': float(perimeter),
                'circularity': float(circularity),
                'position': position
            })
        
        return details

    def _create_result_image(self, original_image, contours):
        """結果画像の生成"""
        result = original_image.copy()
        
        # 輪郭描画
        cv2.drawContours(result, contours, -1, (0, 255, 0), 2)
        
        # 検出数表示
        cv2.putText(
            result, f"Detected: {len(contours)}", (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2
        )
        
        return result

    def _save_result_image(self, result_image, app_config):
        """結果画像の保存"""
        try:
            output_filename = f"detection_{uuid.uuid4().hex}.jpg"
            upload_folder = app_config.get('UPLOAD_FOLDER', 'uploads')
            output_path = os.path.join(upload_folder, output_filename)
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cv2.imwrite(output_path, result_image)
            
            return output_path
            
        except Exception as e:
            print(f"結果画像保存エラー: {str(e)}")
            return None

    def _extract_red_regions(self, image):
        """赤色領域の抽出（アノテーション用）"""
        # HSV変換
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # 赤色範囲定義
        lower_red1 = np.array([0, 100, 100])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 100, 100])
        upper_red2 = np.array([180, 255, 255])
        
        # マスク作成
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        return mask


# 後方互換性のための関数
def variance_of_laplacian(image):
    """ピント測定（後方互換性用）"""
    return cv2.Laplacian(image, cv2.CV_64F).var()

def detect_papillae(frame, min_contour_area):
    """基本的な生殖乳頭検出（後方互換性用）"""
    processor = UnifiedProcessor()
    result = processor.detect_papillae(frame, min_contour_area=min_contour_area)
    
    if 'error' in result:
        return [], frame
    
    # contourを再構築（後方互換性のため）
    enhanced = processor.enhance_image(frame)
    params = {'min_contour_area': min_contour_area, 'max_contour_area': 10000}
    contours = processor._detect_contours(enhanced, params)
    valid_contours = processor._filter_papillae_contours(contours, params)
    
    return valid_contours, enhanced

def enhance_sea_urchin_image(image):
    """ウニ画像強化（後方互換性用）"""
    processor = UnifiedProcessor()
    return processor.enhance_image(image)

def detect_papillae_improved(frame, min_area=500, max_area=5000, circularity_threshold=0.3):
    """改良された検出（後方互換性用）"""
    processor = UnifiedProcessor()
    return processor.detect_papillae_improved(frame, min_area, max_area, circularity_threshold)