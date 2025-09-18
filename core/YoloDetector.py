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
        
        # クラス情報の定義
        self.class_info = {
            0: {'name': '雄の生殖乳頭', 'name_en': 'Male', 'color': (255, 0, 0)},      # 青
            1: {'name': '雌の生殖乳頭', 'name_en': 'Female', 'color': (0, 0, 255)},    # 赤
            2: {'name': '多孔板', 'name_en': 'Madreporite', 'color': (0, 255, 0)},      # 緑
            3: {'name': '肛門', 'name_en': 'Anus', 'color': (0, 165, 255)}              # オレンジ
        }
        
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
                - count_by_class: クラスごとの検出数
                - gender_result: 雌雄判定結果
        """
        try:
            # 画像読み込み
            if isinstance(image_path, str):
                # 日本語パス対応の読み込み
                image = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
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
            count_by_class = {0: 0, 1: 0, 2: 0, 3: 0}
            
            for det in results.xyxy[0]:  # バッチの最初の画像の結果
                x1, y1, x2, y2, conf, cls = det.cpu().numpy()
                
                if conf >= self.conf_threshold:
                    class_id = int(cls)
                    detections.append({
                        'bbox': [int(x1), int(y1), int(x2), int(y2)],
                        'confidence': float(conf),
                        'class_id': class_id,
                        'class_name': self.class_info.get(class_id, {'name': '不明'})['name'],
                        'class_name_en': self.class_info.get(class_id, {'name_en': 'Unknown'})['name_en']
                    })
                    
                    if class_id in count_by_class:
                        count_by_class[class_id] += 1
            
            # 結果の描画
            annotated_image = self._draw_detections(image, detections)
            
            # 雌雄判定
            gender_result = self._determine_gender(count_by_class)
            
            return {
                'detections': detections,
                'annotated_image': annotated_image,
                'count': len(detections),
                'count_by_class': {
                    'male': count_by_class[0],
                    'female': count_by_class[1],
                    'madreporite': count_by_class[2]
                },
                'gender_result': gender_result
            }
            
        except Exception as e:
            logger.error(f"検出エラー: {e}")
            return {
                'detections': [],
                'annotated_image': image if 'image' in locals() else None,
                'count': 0,
                'count_by_class': {'male': 0, 'female': 0, 'madreporite': 0},
                'gender_result': {'gender': 'unknown', 'confidence': 0.0, 'error': str(e)},
                'error': str(e)
            }
    
    def _draw_detections(self, image, detections):
        """検出結果を画像に描画"""
        annotated_image = image.copy()
        
        for det in detections:
            bbox = det['bbox']
            conf = det['confidence']
            class_id = det['class_id']
            
            # クラスに応じた色とラベル
            info = self.class_info.get(class_id, {'name': '不明', 'color': (128, 128, 128)})
            color = info['color']
            class_name = info.get('name_en', f'Class {class_id}')

            # 境界ボックスの描画（太い線）
            cv2.rectangle(annotated_image, 
                        (bbox[0], bbox[1]), 
                        (bbox[2], bbox[3]), 
                        color, 5)
            
            # クラス名と信頼度の表示
            label = f"{class_name}: {conf:.2f}"
            
            # ラベルの背景
            (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 2, 2)
            cv2.rectangle(annotated_image, 
                        (bbox[0], bbox[1] - 60), 
                        (bbox[0] + label_width + 10, bbox[1]), 
                        color, -1)
            
            # テキスト描画（白文字）
            cv2.putText(annotated_image, label, 
                      (bbox[0] + 5, bbox[1] - 10), 
                      cv2.FONT_HERSHEY_SIMPLEX, 
                      2, (255, 255, 255), 2)
        
        return annotated_image
    
    def _determine_gender(self, count_by_class):
        """検出結果から雌雄を判定"""
        male_count = count_by_class[0]
        female_count = count_by_class[1]
        madreporite_count = count_by_class[2]
        
        # 判定ロジック
        if male_count > 0 and female_count == 0:
            # 雄の生殖乳頭のみ検出
            confidence = min(0.95, 0.5 + male_count * 0.15)
            return {
                'gender': 'male',
                'confidence': confidence,
                'male_count': male_count,
                'female_count': 0,
                'madreporite_count': madreporite_count,
                'message': f'{male_count}個の雄の生殖乳頭を検出しました'
            }
        
        elif female_count > 0 and male_count == 0:
            # 雌の生殖乳頭のみ検出
            confidence = min(0.95, 0.5 + female_count * 0.15)
            return {
                'gender': 'female',
                'confidence': confidence,
                'male_count': 0,
                'female_count': female_count,
                'madreporite_count': madreporite_count,
                'message': f'{female_count}個の雌の生殖乳頭を検出しました'
            }
        
        elif male_count > 0 and female_count > 0:
            # 両方検出（異常）
            return {
                'gender': 'error',
                'confidence': 0.0,
                'male_count': male_count,
                'female_count': female_count,
                'madreporite_count': madreporite_count,
                'error': '雄雌両方の生殖乳頭が検出されました',
                'message': 'アノテーションまたは画像に問題がある可能性があります'
            }
        
        else:
            # 何も検出されない
            return {
                'gender': 'unknown',
                'confidence': 0.0,
                'male_count': 0,
                'female_count': 0,
                'madreporite_count': madreporite_count,
                'message': '生殖乳頭が検出されませんでした。別の角度から撮影してください'
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
                    'count_by_class': {'male': 0, 'female': 0, 'madreporite': 0},
                    'gender_result': {'gender': 'unknown', 'confidence': 0.0, 'error': str(e)},
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
        return {
            'detections': [],
            'annotated_image': image,
            'count': 0,
            'count_by_class': {'male': 0, 'female': 0, 'madreporite': 0},
            'gender_result': {
                'gender': 'unknown',
                'confidence': 0.0,
                'error': 'YOLOモデルが利用できません。学習を実行してください。'
            },
            'fallback': True
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