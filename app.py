import os
from flask import Flask
import threading
import queue

# アプリケーションの初期化
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['EXTRACTED_FOLDER'] = 'extracted_images'
app.config['DATASET_FOLDER'] = 'dataset'
app.config['MODEL_FOLDER'] = 'models/saved'
app.config['ALLOWED_EXTENSIONS'] = {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'}
app.config['SAMPLES_FOLDER'] = 'samples'

# 必要なディレクトリの作成
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['EXTRACTED_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'male'), exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'female'), exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'male'), exist_ok=True)
os.makedirs(os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'female'), exist_ok=True)

# グローバル変数
processing_queue = queue.Queue()
processing_results = {}
processing_status = {}

# ワーカースレッドのインポートと開始
from utils.worker import processing_worker
processing_thread = threading.Thread(target=processing_worker, args=(processing_queue, processing_status, app.config))
processing_thread.daemon = True
processing_thread.start()

# ルートの登録
from routes.main_routes import main_bp
from routes.video_routes import video_bp
from routes.image_routes import image_bp
from routes.sample_routes import sample_bp

app.register_blueprint(main_bp)
app.register_blueprint(video_bp, url_prefix='/video')
app.register_blueprint(image_bp, url_prefix='/image')
app.register_blueprint(sample_bp, url_prefix='/sample')

@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# アプリケーション起動
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)