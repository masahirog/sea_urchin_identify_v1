import os
import uuid
from datetime import datetime
import base64
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import threading
import queue
import json
import cv2
import numpy as np


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
app.config['SAMPLES_FOLDER'] = 'samples'


# 必要なディレクトリの作成
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['EXTRACTED_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'male'), exist_ok=True)
os.makedirs(os.path.join(app.config['DATASET_FOLDER'], 'female'), exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'male'), exist_ok=True)
os.makedirs(os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'female'), exist_ok=True)


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


# タスク履歴の取得
@app.route('/task-history', methods=['GET'])
def get_task_history():
    # 抽出された画像のディレクトリを探索
    extracted_dirs = []
    
    base_dir = app.config['EXTRACTED_FOLDER']
    if os.path.exists(base_dir):
        # ディレクトリ内のサブディレクトリ（タスクID）を取得
        for task_id in os.listdir(base_dir):
            task_dir = os.path.join(base_dir, task_id)
            if os.path.isdir(task_dir):
                # 各タスクディレクトリ内の画像数をカウント
                images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                
                if images:  # 画像が存在する場合のみ追加
                    # タスク情報を作成
                    creation_time = os.path.getctime(task_dir)
                    task_info = {
                        "task_id": task_id,
                        "image_count": len(images),
                        "date": datetime.fromtimestamp(creation_time).strftime("%Y-%m-%d %H:%M:%S"),
                        "timestamp": creation_time  # ソート用
                    }
                    
                    extracted_dirs.append(task_info)
    
    # 日付でソート（新しい順）
    extracted_dirs.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return jsonify({"tasks": extracted_dirs})

# 画像の削除
@app.route('/delete-image', methods=['POST'])


def delete_image():
    data = request.json
    
    if not data or 'image_path' not in data:
        return jsonify({"error": "画像パスが指定されていません"}), 400
    
    image_path = data['image_path']
    
    # パスの検証（不正なパスでないことを確認）
    if not image_path.startswith('/'):
        image_path = os.path.join(app.config['EXTRACTED_FOLDER'], image_path)
    else:
        # URLパスからファイルパスに変換
        image_path = image_path.replace('/image/', '')
        image_path = os.path.join(app.config['EXTRACTED_FOLDER'], image_path)
    
    if not os.path.exists(image_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        # 画像の削除
        os.remove(image_path)
        return jsonify({"success": True, "message": "画像を削除しました"})
    except Exception as e:
        return jsonify({"error": f"画像の削除中にエラーが発生しました: {str(e)}"}), 500

# 手動マーキング画像の保存
@app.route('/save-marked-image', methods=['POST'])
def save_marked_image():
    data = request.json
    
    if not data or 'image_data' not in data or 'original_image_path' not in data:
        return jsonify({"error": "必要なパラメータが不足しています"}), 400
    
    image_data = data['image_data'].split(',')[1]  # Base64データ部分を取得
    original_path = data['original_image_path']
    
    try:
        # Base64デコード
        image_bytes = base64.b64decode(image_data)
        
        # 元の画像からファイル名を取得
        filename = os.path.basename(original_path)
        basename, ext = os.path.splitext(filename)
        
        # 新しいファイル名（元の名前に_marked付加）
        new_filename = f"{basename}_marked{ext}"
        
        # 保存先ディレクトリ
        save_dir = os.path.dirname(original_path)
        if not os.path.exists(save_dir):
            save_dir = app.config['UPLOAD_FOLDER']
        
        # 保存先パス
        save_path = os.path.join(save_dir, new_filename)
        
        # 画像の保存
        with open(save_path, 'wb') as f:
            f.write(image_bytes)
        
        return jsonify({
            "success": True, 
            "message": "マーキング画像を保存しました",
            "image_path": save_path
        })
        
    except Exception as e:
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500


@app.route('/analyze-samples', methods=['GET'])
def analyze_samples_page():
    """サンプル分析ページを表示"""
    male_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'male')
    female_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'female')
    
    male_samples = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
    female_samples = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
    
    return render_template('analyze_samples.html', 
                          male_samples=male_samples,
                          female_samples=female_samples)

