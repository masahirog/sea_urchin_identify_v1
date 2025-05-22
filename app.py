# app.py の設定部分を統一修正
import os
import logging
from flask import Flask, send_from_directory
import threading
import queue
from utils.file_cleanup import cleanup_temp_files, schedule_cleanup
from config import * 

# ロギングの設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# アプリケーションの初期化
app = Flask(__name__, static_folder='static', static_url_path='/static')

# ★統一: 新しいディレクトリ構造のみを使用
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR                    # data/uploads (一時)
app.config['EXTRACTED_FOLDER'] = EXTRACTED_DIR              # data/extracted_frames
app.config['DATASET_FOLDER'] = DATASET_DIR                  # data/dataset
app.config['MODEL_FOLDER'] = os.path.join(MODELS_DIR, 'saved')
app.config['SAMPLES_FOLDER'] = STATIC_SAMPLES_DIR           # static/images/samples (恒久)
app.config['ALLOWED_EXTENSIONS'] = {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'}
app.config['TEMP_FILES_MAX_AGE'] = 24  # 時間単位

# 必要なディレクトリの作成と移行
ensure_directories()
migrate_legacy_directories()  # 初回のみ実行される

# モデルファイルの存在確認、なければテストモデルを生成
model_path = os.path.join(app.config['MODEL_FOLDER'], 'sea_urchin_rf_model.pkl')
if not os.path.exists(model_path):
    logger.info("モデルファイルが見つかりません。テストモデルを生成します。")
    from utils.create_test_model import create_test_model
    create_test_model(app.config['MODEL_FOLDER'])
    logger.info(f"テストモデル生成完了: {model_path}")

# グローバル変数
processing_queue = queue.Queue()
processing_results = {}
processing_status = {}

# 起動時に一度クリーンアップを実行（一時アップロードフォルダのみ）
with app.app_context():
    cleanup_count = cleanup_temp_files(
        directory=app.config['UPLOAD_FOLDER'],  # data/uploads
        max_age_hours=app.config['TEMP_FILES_MAX_AGE']
    )
    logger.info(f"起動時クリーンアップ: {cleanup_count}ファイルを削除しました")

# 定期的なクリーンアップをスケジュール
schedule_cleanup(app, interval_hours=6)

# ワーカースレッドの開始
from utils.worker import processing_worker
processing_thread = threading.Thread(
    target=processing_worker, 
    args=(processing_queue, processing_status, app.config)
)
processing_thread.daemon = True
processing_thread.start()
logger.info("処理ワーカースレッドを開始しました")

# ルートの登録
from routes.main_routes import main_bp
from routes.video_routes import video_bp
from routes.image_routes import image_bp
from routes.sample_routes import sample_bp
from routes.evaluation_routes import evaluation_bp
from routes.api_routes import api_bp

app.register_blueprint(main_bp)
app.register_blueprint(video_bp, url_prefix='/video')
app.register_blueprint(image_bp, url_prefix='/image')
app.register_blueprint(sample_bp, url_prefix='/sample')
app.register_blueprint(evaluation_bp, url_prefix='/evaluation')
app.register_blueprint(api_bp, url_prefix='/api')

# ★統一: アップロードファイル配信（一時ファイル用）
@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    """一時アップロードファイルを提供するルート"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ★統一: サンプル画像配信（恒久ファイル用）
@app.route('/sample/<path:filename>')
def serve_sample_image(filename):
    """サンプル画像の配信"""
    return send_from_directory(STATIC_SAMPLES_DIR, filename)

# デバッグ用：登録されたルートを出力
@app.route('/debug/routes')
def debug_routes():
    """デバッグ用：登録されているルートを表示"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    return jsonify(routes)

if __name__ == '__main__':
    logger.info("登録されているルート:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule} -> {rule.endpoint} [{', '.join(rule.methods)}]")
    
    logger.info("アプリケーションを起動します")
    app.run(host='0.0.0.0', port=8080, debug=True)