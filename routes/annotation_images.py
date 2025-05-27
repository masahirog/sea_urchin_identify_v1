from flask import Blueprint, request, jsonify, render_template, current_app, send_from_directory
import os
import json
import shutil
from werkzeug.utils import secure_filename
from datetime import datetime
from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, METADATA_FILE

annotation_images_bp = Blueprint('annotation_images', __name__, url_prefix='/annotation/images')

def ensure_annotation_directories():
    """アノテーション用ディレクトリを作成"""
    os.makedirs(TRAINING_IMAGES_DIR, exist_ok=True)
    os.makedirs(TRAINING_LABELS_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)

# 初期化
ensure_annotation_directories()

@annotation_images_bp.route('/')
def images_management_page():
    """画像管理ページ"""
    return render_template('annotation_images.html')

@annotation_images_bp.route('/upload', methods=['POST'])
def upload_images():
    """画像をアップロード"""
    if 'images' not in request.files:
        return jsonify({'error': '画像がアップロードされていません'}), 400
    
    files = request.files.getlist('images')
    uploaded_files = []
    errors = []
    
    for file in files:
        if file.filename == '':
            continue
            
        try:
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            
            # 学習画像ディレクトリに保存
            image_path = os.path.join(TRAINING_IMAGES_DIR, unique_filename)
            file.save(image_path)
            
            # メタデータを作成
            file_info = {
                'id': unique_filename,
                'original_name': filename,
                'upload_time': timestamp,
                'annotated': False,
                'annotation_count': 0
            }
            
            # メタデータを保存
            update_annotation_metadata(unique_filename, file_info)
            
            uploaded_files.append(file_info)
            
        except Exception as e:
            errors.append({'file': file.filename, 'error': str(e)})
    
    return jsonify({
        'success': len(uploaded_files) > 0,
        'uploaded_files': uploaded_files,
        'errors': errors,
        'message': f'{len(uploaded_files)}枚の画像をアップロードしました'
    })

@annotation_images_bp.route('/list', methods=['GET'])
def list_images():
    """画像一覧を取得（ページネーション、フィルタリング付き）"""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filter_status = request.args.get('status', 'all')  # all, annotated, not_annotated
    
    # メタデータを読み込み
    metadata = load_annotation_metadata()
    
    # 実際に存在するファイルのみをリストアップ
    all_images = []
    
    if os.path.exists(TRAINING_IMAGES_DIR):
        for image_file in os.listdir(TRAINING_IMAGES_DIR):
            if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_info = metadata.get(image_file, {
                    'id': image_file,
                    'original_name': image_file,
                    'annotated': False,
                    'annotation_count': 0
                })
                
                # ラベルファイルの存在確認
                label_path = os.path.join(TRAINING_LABELS_DIR, 
                                         os.path.splitext(image_file)[0] + '.txt')
                if os.path.exists(label_path):
                    with open(label_path, 'r') as f:
                        annotation_count = len([line for line in f.readlines() if line.strip()])
                    image_info['annotated'] = annotation_count > 0
                    image_info['annotation_count'] = annotation_count
                
                all_images.append(image_info)
    
    # フィルタリング
    if filter_status == 'annotated':
        filtered_images = [img for img in all_images if img['annotated']]
    elif filter_status == 'not_annotated':
        filtered_images = [img for img in all_images if not img['annotated']]
    else:
        filtered_images = all_images
    
    # ソート（新しい順）
    filtered_images.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
    
    # ページネーション
    total = len(filtered_images)
    start = (page - 1) * per_page
    end = start + per_page
    images = filtered_images[start:end]
    
    # 統計情報
    total_annotations = sum(img['annotation_count'] for img in all_images)
    
    return jsonify({
        'images': images,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page,
        'statistics': {
            'total_images': len(all_images),
            'annotated_images': len([img for img in all_images if img['annotated']]),
            'total_annotations': total_annotations
        }
    })

