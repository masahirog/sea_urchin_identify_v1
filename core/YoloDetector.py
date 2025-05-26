# core/YoloDetector.py
import os
import torch
import cv2
import numpy as np
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class YoloDetector:
    """YOLOv5を使用した生殖乳頭検出器"""
    
    def __init__(self, model_path=None, conf_threshold=0.25, device=None):
        """
        検出器の初期化
        
        Args:
            model_path: YOLOv5モデルのパス（Noneの場合はyolov5sを使用）
            conf_threshold: 検出信頼度の閾値
            device: 実行デバイス（'cuda'/'cpu'、Noneの場合は自動選択）
        """
        self.conf_threshold = conf_threshold
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.model_path = model_path
        
        logger.info(f"YoloDetector: デバイス {self.device} を使用")
        
        # モデルのロード
        self._load_model()
    
    def _load_model(self):
        """YOLOv5モデルをロード"""
        try:
            if self.model_path and os.path.exists(self.model_path):
                # カスタムモデルのロード
                self.model = torch.hub.load('ultralytics/yolov5', 'custom', 
                                          path=self.model_path, force_reload=False)
                logger.info(f"カスタムYOLOv5モデルをロード: {self.model_path}")
            else:
                # 最新の訓練済みモデルを探す
                train_dir = 'yolov5/runs/train'
                if os.path.exists(train_dir):
                    exp_dirs = sorted([d for d in os.listdir(train_dir) if d.startswith('exp')])
                    if exp_dirs:
                        latest_exp = exp_dirs[-1]
                        best_path = os.path.join(train_dir, latest_exp, 'weights/best.pt')
                        if os.path.exists(best_path):
                            self.model = torch.hub.load('ultralytics/yolov5', 'custom', 
                                                      path=best_path, force_reload=False)
                            logger.info(f"最新の訓練済みモデルをロード: {best_path}")
                            return
                
                # デフォルトモデルのロード
                self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', force_reload=False)
                logger.info("デフォルトのYOLOv5sモデルをロード")
            
            # デバイス設定
            self.model.to(self.device)
            
            # 推論モード設定
            self.model.eval()
            
            # 信頼度閾値設定
            self.model.conf = self.conf_threshold
            
        except Exception as e:
            logger.error(f"モデルロードエラー: {e}")
            # フォールバック: 簡易的な検出器として機能
            self.model = None
    
    def detect(self, image_path):
        """
        画像から生殖乳頭を検出
        
        Args:
            image_path: 画像ファイルのパス
            
        Returns:
            dict: 検出結果
                - detections: 検出結果のリスト
                - annotated_image: 検出結果を描画した画像
                - count: 検出数
        """
        try:
            # 画像読み込み
            if isinstance(image_path, str):
                image = cv2.imread(image_path)
                if image is None:
                    raise ValueError(f"画像の読み込みに失敗: {image_path}")
            else:
                image = image_path
            
            if self.model is None:
                # モデルが読み込めない場合は従来の手法にフォールバック
                return self._fallback_detect(image)
            
            # BGR -> RGB変換
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # 推論実行
            results = self.model(rgb_image)
            
            # 検出結果の抽出
            detections = []
            for det in results.xyxy[0]:  # バッチの最初の画像の結果
                x1, y1, x2, y2, conf, cls = det.cpu().numpy()
                
                if conf >= self.conf_threshold:
                    detections.append({
                        'bbox': [int(x1), int(y1), int(x2), int(y2)],
                        'confidence': float(conf),
                        'class_id': int(cls),
                        'class_name': 'papillae'
                    })
            
            # 結果の描画
            annotated_image = image.copy()
            for det in detections:
                bbox = det['bbox']
                conf = det['confidence']
                
                # 境界ボックスの描画
                cv2.rectangle(annotated_image, 
                            (bbox[0], bbox[1]), 
                            (bbox[2], bbox[3]), 
                            (0, 255, 0), 4)
                
                # 信頼度の表示
                label = f"Papillae: {conf:.2f}"
                cv2.putText(annotated_image, label, 
                          (bbox[0], bbox[1] - 10), 
                          cv2.FONT_HERSHEY_SIMPLEX, 
                          0.5, (0, 255, 0), 3)
            
            return {
                'detections': detections,
                'annotated_image': annotated_image,
                'count': len(detections)
            }
            
        except Exception as e:
            logger.error(f"検出エラー: {e}")
            return {
                'detections': [],
                'annotated_image': image if 'image' in locals() else None,
                'count': 0,
                'error': str(e)
            }
    
    def batch_detect(self, image_paths):
        """
        複数画像の一括検出
        
        Args:
            image_paths: 画像パスのリスト
            
        Returns:
            list: 各画像の検出結果
        """
        results = []
        
        for image_path in image_paths:
            try:
                result = self.detect(image_path)
                result['image_path'] = image_path
                results.append(result)
            except Exception as e:
                logger.error(f"バッチ検出エラー ({image_path}): {e}")
                results.append({
                    'image_path': image_path,
                    'detections': [],
                    'count': 0,
                    'error': str(e)
                })
        
        return results
    
    def _fallback_detect(self, image):
        """
        YOLOモデルが使用できない場合のフォールバック検出
        
        Args:
            image: 入力画像
            
        Returns:
            dict: 検出結果
        """
        try:
            # グレースケール変換
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            
            # 適応的二値化
            binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                         cv2.THRESH_BINARY_INV, 11, 2)
            
            # 輪郭検出
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            detections = []
            annotated_image = image.copy()
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 500 < area < 5000:  # 面積フィルタ
                    x, y, w, h = cv2.boundingRect(cnt)
                    
                    # アスペクト比チェック
                    aspect_ratio = w / h if h > 0 else 0
                    if 0.5 < aspect_ratio < 2.0:
                        detections.append({
                            'bbox': [x, y, x + w, y + h],
                            'confidence': 0.5,  # フォールバック時の固定信頼度
                            'class_id': 0,
                            'class_name': 'papillae'
                        })
                        
                        # 描画
                        cv2.rectangle(annotated_image, (x, y), (x + w, y + h), (0, 255, 0), 4)
                        cv2.putText(annotated_image, "Papillae (fallback)", 
                                  (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 
                                  0.5, (0, 255, 0), 3)
            
            return {
                'detections': detections,
                'annotated_image': annotated_image,
                'count': len(detections),
                'fallback': True
            }
            
        except Exception as e:
            logger.error(f"フォールバック検出エラー: {e}")
            return {
                'detections': [],
                'annotated_image': image,
                'count': 0,
                'error': str(e)
            }
    
    def update_confidence(self, conf_threshold):
        """信頼度閾値を更新"""
        self.conf_threshold = conf_threshold
        if self.model:
            self.model.conf = conf_threshold
    
    def reload_model(self, model_path=None):
        """モデルを再読み込み"""
        if model_path:
            self.model_path = model_path
        self._load_model()