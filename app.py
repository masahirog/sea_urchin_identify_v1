import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, send_from_directory, jsonify, abort
import threading
import queue
import sys
from app_utils.file_cleanup import cleanup_temp_files, schedule_cleanup
from config import * 
from routes.yolo import yolo_bp
from routes.training import training_bp
from routes.annotation_images import annotation_images_bp
from routes.annotation_editor import annotation_editor_bp



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
    'ALLOWED_EXTENSIONS': {'jpg', 'jpeg', 'png'},
    'TEMP_FILES_MAX_AGE': 24,
    'MAX_CONTENT_LENGTH': MAX_CONTENT_LENGTH,
    'STATIC_FOLDER': STATIC_DIR  # 追加: STATICフォルダのパスを設定
})

# 必要なディレクトリの作成
ensure_directories()

# システムの準備状態をチェック
def check_system_readiness():
    """システムの準備状態をチェック"""
    issues = []
    warnings = []
    
    # YOLOv5チェック
    if not os.path.exists('yolov5'):
        issues.append("YOLOv5がインストールされていません。`python setup_yolo.py`を実行してください。")
    
    # RandomForestモデルチェック
    model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
    if not os.path.exists(model_path):
        warnings.append("RandomForestモデルが未学習です。雌雄判定機能は学習後に利用可能になります。")
    
    # 結果をログ出力
    if issues:
        logger.error("🚨 システム起動エラー:")
        for issue in issues:
            logger.error(f"  - {issue}")
        return False, issues, warnings
    
    if warnings:
        logger.warning("⚠️  システム警告:")
        for warning in warnings:
            logger.warning(f"  - {warning}")
    else:
        logger.info("✅ システムチェック完了: すべての要件を満たしています")
    
    return True, issues, warnings

# システムチェックの実行
system_ready, system_issues, system_warnings = check_system_readiness()

if not system_ready:
    logger.error("システム要件を満たしていません。上記のエラーを解決してください。")
    logger.error("詳細はREADME.mdを参照してください。")
    sys.exit(1)

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
app.register_blueprint(yolo_bp)
app.register_blueprint(learning_bp)
app.register_blueprint(training_bp)  
app.register_blueprint(annotation_images_bp)
app.register_blueprint(annotation_editor_bp)

# グローバル処理状態（タスク管理用）
processing_status = {}
processing_queue = queue.Queue()

# ワーカースレッドの起動
def start_worker_thread():
    from app_utils.worker import processing_worker
    worker_thread = threading.Thread(
        target=processing_worker,
        args=(processing_queue, processing_status, app.config),
        daemon=True
    )
    worker_thread.start()
    logger.info("ワーカースレッドを起動しました")

start_worker_thread()

# ファイル配信ルートの一元化
@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    """一時アップロードファイル配信"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)



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
        from config import TRAINING_IMAGES_DIR, METADATA_FILE
        import json
        
        # メタデータ読み込み
        metadata = {}
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
            except:
                pass
        
        # 画像カウント
        male_count = 0
        female_count = 0
        unknown_count = 0
        
        if os.path.exists(TRAINING_IMAGES_DIR):
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    image_info = metadata.get(filename, {})
                    gender = image_info.get('gender', 'unknown')
                    if gender == 'male':
                        male_count += 1
                    elif gender == 'female':
                        female_count += 1
                    else:
                        unknown_count += 1
        
        # アクティブタスク数
        active_tasks = len([t for t in processing_status.values() 
                          if t.get('status') in ['processing', 'queued', 'running']])
        
        # モデル存在確認
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
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
                'unknown_count': unknown_count,
                'total_count': male_count + female_count + unknown_count
            },
            'tasks': {
                'active': active_tasks,
                'total': len(processing_status)
            },
            'model': {
                'random_forest': {
                    'exists': model_exists,
                    'path': model_path if model_exists else None,
                    'status': 'ready' if model_exists else 'not_trained'
                },
                'yolo': {
                    'exists': yolo_model_exists,
                    'path': yolo_model_path,
                    'status': 'ready' if yolo_model_exists else 'not_trained'
                }
            },
            'system': {
                'version': '1.0.0',
                'status': 'healthy',
                'warnings': system_warnings
            }
        })
    except Exception as e:
        logger.error(f"システム状態取得エラー: {str(e)}")
        return jsonify({'error': 'システム状態の取得に失敗しました'}), 500

# 起動時のシステム状態表示
@app.route('/api/startup-info')
def startup_info():
    """起動時の情報を提供"""
    return jsonify({
        'ready': system_ready,
        'issues': system_issues,
        'warnings': system_warnings,
        'guidance': {
            'model_not_trained': {
                'message': 'モデルの学習が必要です',
                'steps': [
                    '1. 「学習データ」タブでオス・メスの画像をアップロード',
                    '2. 「機械学習」タブで学習を実行',
                    '3. 学習完了後、雌雄判定が利用可能になります'
                ]
            }
        }
    })

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
    logger.info("=" * 60)
    logger.info("🦀 ウニ生殖乳頭分析システム 起動")
    logger.info("=" * 60)
    
    logger.info("登録されているルート:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule} -> {rule.endpoint} [{', '.join(rule.methods)}]")
    
    # システム状態サマリー
    if system_warnings:
        logger.info("\n⚠️  起動時の注意事項:")
        for warning in system_warnings:
            logger.info(f"  - {warning}")
        logger.info("\n詳細は http://localhost:8080 でご確認ください")
    
    logger.info("\nアプリケーションを起動します")
    logger.info("URL: http://localhost:8080")
    
    app.run(host='0.0.0.0', port=8080, debug=DEBUG)