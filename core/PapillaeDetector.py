"""
ウニ生殖乳頭分析システム - YOLOv5ベースの生殖乳頭検出モジュール
従来の画像処理手法からYOLOv5ベースの機械学習アプローチへの移行
"""

import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision
from PIL import Image
import time
import logging
from pathlib import Path

# ロギング設定
logger = logging.getLogger(__name__)

class PapillaeDetector:
    """
    YOLOv5を利用したウニ生殖乳頭検出器
    """
    def __init__(self, model_path=None, conf_threshold=0.5, device=None):
        """
        検出器の初期化
        
        Parameters:
        - model_path: YOLOv5モデルのパス（Noneの場合は初回実行時にダウンロード）
        - conf_threshold: 検出信頼度の閾値
        - device: 実行デバイス（'cuda'/'cpu'、Noneの場合は自動選択）
        """
        self.conf_threshold = conf_threshold
        
        # 実行デバイス設定
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"PapillaeDetector: デバイス {self.device} を使用")
        
        # モデルのロード
        self.model = None
        try:
            success = self._load_model(model_path)
            if not success:
                raise Exception("YOLOv5モデルのロードに失敗しました")
        except Exception as e:
            logger.error(f"モデルのロード中にエラーが発生しました: {e}")
            # モデルロードに失敗した場合は例外を再スロー
            raise

    def _load_model(self, model_path=None):
        """
        YOLOv5モデルをロード
        
        Parameters:
        - model_path: モデルのパス
        """
        try:
            # YOLOv5のインポートエラーを回避するため、環境を整備
            import sys
            import os
            
            # YOLOv5ディレクトリが存在する場合、パスに追加
            yolov5_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'yolov5')
            if os.path.exists(yolov5_path) and yolov5_path not in sys.path:
                sys.path.insert(0, yolov5_path)
            
            if model_path and os.path.exists(model_path):
                # カスタムモデルのロード
                self.model = torch.hub.load('ultralytics/yolov5', 'custom', 
                                          path=model_path, force_reload=False, verbose=False)
                logger.info(f"カスタムYOLOv5モデルをロード: {model_path}")
            else:
                # 事前学習済みモデルのロード（小型のYOLOv5s）
                self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', 
                                          force_reload=False, verbose=False)
                logger.info("事前学習済みのYOLOv5sモデルをロード")
            
            # デバイス設定
            self.model.to(self.device)
            
            # 推論モード設定
            self.model.eval()
            
            # 信頼度閾値設定
            self.model.conf = self.conf_threshold
            
            return True
        except Exception as e:
            logger.error(f"モデルロードエラー: {e}")
            self.model = None
            return False
    
    def detect_papillae(self, image, draw_results=True):
        """
        画像から生殖乳頭を検出
        
        Parameters:
        - image: OpenCV形式の画像（BGR）
        - draw_results: 結果を描画するかどうか
        
        Returns:
        - detections: 検出結果のリスト [x1, y1, x2, y2, confidence, class_id] の形式
        - annotated_image: 検出結果を描画した画像（draw_results=Trueの場合）
        """
        if self.model is None:
            logger.error("モデルがロードされていません。")
            raise Exception("YOLOモデルが利用できません。処理を中止します。")
        
        # BGR -> RGB変換（YOLOは RGB形式を想定）
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 推論実行
        try:
            results = self.model(rgb_image)
            
            # 検出結果の抽出
            detections = []
            for det in results.xyxy[0]:  # バッチの最初の画像の結果
                x1, y1, x2, y2, conf, cls = det.cpu().numpy()
                
                # 信頼度フィルタリング
                if conf >= self.conf_threshold:
                    detections.append({
                        'bbox': [int(x1), int(y1), int(x2), int(y2)],
                        'confidence': float(conf),
                        'class_id': int(cls)
                    })
            
            # 結果の描画
            annotated_image = image.copy()
            if draw_results and detections:
                for det in detections:
                    bbox = det['bbox']
                    conf = det['confidence']
                    
                    # 境界ボックスの描画
                    cv2.rectangle(
                        annotated_image, 
                        (bbox[0], bbox[1]), 
                        (bbox[2], bbox[3]), 
                        (0, 255, 0), 
                        4
                    )
                    
                    # 信頼度の表示
                    label = f"Papillae: {conf:.2f}"
                    cv2.putText(
                        annotated_image, 
                        label, 
                        (bbox[0], bbox[1] - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.5, 
                        (0, 255, 0), 
                        3
                    )
            
            return detections, annotated_image
            
        except Exception as e:
            logger.error(f"推論中にエラーが発生: {e}")
            return [], image

    
    def extract_papillae_features(self, image, detections):
        """
        検出された生殖乳頭から特徴量を抽出
        
        Parameters:
        - image: 入力画像
        - detections: 検出結果
        
        Returns:
        - features: 特徴量リスト
        """
        features = []
        
        for det in detections:
            bbox = det['bbox']
            
            # 領域の切り出し
            x1, y1, x2, y2 = bbox
            roi = image[y1:y2, x1:x2]
            
            if roi.size == 0:
                continue
            
            # グレースケール変換
            if len(roi.shape) == 3:
                gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            else:
                gray_roi = roi
            
            # 特徴抽出（既存の実装と同様）
            try:
                # 面積
                area = (x2 - x1) * (y2 - y1)
                
                # 輪郭抽出（詳細特徴用）
                _, thresh = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    # 最大輪郭
                    largest_contour = max(contours, key=cv2.contourArea)
                    
                    # 周囲長
                    perimeter = cv2.arcLength(largest_contour, True)
                    
                    # 円形度
                    circularity = 4 * np.pi * cv2.contourArea(largest_contour) / (perimeter ** 2) if perimeter > 0 else 0
                    
                    # 凸包
                    hull = cv2.convexHull(largest_contour)
                    hull_area = cv2.contourArea(hull)
                    
                    # 充実度
                    solidity = cv2.contourArea(largest_contour) / hull_area if hull_area > 0 else 0
                    
                    # アスペクト比
                    aspect_ratio = (x2 - x1) / (y2 - y1) if (y2 - y1) > 0 else 0
                    
                    features.append([area, perimeter, circularity, solidity, aspect_ratio])
            except Exception as e:
                logger.warning(f"特徴抽出エラー: {e}")
        
        return features
    
    