@annotation_images_bp.route('/delete', methods=['POST'])
def delete_images():
    """複数画像を削除"""
    data = request.json
    image_ids = data.get('image_ids', [])
    
    deleted_count = 0
    errors = []
    
    for image_id in image_ids:
        try:
            # ファイルを削除
            image_path = os.path.join(TRAINING_IMAGES_DIR, image_id)
            label_path = os.path.join(TRAINING_LABELS_DIR, 
                                     os.path.splitext(image_id)[0] + '.txt')
            
            if os.path.exists(image_path):
                os.remove(image_path)
            if os.path.exists(label_path):
                os.remove(label_path)
            
            # メタデータから削除
            metadata = load_annotation_metadata()
            if image_id in metadata:
                del metadata[image_id]
                save_annotation_metadata(metadata)
            
            deleted_count += 1
            
        except Exception as e:
            errors.append({'id': image_id, 'error': str(e)})
    
    return jsonify({
        'success': deleted_count > 0,
        'deleted_count': deleted_count,
        'errors': errors
    })

@annotation_images_bp.route('/image/<image_id>')
def get_image(image_id):
    """画像を取得（アノテーション付き）"""
    try:
        image_path = os.path.join(TRAINING_IMAGES_DIR, image_id)
        if not os.path.exists(image_path):
            return jsonify({'error': '画像が見つかりません'}), 404
        
        label_path = os.path.join(TRAINING_LABELS_DIR, 
                                 os.path.splitext(image_id)[0] + '.txt')
        
        # アノテーションがある場合は描画して返す
        if os.path.exists(label_path):
            import cv2
            import numpy as np
            from flask import make_response
            
            image = cv2.imread(image_path)
            height, width = image.shape[:2]
            
            with open(label_path, 'r') as f:
                for line in f:
                    if line.strip():
                        parts = line.strip().split()
                        if len(parts) == 5:
                            class_id = int(parts[0])
                            x_center = float(parts[1]) * width
                            y_center = float(parts[2]) * height
                            box_width = float(parts[3]) * width
                            box_height = float(parts[4]) * height
                            
                            x1 = int(x_center - box_width / 2)
                            y1 = int(y_center - box_height / 2)
                            x2 = int(x_center + box_width / 2)
                            y2 = int(y_center + box_height / 2)
                            
                            # クラスに応じた色
                            if class_id == 0:
                                color = (255, 0, 0)  # 青
                                label = "Male"
                            elif class_id == 1:
                                color = (0, 0, 255)  # 赤
                                label = "Female"
                            elif class_id == 2:
                                color = (0, 255, 0)  # 緑
                                label = "Madreporite"
                            else:
                                color = (128, 128, 128)
                                label = f"Class {class_id}"
                            
                            # 太い線で描画
                            cv2.rectangle(image, (x1, y1), (x2, y2), color, 6)
                            
                            # ラベル背景
                            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                            cv2.rectangle(image, (x1, y1 - 25), (x1 + label_size[0] + 5, y1), color, -1)
                            cv2.putText(image, label, (x1 + 2, y1 - 8), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            _, buffer = cv2.imencode('.png', image)
            response = make_response(buffer.tobytes())
            response.headers['Content-Type'] = 'image/png'
            return response
        else:
            # アノテーションがない場合は元画像を返す
            return send_from_directory(os.path.dirname(image_path), os.path.basename(image_path))
            
    except Exception as e:
        current_app.logger.error(f'画像取得エラー: {str(e)}')
        return jsonify({'error': str(e)}), 500

# ヘルパー関数
def load_annotation_metadata():
    """アノテーションメタデータを読み込み"""
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_annotation_metadata(metadata):
    """アノテーションメタデータを保存"""
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def update_annotation_metadata(image_id, info):
    """アノテーションメタデータを更新"""
    metadata = load_annotation_metadata()
    if image_id not in metadata:
        metadata[image_id] = {}
    metadata[image_id].update(info)
    save_annotation_metadata(metadata)