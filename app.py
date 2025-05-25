import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, send_from_directory, jsonify
import threading
import queue
from utils.file_cleanup import cleanup_temp_files, schedule_cleanup
from config import * 
from routes.yolo import yolo_bp
from routes.annotation import annotation_bp
from routes.training import training_bp



# ログディレクトリ作成
os.makedirs('logs', exist_ok=True)

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('logs/app.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# アプリケーション初期化
app = Flask(__name__, static_folder='static', static_url_path='/static')

# 設定の一元化
app.config.update({
    'UPLOAD_FOLDER': UPLOAD_DIR,
    'MODEL_FOLDER': os.path.join(MODELS_DIR, 'saved'),
    'SAMPLES_FOLDER': STATIC_SAMPLES_DIR,
    'ALLOWED_EXTENSIONS': {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'},
    'TEMP_FILES_MAX_AGE': 24,
    'MAX_CONTENT_LENGTH': MAX_CONTENT_LENGTH,
    'STATIC_FOLDER': STATIC_DIR  # 追加: STATICフォルダのパスを設定
})

# 必要なディレクトリの作成
ensure_directories()

# 起動時クリーンアップ
with app.app_context():
    cleanup_count = cleanup_temp_files(
        directory=app.config['UPLOAD_FOLDER'],
        max_age_hours=app.config['TEMP_FILES_MAX_AGE']
    )
    logger.info(f"起動時クリーンアップ: {cleanup_count}ファイルを削除しました")

# 定期クリーンアップ
schedule_cleanup(app, interval_hours=6)

# ルートのインポートと登録
from routes.main import main_bp
from routes.learning import learning_bp

app.register_blueprint(main_bp)
app.register_blueprint(learning_bp, url_prefix='/learning')
app.register_blueprint(yolo_bp)  # YOLOルートの登録
app.register_blueprint(annotation_bp)
app.register_blueprint(training_bp)  



# ファイル配信ルートの一元化
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

# 静的ファイルの設定（YOLOの結果ディレクトリ）
@app.route('/static/runs/<path:filename>')
def serve_runs(filename):
    """YOLOの結果ディレクトリを提供するルート"""
    runs_dir = os.path.join('yolov5', 'runs')
    return send_from_directory(runs_dir, filename)


# システム状態API
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
        
        # YOLOモデルの確認
        yolo_model_exists = False
        yolo_model_path = None
        train_dir = 'yolov5/runs/train'
        if os.path.exists(train_dir):
            exp_dirs = sorted([d for d in os.listdir(train_dir) if d.startswith('exp')])
            if exp_dirs:
                latest_exp = exp_dirs[-1]
                best_path = os.path.join(train_dir, latest_exp, 'weights/best.pt')
                if os.path.exists(best_path):
                    yolo_model_exists = True
                    yolo_model_path = best_path
        
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
            'yolo_model': {
                'exists': yolo_model_exists,
                'path': yolo_model_path
            },
            'system': {
                'version': '1.0.0',
                'status': 'healthy'
            }
        })
    except Exception as e:
        logger.error(f"システム状態取得エラー: {str(e)}")
        return jsonify({'error': 'システム状態の取得に失敗しました'}), 500

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



@app.route('/images/samples/<path:filename>')
def serve_sample_images(filename):
    return send_from_directory(STATIC_SAMPLES_DIR, filename)

# アプリケーション起動
if __name__ == '__main__':
    logger.info("登録されているルート:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule} -> {rule.endpoint} [{', '.join(rule.methods)}]")
    
    # YOLOv5ディレクトリの確認
    if not os.path.exists('yolov5'):
        logger.warning("YOLOv5ディレクトリが見つかりません。YOLOv5のクローンが必要です。")
        logger.info("実行: git clone https://github.com/ultralytics/yolov5.git")
    
    logger.info("アプリケーションを起動します")
    app.run(host='0.0.0.0', port=8080, debug=DEBUG)
