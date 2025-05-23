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
            self._load_model(model_path)
        except Exception as e:
            logger.error(f"モデルのロード中にエラーが発生しました: {e}")
            # モデルロードに失敗しても処理は続行（後で再ロード可能）
    
    def _load_model(self, model_path=None):
        """
        YOLOv5モデルをロード
        
        Parameters:
        - model_path: モデルのパス
        """
        try:
            if model_path and os.path.exists(model_path):
                # カスタムモデルのロード
                self.model = torch.hub.load('ultralytics/yolov5', 'custom', path=model_path)
                logger.info(f"カスタムYOLOv5モデルをロード: {model_path}")
            else:
                # 事前学習済みモデルのロード（小型のYOLOv5s）
                self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s')
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
            raise e
    
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
            logger.warning("モデルがロードされていません。再ロードを試みます。")
            try:
                self._load_model()
            except Exception as e:
                logger.error(f"モデル再ロード失敗: {e}")
                return [], image
        
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
                        2
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
                        2
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
    
    def process_video_frame(self, frame):
        """
        動画フレームを処理
        
        Parameters:
        - frame: 処理するフレーム
        
        Returns:
        - detections: 検出結果
        - processed_frame: 処理後のフレーム
        """
        # 検出実行
        detections, annotated_frame = self.detect_papillae(frame)
        
        return detections, annotated_frame
    
    def train_detector(self, train_data_dir, epochs=100, batch_size=16, img_size=640):
        """
        検出器の訓練（既存のデータセットを使用）
        
        Parameters:
        - train_data_dir: 訓練データディレクトリ
        - epochs: 訓練エポック数
        - batch_size: バッチサイズ
        - img_size: 入力画像サイズ
        
        Returns:
        - bool: 訓練成功したかどうか
        """
        try:
            # YOLOv5リポジトリのクローンが必要
            if not os.path.exists('yolov5'):
                logger.info("YOLOv5リポジトリをクローン中...")
                os.system('git clone https://github.com/ultralytics/yolov5.git')
            
            # 訓練コマンド
            cmd = f"cd yolov5 && python train.py --img {img_size} --batch {batch_size} --epochs {epochs} --data {train_data_dir}/data.yaml --weights yolov5s.pt"
            
            logger.info(f"訓練開始: {cmd}")
            os.system(cmd)
            
            # 訓練結果確認
            model_path = os.path.join('yolov5', 'runs', 'train', 'exp', 'weights', 'best.pt')
            if os.path.exists(model_path):
                # 新しいモデルのロード
                self._load_model(model_path)
                return True
            else:
                logger.error("訓練完了後にモデルが見つかりませんでした")
                return False
                
        except Exception as e:
            logger.error(f"訓練エラー: {e}")
            return False
    
    def prepare_training_data(self, source_dir, target_dir, split_ratio=0.8):
        """
        訓練データの準備（既存のアノテーションからYOLO形式に変換）
        
        Parameters:
        - source_dir: 元のアノテーションディレクトリ
        - target_dir: YOLO形式の出力ディレクトリ
        - split_ratio: 訓練/検証の分割比率
        
        Returns:
        - bool: 成功したかどうか
        """
        try:
            # ディレクトリ作成
            os.makedirs(os.path.join(target_dir, 'images', 'train'), exist_ok=True)
            os.makedirs(os.path.join(target_dir, 'images', 'val'), exist_ok=True)
            os.makedirs(os.path.join(target_dir, 'labels', 'train'), exist_ok=True)
            os.makedirs(os.path.join(target_dir, 'labels', 'val'), exist_ok=True)
            
            # アノテーションファイル読み込み
            annotation_file = os.path.join('static', 'annotation_mapping.json')
            if not os.path.exists(annotation_file):
                logger.error(f"アノテーションファイルが見つかりません: {annotation_file}")
                return False
            
            import json
            with open(annotation_file, 'r') as f:
                annotations = json.load(f)
            
            # データセット設定ファイル
            data_yaml = f"""
# YOLOv5学習用設定ファイル
path: {os.path.abspath(target_dir)}
train: images/train
val: images/val

# クラス数
nc: 1
# クラス名
names: ['papillae']
            """
            
            with open(os.path.join(target_dir, 'data.yaml'), 'w') as f:
                f.write(data_yaml)
            
            # アノテーション変換
            file_count = 0
            for img_path, anno_path in annotations.items():
                try:
                    # 元画像の読み込み
                    from config import STATIC_SAMPLES_DIR
                    full_img_path = os.path.join(STATIC_SAMPLES_DIR, img_path)
                    if not os.path.exists(full_img_path):
                        logger.warning(f"画像が見つかりません: {full_img_path}")
                        continue
                    
                    # アノテーション画像の読み込み
                    full_anno_path = os.path.join('static', anno_path)
                    if not os.path.exists(full_anno_path):
                        logger.warning(f"アノテーション画像が見つかりません: {full_anno_path}")
                        continue
                    
                    # 画像読み込み
                    img = cv2.imread(full_img_path)
                    anno_img = cv2.imread(full_anno_path)
                    
                    if img is None or anno_img is None:
                        continue
                    
                    # アノテーションから生殖乳頭の位置を抽出
                    # アノテーション画像の赤色部分を抽出
                    img_height, img_width = img.shape[:2]
                    
                    # 赤色マスク
                    lower_red = np.array([0, 0, 100])
                    upper_red = np.array([100, 100, 255])
                    mask = cv2.inRange(anno_img, lower_red, upper_red)
                    
                    # 輪郭検出
                    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    
                    if not contours:
                        continue
                    
                    # ランダムに訓練/検証に分割
                    is_train = np.random.random() < split_ratio
                    subset = 'train' if is_train else 'val'
                    
                    # 画像の保存
                    img_filename = os.path.basename(img_path)
                    img_save_path = os.path.join(target_dir, 'images', subset, img_filename)
                    cv2.imwrite(img_save_path, img)
                    
                    # ラベルファイルの作成
                    label_filename = os.path.splitext(img_filename)[0] + '.txt'
                    label_save_path = os.path.join(target_dir, 'labels', subset, label_filename)
                    
                    with open(label_save_path, 'w') as f:
                        for contour in contours:
                            # バウンディングボックスの取得
                            x, y, w, h = cv2.boundingRect(contour)
                            
                            # YOLOフォーマットに変換 [class x_center y_center width height]
                            # すべての値は画像の幅と高さで正規化
                            class_id = 0  # 生殖乳頭クラス
                            x_center = (x + w/2) / img_width
                            y_center = (y + h/2) / img_height
                            width = w / img_width
                            height = h / img_height
                            
                            f.write(f"{class_id} {x_center} {y_center} {width} {height}\n")
                    
                    file_count += 1
                    
                except Exception as e:
                    logger.warning(f"ファイル処理エラー {img_path}: {e}")
            
            logger.info(f"訓練データ準備完了: {file_count}ファイル")
            return file_count > 0
            
        except Exception as e:
            logger.error(f"訓練データ準備エラー: {e}")
            return False