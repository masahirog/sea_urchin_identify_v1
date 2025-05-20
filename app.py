import os
import uuid
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import threading
import queue
import json

# モデルのインポート
from models.analyzer import UrchinPapillaeAnalyzer

# グローバル変数
processing_queue = queue.Queue()
processing_results = {}
processing_status = {}

# アプリケーションの初期化
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['EXTRACTED_FOLDER'] = 'extracted_images'
app.config['DATASET_FOLDER'] = 'dataset'
app.config['MODEL_FOLDER'] = 'models/saved'
app.config['ALLOWED_EXTENSIONS'] = {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png'}

# 必要なディレクトリの作成
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['EXTRACTED_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'male'), exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'female'), exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)

# 処理ワーカー
def processing_worker():
    while True:
        try:
            task = processing_queue.get()
            if task is None:
                break
                
            task_type = task["type"]
            task_id = task["id"]
            
            analyzer = UrchinPapillaeAnalyzer()
            
            if task_type == "process_video":
                analyzer.process_video(
                    task["video_path"],
                    app.config['EXTRACTED_FOLDER'],
                    task_id,
                    task.get("max_images", 10)
                )
            elif task_type == "train_model":
                analyzer.train_model(
                    task["dataset_dir"],
                    task_id
                )
            
            processing_queue.task_done()
            
        except Exception as e:
            print(f"処理ワーカーエラー: {str(e)}")
            if 'task_id' in locals():
                processing_status[task_id] = {"status": "error", "message": f"エラー: {str(e)}"}
            processing_queue.task_done()

# 処理スレッドの開始
processing_thread = threading.Thread(target=processing_worker)
processing_thread.daemon = True
processing_thread.start()

# ユーティリティ関数
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def get_file_extension(filename):
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

def is_video_file(filename):
    ext = get_file_extension(filename)
    return ext in {'mp4', 'avi', 'mov', 'mkv'}

def is_image_file(filename):
    ext = get_file_extension(filename)
    return ext in {'jpg', 'jpeg', 'png'}

# ルート
@app.route('/')
def index():
    return render_template('index.html')

# ビデオのアップロード
@app.route('/upload-video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({"error": "ビデオファイルがありません"}), 400
        
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename) and is_video_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        task = {
            "type": "process_video",
            "id": task_id,
            "video_path": file_path,
            "max_images": int(request.form.get('max_images', 10))
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {"status": "queued", "message": "処理を待機中..."}
        
        # キューに追加
        processing_queue.put(task)
        
        return jsonify({"success": True, "task_id": task_id, "message": "ビデオの処理を開始しました"})
    
    return jsonify({"error": "無効なファイル形式です"}), 400

# 処理状態の取得
@app.route('/task-status/<task_id>', methods=['GET'])
def task_status(task_id):
    if task_id in processing_status:
        return jsonify(processing_status[task_id])
    return jsonify({"error": "タスクが見つかりません"}), 404

# 抽出された画像一覧の取得
@app.route('/extracted-images/<task_id>', methods=['GET'])
def get_extracted_images(task_id):
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    if not os.path.exists(task_dir):
        return jsonify({"error": "画像が見つかりません"}), 404
    
    images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    image_urls = [url_for('get_image', path=os.path.join(task_id, img), _external=True) for img in images]
    
    return jsonify({"images": image_urls})

# 画像の取得
@app.route('/image/<path:path>')
def get_image(path):
    return send_from_directory(app.config['EXTRACTED_FOLDER'], path)

# 画像の保存
@app.route('/save-to-dataset', methods=['POST'])
def save_to_dataset():
    data = request.json
    
    if not data or 'image_path' not in data or 'gender' not in data:
        return jsonify({"error": "必要なパラメータがありません"}), 400
    
    image_path = data['image_path']
    gender = data['gender']
    
    if gender not in ['male', 'female']:
        return jsonify({"error": "性別は 'male' または 'female' である必要があります"}), 400
    
    if not os.path.exists(image_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        # ファイル名の取得
        filename = os.path.basename(image_path)
        
        # 保存先ディレクトリ
        target_dir = os.path.join(app.config['DATASET_FOLDER'], gender)
        os.makedirs(target_dir, exist_ok=True)
        
        # 保存先パス
        target_path = os.path.join(target_dir, filename)
        
        # 画像のコピー
        import shutil
        shutil.copy(image_path, target_path)
        
        return jsonify({"success": True, "message": f"画像を {gender} カテゴリに保存しました"})
        
    except Exception as e:
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500

# 画像のアップロード（判別用）
@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename) and is_image_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # 画像の判別
        analyzer = UrchinPapillaeAnalyzer()
        result = analyzer.classify_image(file_path)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400
        
        # 画像へのURLを追加
        if "marked_image_path" in result:
            image_name = os.path.basename(result["marked_image_path"])
            result["marked_image_url"] = url_for('get_uploaded_file', filename=image_name, _external=True)
        
        return jsonify(result)
    
    return jsonify({"error": "無効なファイル形式です"}), 400

# アップロードされたファイルの取得
@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# データセット情報の取得
@app.route('/dataset-info', methods=['GET'])
def get_dataset_info():
    male_dir = os.path.join(app.config['DATASET_FOLDER'], 'male')
    female_dir = os.path.join(app.config['DATASET_FOLDER'], 'female')
    
    male_count = len([f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
    female_count = len([f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
    
    total_count = male_count + female_count
    
    return jsonify({
        "male_count": male_count,
        "female_count": female_count,
        "total_count": total_count
    })

# モデルの訓練
@app.route('/train-model', methods=['POST'])
def train_model():
    # 処理タスクの作成
    task_id = str(uuid.uuid4())
    task = {
        "type": "train_model",
        "id": task_id,
        "dataset_dir": app.config['DATASET_FOLDER']
    }
    
    # 処理状態の初期化
    processing_status[task_id] = {"status": "queued", "message": "モデル訓練を待機中..."}
    
    # キューに追加
    processing_queue.put(task)
    
    return jsonify({"success": True, "task_id": task_id, "message": "モデル訓練を開始しました"})

# アプリケーション起動
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)