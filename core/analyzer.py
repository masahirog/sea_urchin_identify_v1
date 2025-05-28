"""
ウニ生殖乳頭分析システム - 統合分析エンジン（YOLOベース）
YOLOv5のみを使用した生殖乳頭検出・雌雄判定
"""

import cv2
import numpy as np
import os
import uuid
import json
import traceback
from datetime import datetime

# YoloDetectorのみをインポート
from .YoloDetector import YoloDetector

class UnifiedAnalyzer:
    """統合ウニ生殖乳頭分析エンジン（YOLOベース）"""
    
    def __init__(self):
        # YOLOv5検出器の初期化
        try:
            self.yolo_detector = YoloDetector(conf_threshold=0.4)
            print("YOLOv5ベースの生殖乳頭検出器を初期化しました")
            
            if self.yolo_detector.model is None:
                raise Exception("YOLOv5モデルのロードに失敗しました")
                
        except Exception as e:
            print(f"生殖乳頭検出器の初期化エラー: {e}")
            self.yolo_detector = None

    # ================================
    # メイン機能: 雌雄判定
    # ================================
    
    def classify_image(self, image_path, extract_only=False):
        """
        画像から雌雄を判定（YOLOベース）
        
        Args:
            image_path: 画像ファイルのパス
            extract_only: 特徴抽出のみ行うかどうか（互換性のため残すが使用しない）
            
        Returns:
            dict: 判定結果
        """
        try:
            # YOLOが利用できない場合
            if self.yolo_detector is None:
                return {
                    "status": "model_not_trained",
                    "message": "YOLOモデルが未学習です。学習を実行してください。",
                    "guide": {
                        "steps": [
                            "1. 「学習データ」メニューでオス・メスの画像をアップロード",
                            "2. 「アノテーション」メニューで生殖乳頭をマーク",
                            "3. 「機械学習」メニューでYOLO学習を実行"
                        ],
                        "quick_start": True
                    }
                }
            
            # YOLOで検出・判定
            detection_result = self.yolo_detector.detect(image_path)
            
            # エラーチェック
            if 'error' in detection_result and detection_result.get('gender_result', {}).get('gender') == 'unknown':
                return {
                    "error": detection_result['error'],
                    "status": "detection_failed"
                }
            
            # 判定結果を取得
            gender_result = detection_result.get('gender_result', {})
            
            # 結果の整形
            result = {
                "gender": gender_result.get('gender', 'unknown'),
                "confidence": gender_result.get('confidence', 0.0),
                "papillae_count": detection_result.get('count', 0),
                "papillae_details": detection_result.get('detections', []),
                "count_by_class": detection_result.get('count_by_class', {}),
                "message": gender_result.get('message', ''),
                "marked_image_url": None,  # 後でルートで設定
                "annotated_image": detection_result.get('annotated_image')
            }
            
            # エラーがある場合は追加
            if 'error' in gender_result:
                result['error'] = gender_result['error']
            
            # 特徴重要度（YOLOでは検出数を表示）
            result['feature_importance'] = {
                '雄の生殖乳頭': detection_result['count_by_class']['male'],
                '雌の生殖乳頭': detection_result['count_by_class']['female'],
                '多孔板': detection_result['count_by_class']['madreporite']
            }
            
            return result
                
        except Exception as e:
            print(f"画像分析エラー: {str(e)}")
            traceback.print_exc()
            return {"error": f"画像分析中にエラーが発生しました: {str(e)}"}

    # ================================
    # メイン機能: モデル学習（YOLOのみ）
    # ================================
    
    def train_model(self, dataset_dir, task_id):
        """
        データセットからモデルを学習（互換性のため残すが、実際のYOLO学習は別ルートで実行）
        
        Args:
            dataset_dir: データセットディレクトリ
            task_id: 学習タスクID
            
        Returns:
            bool: 学習成功の可否
        """
        # YOLOの学習は /yolo/training/start エンドポイントで実行されるため
        # ここでは簡易的なチェックのみ
        
        try:
            from config import TRAINING_IMAGES_DIR, METADATA_FILE
            
            # データセット検証
            if not os.path.exists(TRAINING_IMAGES_DIR):
                raise Exception(f"学習データディレクトリが見つかりません: {TRAINING_IMAGES_DIR}")
            
            # メタデータ読み込み
            metadata = {}
            if os.path.exists(METADATA_FILE):
                try:
                    with open(METADATA_FILE, 'r') as f:
                        metadata = json.load(f)
                except:
                    print("メタデータの読み込みに失敗しました")
            
            # 画像の分類
            male_images = []
            female_images = []
            
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    image_info = metadata.get(filename, {})
                    gender = image_info.get('gender', 'unknown')
                    
                    if gender == 'male':
                        male_images.append(filename)
                    elif gender == 'female':
                        female_images.append(filename)
            
            if len(male_images) == 0 or len(female_images) == 0:
                raise Exception("オスとメスの両方の画像が必要です")
            
            print(f"学習データ: オス{len(male_images)}枚, メス{len(female_images)}枚")
            
            # 実際のYOLO学習は別プロセスで実行
            return True
            
        except Exception as e:
            error_msg = f"学習エラー: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return False

    # ================================
    # ユーティリティメソッド
    # ================================
    
    def get_model_info(self):
        """モデル情報を取得"""
        if self.yolo_detector and self.yolo_detector.model:
            return {
                "model_type": "YOLOv5",
                "model_loaded": True,
                "confidence_threshold": self.yolo_detector.conf_threshold
            }
        else:
            return {
                "model_type": "YOLOv5",
                "model_loaded": False,
                "message": "モデルが読み込まれていません"
            }
    
    def update_confidence_threshold(self, threshold):
        """信頼度閾値を更新"""
        if self.yolo_detector:
            self.yolo_detector.update_confidence(threshold)
            return True
        return False

# 後方互換性のためのエイリアス
UrchinPapillaeAnalyzer = UnifiedAnalyzer
PapillaeAnalyzer = UnifiedAnalyzer