# app.py - 最終統合版（重複削除・最適化）
import os
import logging
from flask import Flask, send_from_directory, jsonify
import threading
import queue
from utils.file_cleanup import cleanup_temp_files, schedule_cleanup
from config import * 

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# アプリケーション初期化
app = Flask(__name__, static_folder='static', static_url_path='/static')

# ★統合: 設定の一元化
app.config.update({
    'UPLOAD_FOLDER': UPLOAD_DIR,
    'EXTRACTED_FOLDER': EXTRACTED_DIR,
    'DATASET_FOLDER': DATASET_DIR,
    'MODEL_FOLDER': os.path.join(MODELS_DIR, 'saved'),
    'SAMPLES_FOLDER': STATIC_SAMPLES_DIR,
    'ALLOWED_EXTENSIONS': {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'},
    'TEMP_FILES_MAX_AGE': 24,
    'SECRET_KEY': SECRET_KEY,
    'MAX_CONTENT_LENGTH': MAX_CONTENT_LENGTH
})

# 必要なディレクトリの作成
ensure_directories()
migrate_legacy_directories()

# モデルファイル確認・生成
model_path = os.path.join(app.config['MODEL_FOLDER'], 'sea_urchin_rf_model.pkl')
if not os.path.exists(model_path):
    logger.info("モデルファイルが見つかりません。テストモデルを生成します。")
    from utils.create_test_model import create_test_model
    create_test_model(app.config['MODEL_FOLDER'])
    logger.info(f"テストモデル生成完了: {model_path}")

# ★統合: グローバル変数の一元化
processing_queue = queue.Queue()
processing_results = {}
processing_status = {}

# 起動時クリーンアップ
with app.app_context():
    cleanup_count = cleanup_temp_files(
        directory=app.config['UPLOAD_FOLDER'],
        max_age_hours=app.config['TEMP_FILES_MAX_AGE']
    )
    logger.info(f"起動時クリーンアップ: {cleanup_count}ファイルを削除しました")

# 定期クリーンアップ
schedule_cleanup(app, interval_hours=6)

# ワーカースレッド開始
from utils.worker import processing_worker
processing_thread = threading.Thread(
    target=processing_worker, 
    args=(processing_queue, processing_status, app.config)
)
processing_thread.daemon = True
processing_thread.start()
logger.info("処理ワーカースレッドを開始しました")

# ★統合: ルート登録（重複削除・最適化）
from routes.main_routes import main_bp
from routes.video_routes import video_bp
from routes.image_routes import image_bp
from routes.learning_routes import learning_bp
from routes.api_routes import api_bp

app.register_blueprint(main_bp)
app.register_blueprint(video_bp, url_prefix='/video')
app.register_blueprint(image_bp, url_prefix='/image')
app.register_blueprint(learning_bp, url_prefix='/learning')
app.register_blueprint(api_bp, url_prefix='/api')

# ★統合: ファイル配信ルートの一元化
@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    """一時アップロードファイル配信"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/static/images/<path:filename>')
def serve_static_images(filename):
    """静的画像ファイル配信（アノテーション・検出結果など）"""
    return send_from_directory(STATIC_IMAGES_DIR, filename)

@app.route('/evaluation/images/<filename>')
def serve_evaluation_images(filename):
    """評価結果画像配信"""
    return send_from_directory(STATIC_EVALUATION_DIR, filename)

@app.route('/sample/<path:filename>')
def serve_sample_image(filename):
    """サンプル画像配信"""
    return send_from_directory(STATIC_SAMPLES_DIR, filename)

# ★統合: システム状態API
@app.route('/api/system-status')
def system_status():
    """システム全体の状態を取得"""
    try:
        # データセット統計
        male_dir = os.path.join(app.config['DATASET_FOLDER'], 'male')
        female_dir = os.path.join(app.config['DATASET_FOLDER'], 'female')
        
        male_count = len([f for f in os.listdir(male_dir) 
                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
        female_count = len([f for f in os.listdir(female_dir) 
                           if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
        
        # アクティブタスク数
        active_tasks = len([t for t in processing_status.values() 
                          if t.get('status') in ['processing', 'queued', 'running']])
        
        # モデル存在確認
        model_exists = os.path.exists(model_path)
        
        return jsonify({
            'dataset': {
                'male_count': male_count,
                'female_count': female_count,
                'total_count': male_count + female_count
            },
            'tasks': {
                'active': active_tasks,
                'total': len(processing_status)
            },
            'model': {
                'exists': model_exists,
                'path': model_path
            },
            'system': {
                'version': '1.0.0',
                'status': 'healthy'
            }
        })
    except Exception as e:
        logger.error(f"システム状態取得エラー: {str(e)}")
        return jsonify({'error': 'システム状態の取得に失敗しました'}), 500

# デバッグ用ルート（開発時のみ）
@app.route('/debug/routes')
def debug_routes():
    """デバッグ用：登録ルート表示"""
    if not app.config.get('DEBUG', False):
        return jsonify({'error': 'デバッグモードでのみ利用可能'}), 403
        
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    return jsonify({'routes': routes, 'count': len(routes)})

# エラーハンドラー
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'ページが見つかりません'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"内部サーバーエラー: {str(error)}")
    return jsonify({'error': '内部サーバーエラーが発生しました'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'ファイルサイズが大きすぎます'}), 413

# アプリケーション起動
if __name__ == '__main__':
    logger.info("登録されているルート:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule} -> {rule.endpoint} [{', '.join(rule.methods)}]")
    
    logger.info("アプリケーションを起動します")
    app.run(host='0.0.0.0', port=8080, debug=DEBUG)