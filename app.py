# app.py の設定部分を修正
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

# ★ 修正: 設定をconfig.pyの定数を使用するように変更
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR
app.config['EXTRACTED_FOLDER'] = EXTRACTED_DIR
app.config['DATASET_FOLDER'] = DATASET_DIR  # ★ ここが重要: data/dataset を指定
app.config['MODEL_FOLDER'] = os.path.join(MODELS_DIR, 'saved')
app.config['ALLOWED_EXTENSIONS'] = {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'}
app.config['SAMPLES_FOLDER'] = LEGACY_SAMPLES_DIR
app.config['TEMP_FILES_FOLDER'] = LEGACY_STATIC_UPLOADS_DIR
app.config['TEMP_FILES_MAX_AGE'] = 24  # 時間単位
app.config['STATIC_FOLDER'] = 'static'  # 静的ファイル用フォルダ

# 必要なディレクトリの作成
ensure_directories()  # ★ config.pyの関数を使用

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

# 起動時に一度クリーンアップを実行
with app.app_context():
    cleanup_count = cleanup_temp_files(
        directory=app.config['TEMP_FILES_FOLDER'],
        max_age_hours=app.config['TEMP_FILES_MAX_AGE']
    )
    logger.info(f"起動時クリーンアップ: {cleanup_count}ファイルを削除しました")

# 定期的なクリーンアップをスケジュール
schedule_cleanup(app, interval_hours=6)  # 6時間ごとにクリーンアップ

# ワーカースレッドのインポートと開始
from utils.worker import processing_worker
processing_thread = threading.Thread(
    target=processing_worker, 
    args=(processing_queue, processing_status, app.config)
)
processing_thread.daemon = True
processing_thread.start()
logger.info("処理ワーカースレッドを開始しました")

# ルートの登録
# app.py のBlueprint登録部分に追加
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

# 起動時にルート情報をログ出力
if __name__ == '__main__':
    logger.info("登録されているルート:")
    for rule in app.url_map.iter_rules():
        if 'evaluation' in str(rule):
            logger.info(f"  {rule} -> {rule.endpoint} [{', '.join(rule.methods)}]")
    
    logger.info("アプリケーションを起動します")
    app.run(host='0.0.0.0', port=8080, debug=True)



@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    """アップロードされたファイルを提供するルート"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# サンプル画像配信用ルート
@app.route('/sample/<path:filename>')
def serve_sample_image(filename):
    """サンプル画像の配信"""
    return send_from_directory(STATIC_SAMPLES_DIR, filename)
