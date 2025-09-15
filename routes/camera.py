"""
カメラ関連のルート定義
リアルタイム映像配信とカメラ制御
"""

from flask import Blueprint, render_template, Response, jsonify, request
import cv2
import logging
import os
import base64
import json
from core.camera_manager import get_camera_instance, reset_camera_instance
from core.realtime_detector import get_detector_instance
from config import UPLOAD_DIR

logger = logging.getLogger(__name__)

camera_bp = Blueprint('camera', __name__, url_prefix='/camera')

def generate_frames():
    """映像フレームをストリーミング"""
    camera = get_camera_instance()

    while True:
        frame_jpeg = camera.get_frame_jpeg()
        if frame_jpeg:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_jpeg + b'\r\n')

def generate_frames_with_detection():
    """判定結果付き映像フレームをストリーミング"""
    camera = get_camera_instance()
    detector = get_detector_instance()

    while True:
        frame = camera.get_frame()
        if frame is not None:
            # YOLO判定を実行
            processed_frame, info = detector.process_frame(frame)

            # フレームをJPEGに変換
            ret, jpeg = cv2.imencode('.jpg', processed_frame)
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')

@camera_bp.route('/')
@camera_bp.route('/<int:camera_index>')
def camera_page(camera_index=None):
    """カメラページを表示"""
    # カメラインデックスが指定されていない場合はデフォルト(0)
    if camera_index is None:
        camera_index = 0

    # カメラを切り替え
    camera = get_camera_instance()
    if camera.current_camera_index != camera_index:
        reset_camera_instance()

        from core.camera_manager import CameraConfig
        config = CameraConfig()
        config.camera_index = camera_index

        # カメラごとの設定
        if camera_index == 0:
            config.width = 640
            config.height = 480
        else:
            config.width = 1280
            config.height = 720

        # 新しいインスタンスを作成
        import core.camera_manager as cm
        cm._camera_instance = cm.CameraManager(config)

    return render_template('camera.html', camera_index=camera_index)

@camera_bp.route('/video_feed')
def video_feed():
    """映像ストリーミングエンドポイント"""
    camera = get_camera_instance()

    # カメラが初期化されていない場合は初期化
    if not camera.is_running:
        if not camera.initialize():
            return jsonify({'error': 'カメラの初期化に失敗しました'}), 500
        camera.start_capture()

    # 判定モードの確認
    detection_mode = request.args.get('detection', 'false').lower() == 'true'

    if detection_mode:
        # 判定付きストリーミング
        return Response(generate_frames_with_detection(),
                        mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        # 通常のストリーミング
        return Response(generate_frames(),
                        mimetype='multipart/x-mixed-replace; boundary=frame')

@camera_bp.route('/start', methods=['POST'])
def start_camera():
    """カメラを開始"""
    camera = get_camera_instance()

    if camera.is_running:
        return jsonify({'status': 'already_running', 'message': 'カメラは既に起動しています'})


    if camera.initialize():
        camera.start_capture()
        return jsonify({'status': 'success', 'message': 'カメラを開始しました'})
    else:
        return jsonify({'status': 'error', 'message': 'カメラの開始に失敗しました'}), 500

@camera_bp.route('/stop', methods=['POST'])
def stop_camera():
    """カメラを停止"""
    camera = get_camera_instance()
    camera.stop_capture()
    return jsonify({'status': 'success', 'message': 'カメラを停止しました'})

@camera_bp.route('/snapshot', methods=['POST'])
def capture_snapshot():
    """スナップショットを撮影"""
    camera = get_camera_instance()

    if not camera.is_running:
        return jsonify({'status': 'error', 'message': 'カメラが起動していません'}), 400

    # スナップショット保存ディレクトリ
    snapshot_dir = os.path.join(UPLOAD_DIR, 'snapshots')
    os.makedirs(snapshot_dir, exist_ok=True)

    # ファイル名を生成（タイムスタンプ付き）
    import datetime
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'snapshot_{timestamp}.jpg'
    filepath = os.path.join(snapshot_dir, filename)

    if camera.capture_snapshot(filepath):
        return jsonify({
            'status': 'success',
            'message': 'スナップショットを保存しました',
            'filename': filename,
            'path': filepath
        })
    else:
        return jsonify({'status': 'error', 'message': 'スナップショットの保存に失敗しました'}), 500

@camera_bp.route('/info', methods=['GET'])
def camera_info():
    """カメラ情報を取得"""
    camera = get_camera_instance()
    info = camera.get_camera_info()
    return jsonify(info)

@camera_bp.route('/settings', methods=['POST'])
def update_settings():
    """カメラ設定を更新"""
    camera = get_camera_instance()
    data = request.get_json()

    # 現在は解像度変更などに対応
    # 必要に応じて拡張

    return jsonify({'status': 'success', 'message': '設定を更新しました'})

@camera_bp.route('/detection/stats', methods=['GET'])
def detection_stats():
    """判定統計を取得"""
    detector = get_detector_instance()
    stats = detector.get_stats()
    return jsonify(stats)

@camera_bp.route('/detection/reset', methods=['POST'])
def reset_detection_stats():
    """判定統計をリセット"""
    detector = get_detector_instance()
    detector.reset_stats()
    return jsonify({'status': 'success', 'message': '統計をリセットしました'})

@camera_bp.route('/switch', methods=['POST'])
def switch_camera():
    """カメラを切り替え"""
    data = request.get_json()
    camera_index = data.get('camera_index', 0)

    # より長い待機時間でリソースを確実に解放
    import time

    # 現在のインスタンスを完全にリセット
    reset_camera_instance()

    # OpenCVのバッファをクリアするために少し長めに待機
    time.sleep(1.0)

    # 新しいインスタンスを作成
    from core.camera_manager import CameraConfig
    config = CameraConfig()
    config.camera_index = camera_index

    # カメラごとの設定
    if camera_index == 0:
        config.width = 640
        config.height = 480
    else:
        config.width = 1280
        config.height = 720

    # 新しいインスタンスを作成
    import core.camera_manager as cm
    cm._camera_instance = cm.CameraManager(config)

    # 新しいカメラを取得して初期化
    camera = get_camera_instance()
    if camera.initialize():
        return jsonify({
            'status': 'success',
            'message': f'カメラ {camera_index} に切り替えました',
            'camera_info': camera.get_camera_info()
        })
    else:
        return jsonify({
            'status': 'error',
            'message': f'カメラ {camera_index} への切り替えに失敗しました'
        }), 500