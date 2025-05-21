from flask import Blueprint, request, jsonify, url_for
from werkzeug.utils import secure_filename
import os
import uuid

video_bp = Blueprint('video', __name__)

@video_bp.route('/upload', methods=['POST'])
def upload_video():
    from app import app, processing_queue, processing_status
    from utils.file_handlers import allowed_file, is_video_file
    
    if 'video' not in request.files:
        return jsonify({"error": "ビデオファイルがありません"}), 400
        
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_video_file(file.filename):
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

@video_bp.route('/extracted-images/<task_id>', methods=['GET'])
def get_extracted_images(task_id):
    from app import app
    from flask import url_for
    
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    if not os.path.exists(task_dir):
        return jsonify({"error": "画像が見つかりません"}), 404
    
    images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    image_urls = [url_for('image.get_image', path=os.path.join(task_id, img), _external=True) for img in images]
    
    return jsonify({"images": image_urls})