# サンプル画像の分析
@app.route('/analyze-sample', methods=['POST'])
def analyze_sample():
    """単一サンプルの特徴を分析"""
    data = request.json
    image_path = data['image_path']
    
    # パスの検証
    if not image_path.startswith(app.config['SAMPLES_FOLDER']):
        return jsonify({"error": "無効な画像パスです"}), 400
    
    # 画像読み込み
    try:
        img = cv2.imread(image_path)
        if img is None:
            return jsonify({"error": "画像を読み込めませんでした"}), 400
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 生殖乳頭の検出
        analyzer = UrchinPapillaeAnalyzer()
        papillae_contours, processed = analyzer.detect_papillae_improved(
            img, 
            min_area=500, 
            max_area=5000,
            circularity_threshold=0.3
        )
        
        # 検出結果を可視化した画像を作成
        detection_result = img.copy()
        cv2.drawContours(detection_result, papillae_contours, -1, (0, 255, 0), 2)
        
        # 一時ファイルとして保存
        detection_filename = f"detection_{uuid.uuid4().hex}.jpg"
        detection_path = os.path.join('uploads', detection_filename)
        cv2.imwrite(detection_path, detection_result)
        
        # 基本統計
        mean_val = np.mean(gray)
        std_val = np.std(gray)
        
        # エッジ検出
        edges = cv2.Canny(gray, 50, 150)
        edge_count = np.sum(edges > 0)
        
        # テクスチャ解析
        texture_features = {
            "contrast": float(cv2.Laplacian(gray, cv2.CV_64F).var()),
            "uniformity": float(np.sum(np.square(np.histogram(gray, 256, (0, 256))[0] / gray.size)))
        }
        
        # 検出した生殖乳頭の情報
        papillae_info = []
        for i, cnt in enumerate(papillae_contours):
            area = cv2.contourArea(cnt)
            perimeter = cv2.arcLength(cnt, True)
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            # 輪郭の中心座標
            M = cv2.moments(cnt)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
            else:
                cx, cy = 0, 0
                
            papillae_info.append({
                "id": i+1,
                "area": float(area),
                "perimeter": float(perimeter),
                "circularity": float(circularity),
                "center": [cx, cy]
            })
        
        return jsonify({
            'basic_stats': {
                'mean': float(mean_val),
                'std': float(std_val),
                'size': img.shape[:2]  # height, width
            },
            'edge_features': {
                'edge_count': int(edge_count),
                'edge_density': float(edge_count / (img.shape[0] * img.shape[1]))
            },
            'texture_features': texture_features,
            'detection_result': {
                'image_path': f"/uploads/{detection_filename}",
                'papillae_count': len(papillae_contours),
                'papillae_details': papillae_info
            }
        })
    except Exception as e:
        import traceback
        return jsonify({"error": f"分析中にエラーが発生しました: {str(e)}\n{traceback.format_exc()}"}), 500


# サンプル画像のアップロード
@app.route('/upload-sample', methods=['POST'])
def upload_sample():
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    gender = request.form.get('gender', 'unknown')
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename) and is_image_file(file.filename):
        filename = secure_filename(file.filename)
        
        # 保存先ディレクトリ
        if gender in ['male', 'female']:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', gender)
        else:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'unknown')
            
        os.makedirs(target_dir, exist_ok=True)
        
        # 保存先パス
        target_path = os.path.join(target_dir, filename)
        file.save(target_path)
        
        return jsonify({
            "success": True, 
            "message": "サンプル画像をアップロードしました",
            "path": target_path
        })
    
    return jsonify({"error": "無効なファイル形式です"}), 400

# サンプル画像の取得
@app.route('/sample/<path:path>')
def get_sample(path):
    return send_from_directory(app.config['SAMPLES_FOLDER'], path)



@app.route('/save-annotation', methods=['POST'])
def save_annotation():
    """アノテーション画像の保存"""
    data = request.json
    
    try:
        # Base64データの抽出
        image_data = data['image_data'].split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # 元画像のパスから保存用のパスを生成
        original_path = data['original_path']
        filename = os.path.basename(original_path)
        basename, ext = os.path.splitext(filename)
        
        # アノテーション画像の保存先
        annotation_filename = f"{basename}_annotated{ext}"
        save_path = os.path.join(app.config['SAMPLES_FOLDER'], 'annotations', annotation_filename)
        
        # ディレクトリが存在しなければ作成
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        # 画像を保存
        with open(save_path, 'wb') as f:
            f.write(image_bytes)
        
        return jsonify({
            "success": True,
            "message": "アノテーションを保存しました",
            "path": save_path
        })
        
    except Exception as e:
        import traceback
        return jsonify({"error": f"アノテーション保存中にエラーが発生しました: {str(e)}\n{traceback.format_exc()}"}), 500




# アプリケーション起動
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
