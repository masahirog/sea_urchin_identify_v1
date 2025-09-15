"""
リアルタイム判定エンジン
YOLOv5を使用したウニの雌雄判定
"""

import sys
import os
import cv2
import torch
import numpy as np
import logging
import json
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
import threading
import time

# YOLOv5のパスを追加
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'yolov5'))

logger = logging.getLogger(__name__)

@dataclass
class DetectionResult:
    """検出結果"""
    bbox: List[int]  # [x1, y1, x2, y2]
    confidence: float
    class_name: str
    class_id: int

class RealtimeDetector:
    """リアルタイム判定クラス"""

    def __init__(self, model_path: str = 'yolov5/yolov5s.pt', device: str = 'cpu'):
        """
        初期化
        Args:
            model_path: YOLOモデルのパス
            device: 実行デバイス ('cpu' or 'cuda')
        """
        self.model_path = model_path
        self.device = device
        self.model = None
        self.is_initialized = False
        self.processing_lock = threading.Lock()

        # パフォーマンス統計
        self.fps = 0
        self.last_process_time = 0
        self.detection_count = 0

        # クラス名（ウニ判定用 - 後で学習データに合わせて変更）
        self.class_names = {
            0: 'sea_urchin',  # ウニ全般
            1: 'male',        # オス
            2: 'female',      # メス
            3: 'unknown'      # 判定不能
        }

    def initialize(self) -> bool:
        """モデルを初期化"""
        try:
            logger.info(f"YOLOモデルを読み込み中: {self.model_path}")

            # torch.hubを使用してYOLOv5を読み込み（これが最も安定）
            if os.path.exists(self.model_path):
                # カスタムモデル
                self.model = torch.hub.load(
                    'ultralytics/yolov5',
                    'custom',
                    path=self.model_path,
                    device=self.device,
                    force_reload=False
                )
            else:
                # 事前学習モデル
                self.model = torch.hub.load(
                    'ultralytics/yolov5',
                    'yolov5s',
                    device=self.device,
                    force_reload=False
                )

            # モデルを評価モードに設定
            self.model.eval()

            self.is_initialized = True
            logger.info("YOLOモデル初期化成功")
            return True

        except Exception as e:
            logger.error(f"モデル初期化エラー: {e}")
            return False

    def detect(self, frame: np.ndarray, confidence_threshold: float = 0.5) -> List[DetectionResult]:
        """
        フレームから物体を検出
        Args:
            frame: 入力画像
            confidence_threshold: 信頼度の閾値
        Returns:
            検出結果のリスト
        """
        if not self.is_initialized:
            logger.warning("モデルが初期化されていません")
            return []

        with self.processing_lock:
            try:
                start_time = time.time()

                # YOLOv5で推論
                results = self.model(frame)

                # 結果を解析
                detections = []

                # 結果の処理方法を修正
                if hasattr(results, 'xyxy') and len(results.xyxy) > 0:
                    # tensor形式の結果を処理
                    predictions = results.xyxy[0]  # 最初の画像の結果

                    if predictions is not None and len(predictions) > 0:
                        for pred in predictions:
                            # pred: [x1, y1, x2, y2, conf, class]
                            if len(pred) >= 6:
                                conf = float(pred[4])
                                if conf >= confidence_threshold:
                                    class_id = int(pred[5])

                                    # クラス名を取得
                                    if hasattr(results, 'names') and class_id < len(results.names):
                                        class_name = results.names[class_id]
                                    else:
                                        class_name = f"class_{class_id}"

                                    detection = DetectionResult(
                                        bbox=[int(pred[0]), int(pred[1]),
                                              int(pred[2]), int(pred[3])],
                                        confidence=conf,
                                        class_name=class_name,
                                        class_id=class_id
                                    )
                                    detections.append(detection)
                                    self.detection_count += 1

                # FPS計算
                process_time = time.time() - start_time
                if process_time > 0:
                    self.fps = 1.0 / process_time
                self.last_process_time = process_time

                return detections

            except Exception as e:
                logger.error(f"検出エラー: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return []

    def draw_detections(self, frame: np.ndarray, detections: List[DetectionResult]) -> np.ndarray:
        """
        検出結果を画像に描画
        Args:
            frame: 入力画像
            detections: 検出結果
        Returns:
            描画済み画像
        """
        output = frame.copy()

        for detection in detections:
            x1, y1, x2, y2 = detection.bbox

            # 色を決定（クラスに応じて）
            if 'male' in detection.class_name.lower():
                color = (255, 0, 0)  # 青（オス）
            elif 'female' in detection.class_name.lower():
                color = (255, 0, 255)  # マゼンタ（メス）
            else:
                color = (0, 255, 0)  # 緑（その他）

            # バウンディングボックスを描画
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)

            # ラベルを描画
            label = f"{detection.class_name}: {detection.confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)

            # ラベル背景
            cv2.rectangle(output, (x1, y1 - label_size[1] - 10),
                          (x1 + label_size[0], y1), color, -1)

            # ラベルテキスト
            cv2.putText(output, label, (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # FPS表示
        fps_text = f"FPS: {self.fps:.1f}"
        cv2.putText(output, fps_text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # 検出数表示
        count_text = f"Detections: {len(detections)}"
        cv2.putText(output, count_text, (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        return output

    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, Dict]:
        """
        フレームを処理して結果を返す
        Args:
            frame: 入力フレーム
        Returns:
            (描画済みフレーム, 検出情報の辞書)
        """
        # 検出実行
        detections = self.detect(frame)

        # 結果を描画
        output_frame = self.draw_detections(frame, detections)

        # 検出情報をまとめる
        info = {
            'fps': self.fps,
            'detection_count': len(detections),
            'total_detections': self.detection_count,
            'process_time': self.last_process_time,
            'detections': [
                {
                    'bbox': d.bbox,
                    'confidence': d.confidence,
                    'class': d.class_name
                }
                for d in detections
            ]
        }

        return output_frame, info

    def get_stats(self) -> Dict:
        """統計情報を取得"""
        return {
            'fps': self.fps,
            'total_detections': self.detection_count,
            'last_process_time': self.last_process_time,
            'is_initialized': self.is_initialized,
            'model_path': self.model_path,
            'device': self.device
        }

    def reset_stats(self):
        """統計をリセット"""
        self.fps = 0
        self.last_process_time = 0
        self.detection_count = 0

# シングルトンインスタンス
_detector_instance: Optional[RealtimeDetector] = None

def get_detector_instance(model_path: str = 'yolov5/yolov5s.pt') -> RealtimeDetector:
    """検出器インスタンスを取得（シングルトン）"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = RealtimeDetector(model_path=model_path)
        _detector_instance.initialize()
    return _detector_instance