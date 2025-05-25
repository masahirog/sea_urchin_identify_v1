"""
ウニ生殖乳頭分析システム - ファイル処理ユーティリティ
ファイル拡張子の検証や種類判別などの機能を提供する
"""

import os
import uuid
from werkzeug.utils import secure_filename


def allowed_file(filename, allowed_extensions):
    """ファイルの拡張子をチェック"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

def is_image_file(filename):
    """画像ファイルかどうかをチェック"""
    image_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in image_extensions




def get_file_extension(filename):
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''


def get_safe_filename(filename):
    import re
    safe_name = re.sub(r'[^\w\.\-]', '_', filename)
    
    # 複数のアンダースコアを一つにまとめる
    safe_name = re.sub(r'_+', '_', safe_name)
    
    return safe_name

def find_image_path(filename):
    """画像ファイルのパスを検索する共通関数"""
    from flask import current_app
    
    search_dirs = [
        os.path.join(current_app.config.get('STATIC_FOLDER', 'static'), 'images/samples/papillae/male'),
        os.path.join(current_app.config.get('STATIC_FOLDER', 'static'), 'images/samples/papillae/female'),
        os.path.join(current_app.config.get('UPLOAD_FOLDER', 'data/uploads'), 'yolo_detect'),
        os.path.join(current_app.config.get('UPLOAD_FOLDER', 'data/uploads'), 'yolo_batch'),
        'data/uploads'
    ]
    
    for dir_path in search_dirs:
        if os.path.exists(dir_path):
            possible_path = os.path.join(dir_path, filename)
            if os.path.exists(possible_path):
                return possible_path
    
    return None

def handle_multiple_image_upload(files, target_dir, allowed_extensions=None):
    """複数画像アップロードの共通処理"""
    import uuid
    from werkzeug.utils import secure_filename
    
    if allowed_extensions is None:
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
    
    uploaded_files = []
    errors = []
    
    os.makedirs(target_dir, exist_ok=True)
    
    for file in files:
        if file and file.filename != '':
            if allowed_file(file.filename, allowed_extensions) and is_image_file(file.filename):
                try:
                    filename = secure_filename(file.filename)
                    
                    # ユニークなファイル名生成
                    target_path = os.path.join(target_dir, filename)
                    if os.path.exists(target_path):
                        name, ext = os.path.splitext(filename)
                        unique_suffix = uuid.uuid4().hex[:8]
                        filename = f"{name}_{unique_suffix}{ext}"
                        target_path = os.path.join(target_dir, filename)
                    
                    file.save(target_path)
                    uploaded_files.append({
                        'filename': filename,
                        'path': target_path,
                        'relative_path': os.path.relpath(target_path, 'static') if target_path.startswith('static') else target_path
                    })
                    
                except Exception as e:
                    errors.append(f"{file.filename}: {str(e)}")
            else:
                errors.append(f"{file.filename}: 無効なファイル形式です")
    
    return uploaded_files, errors