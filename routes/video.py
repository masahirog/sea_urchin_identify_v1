"""
routes/video.py - 動画処理ルート

リネーム元:
- routes/video_routes.py → routes/video.py

機能:
- 動画アップロード・処理
- 生殖乳頭画像抽出
- 処理状況監視
- 結果ダウンロード
- 処理履歴管理
"""

from flask import Blueprint, request, jsonify, url_for, current_app, render_template, send_file
from werkzeug.utils import secure_filename
import os
import uuid
import zipfile
import tempfile
from datetime import datetime

video_bp = Blueprint('video', __name__)

# ================================
# ページルート
# ================================

@video_bp.route('/')
def video_page():
    """動画処理メインページ"""
    return render_template('video_processing.html')

@video_bp.route('/processing')
def processing_page():
    """動画処理専用ページを表示"""
    return render_template('video_processing.html')

# ================================
# 動画処理API
# ================================

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

# ================================
# 処理状況・結果取得API
# ================================

@video_bp.route('/status/<task_id>')
def get_processing_status(task_id):
    """
    動画処理状況を取得
    
    Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - JSON: 処理状況
    """
    from app import processing_status
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    # ステータスの取得
    status = processing_status.get(task_id, {"status": "unknown", "message": "タスクが見つかりません"})
    
    current_app.logger.debug(f"動画処理状況取得: {task_id} = {status}")
    
    return jsonify(status)

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

# ================================
# ダウンロード機能
# ================================

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

# ================================
# タスク管理
# ================================

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

@video_bp.route('/cancel-task/<task_id>', methods=['POST'])
def cancel_task(task_id):
    """
    実行中のタスクをキャンセル
    
    Parameters:
    - task_id: キャンセルするタスクのID
    
    Returns:
    - JSON: キャンセル結果
    """
    from app import processing_status
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    # タスクの存在確認
    if task_id not in processing_status:
        return jsonify({"error": "指定されたタスクが見つかりません"}), 404
    
    # タスクの状態確認
    status = processing_status[task_id]
    
    # すでに完了または失敗したタスクはキャンセル不可
    if status.get('status') in ['completed', 'failed', 'error']:
        return jsonify({
            "error": "すでに完了または失敗したタスクはキャンセルできません",
            "current_status": status
        }), 400
    
    # 状態をキャンセルに更新
    processing_status[task_id] = {
        "status": "cancelled",
        "message": "ユーザーによってキャンセルされました",
        "previous_status": status
    }
    
    current_app.logger.info(f"動画処理タスクをキャンセルしました: {task_id}")
    
    return jsonify({
        "success": True,
        "message": "タスクがキャンセルされました",
        "task_id": task_id
    })

# ================================
# 履歴・統計
# ================================

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

@video_bp.route('/stats')
def get_video_stats():
    """
    動画処理統計情報を取得
    
    Returns:
    - JSON: 動画処理統計
    """
    from app import app, processing_status
    
    try:
        # 処理済みタスクの統計
        base_dir = app.config['EXTRACTED_FOLDER']
        total_tasks = 0
        total_images = 0
        
        if os.path.exists(base_dir):
            for task_id in os.listdir(base_dir):
                task_dir = os.path.join(base_dir, task_id)
                if os.path.isdir(task_dir):
                    images = [f for f in os.listdir(task_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                    if images:
                        total_tasks += 1
                        total_images += len(images)
        
        # アクティブタスク統計
        active_tasks = len([t for t in processing_status.values() 
                           if t.get('status') in ['processing', 'queued', 'running']])
        
        return jsonify({
            "total_tasks": total_tasks,
            "total_extracted_images": total_images,
            "active_tasks": active_tasks,
            "average_images_per_task": round(total_images / total_tasks, 1) if total_tasks > 0 else 0
        })
        
    except Exception as e:
        current_app.logger.error(f"動画処理統計取得エラー: {str(e)}")
        return jsonify({"error": "統計情報の取得に失敗しました"}), 500

# ================================
# 画像プレビュー・個別操作
# ================================

@video_bp.route('/preview-image/<task_id>/<filename>')
def preview_image(task_id, filename):
    """
    抽出画像のプレビュー情報を取得
    
    Parameters:
    - task_id: タスクID
    - filename: 画像ファイル名
    
    Returns:
    - JSON: 画像情報
    """
    from app import app
    
    # パス検証
    if '..' in task_id or '..' in filename:
        return jsonify({"error": "不正なパスです"}), 400
    
    task_dir = os.path.join(app.config['EXTRACTED_FOLDER'], task_id)
    image_path = os.path.join(task_dir, filename)
    
    if not os.path.exists(image_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        # 画像情報取得
        stat = os.stat(image_path)
        
        return jsonify({
            "filename": filename,
            "task_id": task_id,
            "file_size": stat.st_size,
            "created_date": datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
            "image_url": url_for('image.get_image', path=os.path.join(task_id, filename), _external=True)
        })
        
    except Exception as e:
        current_app.logger.error(f"画像プレビュー取得エラー: {str(e)}")
        return jsonify({"error": "画像情報の取得に失敗しました"}), 500

@video_bp.route('/save-image-to-dataset', methods=['POST'])
def save_image_to_dataset():
    """
    抽出画像を学習データセットに保存
    
    Request:
    - task_id: タスクID
    - filename: 画像ファイル名
    - gender: 性別カテゴリ ('male' または 'female')
    
    Returns:
    - JSON: 保存結果
    """
    from app import app
    import shutil
    
    data = request.json
    
    if not data or not all(key in data for key in ['task_id', 'filename', 'gender']):
        return jsonify({"error": "必要なパラメータがありません"}), 400
    
    task_id = data['task_id']
    filename = data['filename']
    gender = data['gender']
    
    if gender not in ['male', 'female']:
        return jsonify({"error": "性別は 'male' または 'female' である必要があります"}), 400
    
    # パス検証
    if '..' in task_id or '..' in filename:
        return jsonify({"error": "不正なパスです"}), 400
    
    # ソースファイルパス
    source_path = os.path.join(app.config['EXTRACTED_FOLDER'], task_id, filename)
    
    if not os.path.exists(source_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        # 保存先ディレクトリ
        target_dir = os.path.join(app.config['DATASET_FOLDER'], gender)
        os.makedirs(target_dir, exist_ok=True)
        
        # 保存先パス
        target_path = os.path.join(target_dir, filename)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        if os.path.exists(target_path):
            name, ext = os.path.splitext(filename)
            unique_suffix = uuid.uuid4().hex[:8]
            filename = f"{name}_{unique_suffix}{ext}"
            target_path = os.path.join(target_dir, filename)
        
        # 画像のコピー
        shutil.copy(source_path, target_path)
        current_app.logger.info(f"抽出画像をデータセットに保存: {gender}/{filename}")
        
        return jsonify({
            "success": True, 
            "message": f"画像を {gender} カテゴリに保存しました",
            "filename": filename,
            "path": target_path
        })
        
    except Exception as e:
        current_app.logger.error(f"データセット保存エラー: {str(e)}")
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500