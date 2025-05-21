from flask import Blueprint, request, jsonify, url_for, send_from_directory
from werkzeug.utils import secure_filename
import os
import base64

image_bp = Blueprint('image', __name__)

@image_bp.route('/<path:path>')
def get_image(path):
    from app import app
    return send_from_directory(app.config['EXTRACTED_FOLDER'], path)

@image_bp.route('/delete', methods=['POST'])
def delete_image():
    from app import app
    
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

@image_bp.route('/upload', methods=['POST'])
def upload_image():
    from app import app
    from utils.file_handlers import allowed_file, is_image_file
    from models.analyzer import UrchinPapillaeAnalyzer
    
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
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
            result["marked_image_url"] = url_for('uploads.get_uploaded_file', filename=image_name, _external=True)
        
        return jsonify(result)
    
    return jsonify({"error": "無効なファイル形式です"}), 400

@image_bp.route('/save-to-dataset', methods=['POST'])
def save_to_dataset():
    from app import app
    import shutil
    
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
        shutil.copy(image_path, target_path)
        
        return jsonify({"success": True, "message": f"画像を {gender} カテゴリに保存しました"})
        
    except Exception as e:
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500

@image_bp.route('/save-marked-image', methods=['POST'])
def save_marked_image():
    from app import app
    
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