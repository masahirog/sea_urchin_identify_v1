"""
ウニ生殖乳頭分析システム - 動画処理ルート
動画からの生殖乳頭画像抽出機能を提供する
"""

from flask import Blueprint, request, jsonify, url_for, current_app, render_template, send_file
from werkzeug.utils import secure_filename
import os
import uuid
import zipfile
import tempfile
from datetime import datetime

video_bp = Blueprint('video', __name__)


@video_bp.route('/processing')
def processing_page():
    """動画処理専用ページを表示"""
    return render_template('video_processing.html')


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


@video_bp.route('/download-zip/<task_id>')
def download_extracted_images_zip(task_id):
    """
    指定されたタスクIDの抽出画像をZIPファイルでダウンロード
    
    Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - File: ZIP圧縮された画像ファイル
    """
    from app import app
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    if not os.path.exists(task_dir):
        return jsonify({"error": "指定されたタスクの画像が見つかりません"}), 404
    
    # 画像ファイルのみを抽出
    images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if not images:
        return jsonify({"error": "ダウンロードする画像がありません"}), 404
    
    try:
        # 一時ZIPファイルを作成
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for image_file in images:
                image_path = os.path.join(task_dir, image_file)
                # ZIPファイル内でのファイル名
                arcname = f"extracted_images_{task_id[:8]}/{image_file}"
                zipf.write(image_path, arcname)
        
        # ダウンロード用のファイル名
        download_filename = f"extracted_images_{task_id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        current_app.logger.info(f"ZIP作成完了: {task_id}, {len(images)}枚の画像")
        
        return send_file(
            temp_zip.name, 
            as_attachment=True, 
            download_name=download_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        current_app.logger.error(f"ZIP作成エラー {task_id}: {str(e)}")
        return jsonify({"error": f"ZIP作成中にエラーが発生しました: {str(e)}"}), 500


@video_bp.route('/download-selected', methods=['POST'])
def download_selected_images():
    """
    選択された画像をZIPファイルでダウンロード
    
    Request:
    - task_id: タスクID
    - image_names: 選択された画像ファイル名のリスト
    
    Returns:
    - File: ZIP圧縮された選択画像ファイル
    """
    from app import app
    
    data = request.json
    if not data or 'task_id' not in data or 'image_names' not in data:
        return jsonify({"error": "必要なパラメータがありません"}), 400
    
    task_id = data['task_id']
    image_names = data['image_names']
    
    if not image_names:
        return jsonify({"error": "選択された画像がありません"}), 400
    
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    
    if not os.path.exists(task_dir):
        return jsonify({"error": "指定されたタスクの画像が見つかりません"}), 404
    
    try:
        # 一時ZIPファイルを作成
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for image_name in image_names:
                image_path = os.path.join(task_dir, image_name)
                if os.path.exists(image_path):
                    # ZIPファイル内でのファイル名
                    arcname = f"selected_images_{task_id[:8]}/{image_name}"
                    zipf.write(image_path, arcname)
        
        # ダウンロード用のファイル名
        download_filename = f"selected_images_{task_id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        current_app.logger.info(f"選択画像ZIP作成完了: {task_id}, {len(image_names)}枚の画像")
        
        return send_file(
            temp_zip.name, 
            as_attachment=True, 
            download_name=download_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        current_app.logger.error(f"選択画像ZIP作成エラー {task_id}: {str(e)}")
        return jsonify({"error": f"ZIP作成中にエラーが発生しました: {str(e)}"}), 500


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


@video_bp.route('/processing-history')
def get_processing_history():
    """
    動画処理履歴を取得
    
    Returns:
    - JSON: 処理履歴のリスト
    """
    from app import app
    
    try:
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
        
        return jsonify({"history": extracted_dirs})
        
    except Exception as e:
        current_app.logger.error(f"処理履歴取得エラー: {str(e)}")
        return jsonify({"error": "処理履歴の取得に失敗しました"}), 500