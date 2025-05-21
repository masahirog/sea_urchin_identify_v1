"""
ウニ生殖乳頭分析システム - 画像処理ルート
画像アップロードや分析機能を提供する
"""

from flask import Blueprint, request, jsonify, url_for, send_from_directory, current_app
from werkzeug.utils import secure_filename
import os
import base64
import uuid
import traceback

image_bp = Blueprint('image', __name__)


@image_bp.route('/<path:path>')
def get_image(path):
    """
    抽出画像ファイルを提供
    
    Parameters:
    - path: 画像ファイルの相対パス
    
    Returns:
    - Response: 画像ファイル
    """
    from app import app
    
    # パスの検証
    if '..' in path or path.startswith('/'):
        current_app.logger.warning(f"不正なパスへのアクセス試行: {path}")
        return jsonify({"error": "不正なパスです"}), 400
    
    # ディレクトリ名とファイル名を分離
    parts = path.split('/')
    filename = parts[-1]
    dirname = '/'.join(parts[:-1]) if len(parts) > 1 else ''
    
    # 画像を提供
    extracted_folder = app.config['EXTRACTED_FOLDER']
    image_path = os.path.join(extracted_folder, dirname)
    
    return send_from_directory(image_path, filename)


@image_bp.route('/delete', methods=['POST'])
def delete_image():
    """
    指定された画像を削除
    
    Request:
    - image_path: 削除する画像のパス
    
    Returns:
    - JSON: 削除結果
    """
    from app import app
    
    data = request.json
    
    if not data or 'image_path' not in data:
        return jsonify({"error": "画像パスが指定されていません"}), 400
    
    image_path = data['image_path']
    
    # パスの検証（不正なパスでないことを確認）
    if '..' in image_path:
        current_app.logger.warning(f"不正なパスへの削除試行: {image_path}")
        return jsonify({"error": "不正なパスです"}), 400
    
    # URLパスから実際のファイルパスに変換
    if image_path.startswith('/'):
        if image_path.startswith('/image/'):
            image_path = image_path.replace('/image/', '')
        image_path = os.path.join(app.config['EXTRACTED_FOLDER'], image_path)
    elif not os.path.exists(image_path):
        image_path = os.path.join(app.config['EXTRACTED_FOLDER'], image_path)
    
    if not os.path.exists(image_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        # 画像の削除
        os.remove(image_path)
        current_app.logger.info(f"画像を削除しました: {image_path}")
        return jsonify({"success": True, "message": "画像を削除しました"})
    except Exception as e:
        current_app.logger.error(f"画像削除エラー: {str(e)}")
        return jsonify({"error": f"画像の削除中にエラーが発生しました: {str(e)}"}), 500


@image_bp.route('/upload', methods=['POST'])
def upload_image():
    """
    画像をアップロードして分析
    
    Request:
    - image: アップロードする画像ファイル
    
    Returns:
    - JSON: 分析結果
    """
    from app import app
    from utils.file_handlers import allowed_file, is_image_file
    from models.analyzer import UrchinPapillaeAnalyzer
    
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
        # 安全なファイル名に変換
        filename = secure_filename(file.filename)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            name, ext = os.path.splitext(filename)
            unique_suffix = uuid.uuid4().hex[:8]
            filename = f"{name}_{unique_suffix}{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # ファイルを保存
        file.save(file_path)
        current_app.logger.info(f"画像をアップロード: {filename}")
        
        try:
            # 画像の判別
            analyzer = UrchinPapillaeAnalyzer()
            result = analyzer.classify_image(file_path)
            
            if "error" in result:
                current_app.logger.error(f"画像分析エラー: {result['error']}")
                return jsonify({"error": result["error"]}), 400
            
            # 画像へのURLを追加
            result["image_url"] = url_for('uploads.get_uploaded_file', filename=filename, _external=True)
            
            # 検出画像を生成
            from utils.image_analysis import detect_papillae
            detection_result = detect_papillae(file_path, app.config)
            
            if detection_result and "image_path" in detection_result:
                marked_image_name = os.path.basename(detection_result["image_path"])
                result["marked_image_url"] = url_for('uploads.get_uploaded_file', filename=marked_image_name, _external=True)
                result["papillae_count"] = detection_result["papillae_count"]
            
            return jsonify(result)
        
        except Exception as e:
            current_app.logger.error(f"画像処理エラー: {str(e)}")
            traceback.print_exc()
            return jsonify({"error": f"画像処理中にエラーが発生しました: {str(e)}"}), 500
    
    return jsonify({"error": "無効なファイル形式です"}), 400


@image_bp.route('/save-to-dataset', methods=['POST'])
def save_to_dataset():
    """
    画像をデータセットに保存
    
    Request:
    - image_path: データセットに保存する画像のパス
    - gender: 性別カテゴリ ('male' または 'female')
    
    Returns:
    - JSON: 保存結果
    """
    from app import app
    import shutil
    
    data = request.json
    
    if not data or 'image_path' not in data or 'gender' not in data:
        return jsonify({"error": "必要なパラメータがありません"}), 400
    
    image_path = data['image_path']
    gender = data['gender']
    
    if gender not in ['male', 'female']:
        return jsonify({"error": "性別は 'male' または 'female' である必要があります"}), 400
    
    # パスの検証
    if '..' in image_path:
        current_app.logger.warning(f"不正なパスへのアクセス試行: {image_path}")
        return jsonify({"error": "不正なパスです"}), 400
    
    # URLパスをファイルパスに変換（必要に応じて）
    if not os.path.exists(image_path) and image_path.startswith('/'):
        if image_path.startswith('/image/'):
            image_path = image_path.replace('/image/', '')
            image_path = os.path.join(app.config['EXTRACTED_FOLDER'], image_path)
        elif image_path.startswith('/uploads/'):
            image_path = image_path.replace('/uploads/', '')
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_path)
    
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
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        if os.path.exists(target_path):
            name, ext = os.path.splitext(filename)
            unique_suffix = uuid.uuid4().hex[:8]
            filename = f"{name}_{unique_suffix}{ext}"
            target_path = os.path.join(target_dir, filename)
        
        # 画像のコピー
        shutil.copy(image_path, target_path)
        current_app.logger.info(f"画像をデータセットに保存: {gender}/{filename}")
        
        return jsonify({
            "success": True, 
            "message": f"画像を {gender} カテゴリに保存しました",
            "filename": filename,
            "path": target_path
        })
        
    except Exception as e:
        current_app.logger.error(f"データセット保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500


@image_bp.route('/save-marked-image', methods=['POST'])
def save_marked_image():
    """
    マーキングされた画像を保存
    
    Request:
    - image_data: Base64エンコードされた画像データ
    - original_image_path: 元の画像パス
    
    Returns:
    - JSON: 保存結果
    """
    from app import app
    
    data = request.json
    
    if not data or 'image_data' not in data or 'original_image_path' not in data:
        return jsonify({"error": "必要なパラメータが不足しています"}), 400
    
    try:
        # Base64データの分割（コンテンツタイプと実際のデータ）
        image_data_parts = data['image_data'].split(',')
        if len(image_data_parts) > 1:
            # コンテンツタイプが含まれている場合
            image_data = image_data_parts[1]
        else:
            # コンテンツタイプが含まれていない場合
            image_data = image_data_parts[0]
        
        # Base64デコード
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            current_app.logger.error(f"Base64デコードエラー: {str(e)}")
            return jsonify({"error": f"画像データの解析に失敗しました: {str(e)}"}), 400
        
        # 元の画像パス
        original_path = data['original_image_path']
        
        # 元の画像からファイル名を取得
        filename = os.path.basename(original_path)
        basename, ext = os.path.splitext(filename)
        
        # 新しいファイル名（元の名前に_marked付加）
        new_filename = f"{basename}_marked{ext}"
        
        # 保存先ディレクトリ
        save_dir = os.path.dirname(original_path) if os.path.exists(original_path) else app.config['UPLOAD_FOLDER']
        if not os.path.exists(save_dir):
            save_dir = app.config['UPLOAD_FOLDER']
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        save_path = os.path.join(save_dir, new_filename)
        if os.path.exists(save_path):
            unique_suffix = uuid.uuid4().hex[:8]
            new_filename = f"{basename}_marked_{unique_suffix}{ext}"
            save_path = os.path.join(save_dir, new_filename)
        
        # 保存先ディレクトリが存在することを確認
        os.makedirs(save_dir, exist_ok=True)
        
        # 画像の保存
        with open(save_path, 'wb') as f:
            f.write(image_bytes)
        
        current_app.logger.info(f"マーキング画像を保存: {new_filename}")
        
        return jsonify({
            "success": True, 
            "message": "マーキング画像を保存しました",
            "image_path": save_path,
            "filename": new_filename
        })
        
    except Exception as e:
        current_app.logger.error(f"マーキング画像保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500