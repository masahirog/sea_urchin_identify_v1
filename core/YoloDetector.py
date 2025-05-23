import os
import torch
import numpy as np
from PIL import Image

class YoloDetector:
    """YOLOv5を用いた物体検出機能を提供するクラス"""
    
    def __init__(self, model_path=None, conf_threshold=0.25):
        """
        YOLOv5検出器の初期化
        
        Args:
            model_path: モデルファイルへのパス（Noneの場合は最新の学習済みモデルを使用）
            conf_threshold: 検出信頼度の閾値
        """
        if model_path is None:
            # 最新のモデルを検索
            exp_dirs = sorted([d for d in os.listdir('yolov5/runs/train') if d.startswith('exp')])
            if not exp_dirs:
                raise FileNotFoundError("学習済みモデルが見つかりません")
                
            latest_exp = exp_dirs[-1]
            model_path = f"yolov5/runs/train/{latest_exp}/weights/best.pt"
        
        # モデルのロード
        self.model = torch.hub.load('yolov5', 'custom', path=model_path, source='local')
        self.model.conf = conf_threshold
    
    def detect(self, image_path, save_result=True, output_dir='static/images/detection_results'):
        """
        画像内の生殖乳頭を検出
        
        Args:
            image_path: 検出する画像のパス
            save_result: 結果画像を保存するかどうか
            output_dir: 結果画像の保存先ディレクトリ
            
        Returns:
            dict: 検出結果の情報
        """
        # 推論実行
        results = self.model(image_path)
        
        # 結果を整形
        detections = results.pandas().xyxy[0].to_dict('records')
        
        # 結果画像の保存
        if save_result:
            os.makedirs(output_dir, exist_ok=True)
            filename = os.path.basename(image_path)
            result_path = os.path.join(output_dir, f"yolo_result_{filename}")
            results.save(save_dir=output_dir)
            
            # 結果画像のパスを取得
            result_image_path = os.path.join(output_dir, f"yolo_result_{filename}")
        else:
            result_image_path = None
        
        # 結果をまとめる
        return {
            'detections': detections,
            'count': len(detections),
            'image_path': image_path,
            'result_image_path': result_image_path
        }
    
    def batch_detect(self, image_paths, save_results=True):
        """
        複数の画像で一括検出を実行
        
        Args:
            image_paths: 検出する画像のパスのリスト
            save_results: 結果画像を保存するかどうか
            
        Returns:
            list: 各画像の検出結果
        """
        results = []
        for img_path in image_paths:
            try:
                detection_result = self.detect(img_path, save_result=save_results)
                results.append({
                    'image_path': img_path,
                    'success': True,
                    'result': detection_result
                })
            except Exception as e:
                results.append({
                    'image_path': img_path,
                    'success': False,
                    'error': str(e)
                })
                
        return results