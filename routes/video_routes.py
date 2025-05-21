"""
ウニ生殖乳頭分析システム - 動画処理ルート
動画からの生殖乳頭画像抽出機能を提供する
"""

from flask import Blueprint, request, jsonify, url_for, current_app
from werkzeug.utils import secure_filename
import os
import uuid

video_bp = Blueprint('video', __name__)


@video_bp.route('/upload', methods=['POST'])
def upload_video():
    """
    動画をアップロードして処理を開始
    
    Request:
    - video: アップロードする動画ファイル
    - max_images: 抽出する最大画像数（オプション、デフォルト: 10）
    
    Returns:
    - JSON: 処理タスクの情報
    """
    from app import app, processing_queue, processing_status
    from utils.file_handlers import allowed_file, is_video_file
    
    if 'video' not in request.files:
        return jsonify({"error": "ビデオファイルがありません"}), 400
        
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_video_file(file.filename):
        # 安全なファイル名に変換
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        if os.path.exists(file_path):
            name, ext = os.path.splitext(filename)
            unique_suffix = uuid.uuid4().hex[:8]
            filename = f"{name}_{unique_suffix}{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # ファイルを保存
        file.save(file_path)
        
        # 最大画像数パラメータを取得
        try:
            max_images = int(request.form.get('max_images', 10))
            if max_images < 1:
                max_images = 10  # 最小値を保証
        except (ValueError, TypeError):
            max_images = 10
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        task = {
            "type": "process_video",
            "id": task_id,
            "video_path": file_path,
            "max_images": max_images
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "処理を待機中...",
            "progress": 0,
            "video_name": filename,
            "max_images": max_images
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"動画処理タスクを開始しました: {task_id}, ファイル: {filename}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "ビデオの処理を開始しました", 
            "filename": filename
        })
    
    return jsonify({"error": "無効なファイル形式です"}), 400


@video_bp.route('/extracted-images/<task_id>', methods=['GET'])
def get_extracted_images(task_id):
    """
    指定されたタスクIDで抽出された画像のリストを取得
    
    Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - JSON: 抽出された画像のURL一覧
    """
    from app import app
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    if not os.path.exists(task_dir):
        return jsonify({"error": "指定されたタスクの画像が見つかりません"}), 404
    
    # 画像ファイルのみを抽出
    images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    # 画像が見つからない場合
    if not images:
        return jsonify({
            "message": "このタスクで抽出された画像はありません", 
            "images": []
        })
    
    # 画像URLのリストを作成
    image_urls = [url_for('image.get_image', path=os.path.join(task_id, img), _external=True) for img in images]
    
    current_app.logger.debug(f"タスク {task_id} から {len(images)} 枚の画像を取得しました")
    
    return jsonify({
        "images": image_urls,
        "count": len(images),
        "task_id": task_id
    })


@video_bp.route('/delete-task/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """
    指定されたタスクIDの画像とデータを削除
    
    Parameters:
    - task_id: 削除するタスクのID
    
    Returns:
    - JSON: 削除結果
    """
    from app import app, processing_status
    import shutil
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    # タスクディレクトリのパス
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    # ディレクトリが存在するか確認
    if not os.path.exists(task_dir):
        return jsonify({"error": "指定されたタスクが見つかりません"}), 404
    
    try:
        # タスクディレクトリを削除
        shutil.rmtree(task_dir)
        
        # 処理状態から削除（存在する場合）
        if task_id in processing_status:
            del processing_status[task_id]
            
        current_app.logger.info(f"タスク {task_id} を削除しました")
            
        return jsonify({
            "success": True, 
            "message": "タスクデータを削除しました"
        })
    except Exception as e:
        current_app.logger.error(f"タスク削除エラー {task_id}: {str(e)}")
        return jsonify({
            "error": f"タスクの削除中にエラーが発生しました: {str(e)}"
        }), 500