"""
カメラ管理モジュール
USBマイクロスコープとの接続・制御を管理
"""

import cv2
import numpy as np
import threading
import time
import logging
from typing import Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class CameraConfig:
    """カメラ設定"""
    camera_index: int = 0  # PC内蔵カメラ（Camera 0）をデフォルトに
    width: int = 640
    height: int = 480
    fps: int = 30
    buffer_size: int = 1  # バッファサイズを小さくしてレイテンシを減らす

class CameraManager:
    """カメラ管理クラス"""

    def __init__(self, config: Optional[CameraConfig] = None):
        self.config = config or CameraConfig()
        self.camera = None
        self.is_running = False
        self.current_frame = None
        self.frame_lock = threading.Lock()
        self.capture_thread = None
        self.current_camera_index = self.config.camera_index
        self.initialization_lock = threading.Lock()

    def initialize(self) -> bool:
        """カメラを初期化"""
        with self.initialization_lock:
            try:
                # 既存のカメラを完全に解放
                if self.camera:
                    self.camera.release()
                    self.camera = None
                    time.sleep(0.5)

                # DirectShowバックエンドを優先的に試す
                backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]

                for backend in backends:
                    logger.info(f"バックエンド {backend} でカメラ接続を試行中...")

                    # カメラを開く（現在のカメラインデックスを使用）
                    self.camera = cv2.VideoCapture(self.current_camera_index, backend)

                    if self.camera.isOpened():
                        logger.info(f"バックエンド {backend} で接続成功")
                        break
                else:
                    logger.error(f"カメラ {self.current_camera_index} を開けませんでした")
                    return False

                # カメラ設定
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
                self.camera.set(cv2.CAP_PROP_FPS, self.config.fps)
                self.camera.set(cv2.CAP_PROP_BUFFERSIZE, self.config.buffer_size)

                # 実際の解像度を取得
                actual_width = int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                actual_height = int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                actual_fps = self.camera.get(cv2.CAP_PROP_FPS)
                backend_name = self.camera.getBackendName()

                logger.info(f"カメラ初期化成功: {actual_width}x{actual_height} @ {actual_fps}fps (Backend: {backend_name})")

                # 最初のフレームを取得してテスト（リトライ付き）
                max_retries = 5
                for i in range(max_retries):
                    ret, frame = self.camera.read()
                    if ret and frame is not None:
                        self.current_frame = frame
                        logger.info(f"テストフレーム取得成功 (試行 {i+1}/{max_retries})")
                        return True

                    # 少し待機してリトライ
                    time.sleep(0.2)
                    logger.warning(f"フレーム取得失敗 (試行 {i+1}/{max_retries})")

                logger.error("テストフレームの取得に失敗")
                return False

            except Exception as e:
                logger.error(f"カメラ初期化エラー: {e}")
                if self.camera:
                    self.camera.release()
                    self.camera = None
                return False

    def start_capture(self):
        """キャプチャスレッドを開始"""
        if self.is_running:
            return

        self.is_running = True
        self.capture_thread = threading.Thread(target=self._capture_loop)
        self.capture_thread.daemon = True
        self.capture_thread.start()
        logger.info("キャプチャスレッド開始")

    def stop_capture(self):
        """キャプチャスレッドを停止"""
        self.is_running = False
        if self.capture_thread:
            self.capture_thread.join(timeout=2.0)
        logger.info("キャプチャスレッド停止")

    def _capture_loop(self):
        """キャプチャループ（別スレッドで実行）"""
        while self.is_running:
            if self.camera and self.camera.isOpened():
                ret, frame = self.camera.read()
                if ret:
                    with self.frame_lock:
                        self.current_frame = frame
                else:
                    logger.warning("フレーム取得失敗")
            else:
                logger.error("カメラが開いていません")
                break

            # CPU負荷を下げるため少し待機
            time.sleep(0.01)

    def get_frame(self) -> Optional[np.ndarray]:
        """現在のフレームを取得"""
        with self.frame_lock:
            if self.current_frame is not None:
                return self.current_frame.copy()
        return None

    def get_frame_jpeg(self) -> Optional[bytes]:
        """現在のフレームをJPEG形式で取得"""
        frame = self.get_frame()
        if frame is not None:
            ret, jpeg = cv2.imencode('.jpg', frame)
            if ret:
                return jpeg.tobytes()
        return None

    def capture_snapshot(self, filename: str) -> bool:
        """スナップショットを保存"""
        frame = self.get_frame()
        if frame is not None:
            cv2.imwrite(filename, frame)
            logger.info(f"スナップショット保存: {filename}")
            return True
        return False

    def switch_camera(self, camera_index: int) -> bool:
        """カメラを切り替え"""
        logger.info(f"カメラを {self.current_camera_index} から {camera_index} に切り替え")

        # 現在のカメラを停止
        was_running = self.is_running
        if was_running:
            self.stop_capture()

        # カメラを完全に解放
        if self.camera:
            self.camera.release()
            self.camera = None
            # 少し待機してリソースを完全に解放
            time.sleep(0.5)

        # 新しいカメラインデックスを設定
        self.current_camera_index = camera_index

        # カメラごとの設定を適用
        if camera_index == 0:
            # PC内蔵カメラの設定
            self.config.width = 640
            self.config.height = 480
        else:
            # マイクロスコープの設定
            self.config.width = 1280
            self.config.height = 720

        # 新しいカメラで初期化
        if self.initialize():
            if was_running:
                self.start_capture()
            logger.info(f"カメラ {camera_index} への切り替え成功")
            return True
        else:
            logger.error(f"カメラ {camera_index} への切り替え失敗")
            # 元のカメラに戻す試み
            self.current_camera_index = 1 - camera_index  # 0->1, 1->0
            self.initialize()
            return False

    def get_camera_info(self) -> dict:
        """カメラ情報を取得"""
        if self.camera and self.camera.isOpened():
            return {
                'index': self.current_camera_index,
                'width': int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)),
                'height': int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                'fps': self.camera.get(cv2.CAP_PROP_FPS),
                'backend': self.camera.getBackendName(),
                'is_running': self.is_running
            }
        return {'error': 'Camera not initialized'}

    def release(self):
        """カメラを解放"""
        self.stop_capture()
        if self.camera:
            self.camera.release()
            self.camera = None
        logger.info("カメラ解放完了")

    def __del__(self):
        """デストラクタ"""
        self.release()

# シングルトンインスタンス
_camera_instance: Optional[CameraManager] = None

def get_camera_instance() -> CameraManager:
    """カメラインスタンスを取得（シングルトン）"""
    global _camera_instance
    if _camera_instance is None:
        _camera_instance = CameraManager()
    return _camera_instance

def reset_camera_instance():
    """カメラインスタンスをリセット"""
    global _camera_instance
    if _camera_instance:
        _camera_instance.release()
        _camera_instance = None
        # ガベージコレクションを強制実行
        import gc
        gc.collect()
    logger.info("カメラインスタンスをリセットしました")