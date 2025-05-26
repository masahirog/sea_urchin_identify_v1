# routes/annotation.py

from flask import Blueprint, request, jsonify, render_template, current_app, send_from_directory, make_response
import os
import json
import shutil
from werkzeug.utils import secure_filename
from datetime import datetime
import cv2
import numpy as np
from PIL import Image

annotation_bp = Blueprint('annotation', __name__, url_prefix='/annotation')

# アノテーション済み画像の管理用ディレクトリ
ANNOTATED_IMAGES_DIR = 'static/images/annotations'
ANNOTATION_METADATA_FILE = 'data/annotation_metadata.json'

def ensure_annotation_directories():
    """アノテーション用ディレクトリを作成"""
    os.makedirs(ANNOTATED_IMAGES_DIR, exist_ok=True)
    os.makedirs(os.path.join(ANNOTATED_IMAGES_DIR, 'images'), exist_ok=True)
    os.makedirs(os.path.join(ANNOTATED_IMAGES_DIR, 'labels'), exist_ok=True)

# 初期化
ensure_annotation_directories()

@annotation_bp.route('/')
def annotation_page():
    """アノテーション管理ページ"""
    return render_template('annotation_management.html')

@annotation_bp.route('/upload-images', methods=['POST'])
def upload_images():
    """画像をアップロード（アノテーション用）"""
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
            
            # 一時保存先
            temp_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(temp_path)
            
            # ファイル情報を記録（相対パスを使用）
            file_info = {
                'id': unique_filename,
                'original_name': filename,
                'upload_time': timestamp,
                'temp_path': f'/uploads/{unique_filename}',  # 相対URLパスに変更
                'annotated': False,
                'annotation_count': 0
            }
            
            uploaded_files.append(file_info)
            
        except Exception as e:
            errors.append({'file': file.filename, 'error': str(e)})
    
    return jsonify({
        'success': len(uploaded_files) > 0,
        'uploaded_files': uploaded_files,
        'errors': errors,
        'message': f'{len(uploaded_files)}枚の画像をアップロードしました'
    })

@annotation_bp.route('/save-annotated-image', methods=['POST'])
def save_annotated_image():
    """アノテーション済み画像を保存"""
    data = request.json
    
    image_id = data.get('image_id')
    yolo_annotations = data.get('annotations', '')
    annotation_count = data.get('annotation_count', 0)
    
    if not image_id:
        return jsonify({'error': '画像IDが指定されていません'}), 400
    
    try:
        # 画像のIDから実際のファイルパスを取得
        source_path = os.path.join(current_app.config['UPLOAD_FOLDER'], image_id)
        if not os.path.exists(source_path):
            # IDがファイル名の場合の処理
            if '/' not in image_id:
                source_path = os.path.join(current_app.config['UPLOAD_FOLDER'], image_id)
            else:
                return jsonify({'error': '不正な画像IDです'}), 400
        
        if not os.path.exists(source_path):
            return jsonify({'error': '元画像が見つかりません'}), 404
        
        # 保存先パス
        image_dest = os.path.join(ANNOTATED_IMAGES_DIR, 'images', image_id)
        label_dest = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
                                 os.path.splitext(image_id)[0] + '.txt')
        
        # 既存のファイルをチェック（重複防止）
        if os.path.exists(image_dest):
            current_app.logger.info(f'画像は既に保存済み: {image_id}')
        else:
            # 画像をコピー
            shutil.copy2(source_path, image_dest)
        
        # YOLOアノテーションを保存（常に上書き）
        with open(label_dest, 'w') as f:
            f.write(yolo_annotations)
        
        # クラス別カウント
        male_count = 0
        female_count = 0
        madreporite_count = 0

        if yolo_annotations:
            for line in yolo_annotations.strip().split('\n'):
                if line:
                    class_id = int(line.split()[0])
                    if class_id == 0:
                        male_count += 1
                    elif class_id == 1:
                        female_count += 1
                    elif class_id == 2:
                        madreporite_count += 1
        
        # メタデータを更新
        update_annotation_metadata(image_id, {
            'annotated': True,
            'annotation_count': annotation_count,
            'annotation_time': datetime.now().isoformat(),
            'image_path': image_dest,
            'label_path': label_dest,
            'original_name': data.get('original_name', image_id),
            'classes': {'male': male_count, 'female': female_count,'madreporite': madreporite_count}
        })
        
        return jsonify({
            'success': True,
            'message': 'アノテーションを保存しました',
            'image_id': image_id
        })
        
    except Exception as e:
        current_app.logger.error(f'アノテーション保存エラー: {str(e)}')
        return jsonify({'error': str(e)}), 500

@annotation_bp.route('/get-annotated-images')
def get_annotated_images():
    """保存済みアノテーション画像の一覧を取得"""
    metadata = load_annotation_metadata()
    
    annotated_images = []
    # 実際に存在するファイルのみをリストアップ
    images_dir = os.path.join(ANNOTATED_IMAGES_DIR, 'images')
    
    if os.path.exists(images_dir):
        for image_file in os.listdir(images_dir):
            if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                # メタデータから情報を取得
                image_info = metadata.get(image_file, {})
                
                # ラベルファイルの存在確認
                label_path = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
                                         os.path.splitext(image_file)[0] + '.txt')
                
                if os.path.exists(label_path):
                    # アノテーション数をカウント
                    with open(label_path, 'r') as f:
                        annotation_count = len([line for line in f.readlines() if line.strip()])
                    
                    annotated_images.append({
                        'id': image_file,
                        'original_name': image_info.get('original_name', image_file),
                        'annotation_count': annotation_count,
                        'annotation_time': image_info.get('annotation_time', ''),
                        'classes': image_info.get('classes', {'male': 0, 'female': 1, 'madreporite': 2})
                    })
    
    # 新しい順にソート
    annotated_images.sort(key=lambda x: x['annotation_time'], reverse=True)
    
    # 統計情報
    total_images = len(annotated_images)
    total_annotations = sum(img['annotation_count'] for img in annotated_images)
    
    return jsonify({
        'images': annotated_images,
        'statistics': {
            'total_images': total_images,
            'total_annotations': total_annotations,
            'ready_for_training': total_images >= 10  # 最低10枚で学習可能
        }
    })

@annotation_bp.route('/delete-annotated-image/<image_id>', methods=['DELETE'])
def delete_annotated_image(image_id):
    """アノテーション済み画像を削除"""
    try:
        # ファイルを削除
        image_path = os.path.join(ANNOTATED_IMAGES_DIR, 'images', image_id)
        label_path = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
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
        
        return jsonify({'success': True, 'message': '画像を削除しました'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotation_bp.route('/batch-delete', methods=['POST'])
def batch_delete_annotations():
    """複数のアノテーション済み画像を一括削除"""
    data = request.json
    image_ids = data.get('image_ids', [])
    
    deleted_count = 0
    errors = []
    
    for image_id in image_ids:
        try:
            result = delete_annotated_image(image_id)
            if result[1] == 200:  # 成功
                deleted_count += 1
        except Exception as e:
            errors.append({'id': image_id, 'error': str(e)})
    
    return jsonify({
        'success': deleted_count > 0,
        'deleted_count': deleted_count,
        'errors': errors
    })

# ヘルパー関数
def load_annotation_metadata():
    """アノテーションメタデータを読み込み"""
    if os.path.exists(ANNOTATION_METADATA_FILE):
        try:
            with open(ANNOTATION_METADATA_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_annotation_metadata(metadata):
    """アノテーションメタデータを保存"""
    os.makedirs(os.path.dirname(ANNOTATION_METADATA_FILE), exist_ok=True)
    with open(ANNOTATION_METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def update_annotation_metadata(image_id, info):
    """アノテーションメタデータを更新"""
    metadata = load_annotation_metadata()
    if image_id not in metadata:
        metadata[image_id] = {}
    metadata[image_id].update(info)
    save_annotation_metadata(metadata)

@annotation_bp.route('/get-annotated-image/<image_id>')
def get_annotated_image(image_id):
    """アノテーション付き画像を取得（バウンディングボックス描画済み）"""
    try:
        # 画像パス
        image_path = os.path.join(ANNOTATED_IMAGES_DIR, 'images', image_id)
        if not os.path.exists(image_path):
            return jsonify({'error': '画像が見つかりません'}), 404
        
        # ラベルパス
        label_path = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
                                 os.path.splitext(image_id)[0] + '.txt')
        
        # 画像を読み込み
        image = cv2.imread(image_path)
        if image is None:
            return jsonify({'error': '画像の読み込みに失敗しました'}), 500
        
        # ラベルが存在する場合、バウンディングボックスを描画
        if os.path.exists(label_path):
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
                            
                            # 座標計算
                            x1 = int(x_center - box_width / 2)
                            y1 = int(y_center - box_height / 2)
                            x2 = int(x_center + box_width / 2)
                            y2 = int(y_center + box_height / 2)
                            
                            # クラスに応じた色とラベル（修正版：3クラス対応）
                            if class_id == 0:
                                color = (255, 0, 0)  # 青（BGR形式）
                                label = "Male"
                            elif class_id == 1:
                                color = (0, 0, 255)  # 赤（BGR形式）
                                label = "Female"
                            elif class_id == 2:
                                color = (0, 255, 0)  # 緑（BGR形式）
                                label = "Madreporite"  # 多孔板
                            else:
                                color = (128, 128, 128)  # グレー（未知のクラス）
                                label = f"Class {class_id}"
                            
                            # バウンディングボックス描画
                            cv2.rectangle(image, (x1, y1), (x2, y2), color, 4)
                            
                            # ラベル描画
                            cv2.putText(image, label, (x1, y1 - 10), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 3)
        
        # 画像をエンコードして返す
        _, buffer = cv2.imencode('.png', image)
        response = make_response(buffer.tobytes())
        response.headers['Content-Type'] = 'image/png'
        return response
        
    except Exception as e:
        current_app.logger.error(f'画像取得エラー: {str(e)}')
        return jsonify({'error': str(e)}), 500

@annotation_bp.route('/get-original-image/<image_id>')
def get_original_image(image_id):
    """オリジナル画像を取得（アノテーションなし）"""
    try:
        image_path = os.path.join(ANNOTATED_IMAGES_DIR, 'images', image_id)
        if not os.path.exists(image_path):
            return jsonify({'error': '画像が見つかりません'}), 404
        
        return send_from_directory(os.path.dirname(image_path), os.path.basename(image_path))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotation_bp.route('/get-annotation-data/<image_id>')
def get_annotation_data(image_id):
    """アノテーションデータを取得"""
    try:
        label_path = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
                                 os.path.splitext(image_id)[0] + '.txt')
        
        if os.path.exists(label_path):
            with open(label_path, 'r') as f:
                annotations = f.read()
            return jsonify({'annotations': annotations})
        else:
            return jsonify({'annotations': ''})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotation_bp.route('/update-annotation', methods=['POST'])
def update_annotation():
    """アノテーションを更新"""
    data = request.json
    
    image_id = data.get('image_id')
    yolo_annotations = data.get('annotations', '')
    annotation_count = data.get('annotation_count', 0)
    
    if not image_id:
        return jsonify({'error': '画像IDが指定されていません'}), 400
    
    try:
        # ラベルファイルのパス
        label_path = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', 
                                 os.path.splitext(image_id)[0] + '.txt')
        
        # YOLOアノテーションを保存
        with open(label_path, 'w') as f:
            f.write(yolo_annotations)
        
        # クラス別カウント
        male_count = 0
        female_count = 0
        if yolo_annotations:
            for line in yolo_annotations.strip().split('\n'):
                if line:
                    class_id = int(line.split()[0])
                    if class_id == 0:
                        male_count += 1
                    elif class_id == 1:
                        female_count += 1
        
        # メタデータを更新
        update_annotation_metadata(image_id, {
            'annotation_count': annotation_count,
            'annotation_time': datetime.now().isoformat(),
            'classes': {'male': male_count, 'female': female_count}
        })
        
        return jsonify({
            'success': True,
            'message': 'アノテーションを更新しました'
        })
        
    except Exception as e:
        current_app.logger.error(f'アノテーション更新エラー: {str(e)}')
        return jsonify({'error': str(e)}), 500
def cleanup_duplicates():
    """重複したアノテーション画像をクリーンアップ"""
    try:
        metadata = load_annotation_metadata()
        cleaned_metadata = {}
        removed_count = 0
        
        # 実際に存在するファイルのみを保持
        images_dir = os.path.join(ANNOTATED_IMAGES_DIR, 'images')
        if os.path.exists(images_dir):
            for image_file in os.listdir(images_dir):
                if image_file in metadata:
                    cleaned_metadata[image_file] = metadata[image_file]
        
        # 削除されたエントリーをカウント
        removed_count = len(metadata) - len(cleaned_metadata)
        
        # クリーンなメタデータを保存
        save_annotation_metadata(cleaned_metadata)
        
        return jsonify({
            'success': True,
            'message': f'{removed_count}個の重複エントリーをクリーンアップしました',
            'removed_count': removed_count
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
def export_dataset():
    """学習用データセットとしてエクスポート"""
    try:
        # YOLOデータセット形式で準備
        dataset_dir = 'data/yolo_dataset'
        
        # 既存のデータセットをクリア
        if os.path.exists(dataset_dir):
            shutil.rmtree(dataset_dir)
        
        # ディレクトリ構造を作成
        os.makedirs(os.path.join(dataset_dir, 'images/train'), exist_ok=True)
        os.makedirs(os.path.join(dataset_dir, 'images/val'), exist_ok=True)
        os.makedirs(os.path.join(dataset_dir, 'labels/train'), exist_ok=True)
        os.makedirs(os.path.join(dataset_dir, 'labels/val'), exist_ok=True)
        
        # アノテーション済み画像をコピー
        metadata = load_annotation_metadata()
        annotated_images = [img_id for img_id, info in metadata.items() 
                           if info.get('annotated', False)]
        
        # 訓練用と検証用に分割（8:2）
        split_idx = int(len(annotated_images) * 0.8)
        train_images = annotated_images[:split_idx]
        val_images = annotated_images[split_idx:]
        
        # ファイルをコピー
        for img_list, subset in [(train_images, 'train'), (val_images, 'val')]:
            for image_id in img_list:
                # 画像
                src_img = os.path.join(ANNOTATED_IMAGES_DIR, 'images', image_id)
                dst_img = os.path.join(dataset_dir, f'images/{subset}', image_id)
                if os.path.exists(src_img):
                    shutil.copy2(src_img, dst_img)
                
                # ラベル
                label_name = os.path.splitext(image_id)[0] + '.txt'
                src_label = os.path.join(ANNOTATED_IMAGES_DIR, 'labels', label_name)
                dst_label = os.path.join(dataset_dir, f'labels/{subset}', label_name)
                if os.path.exists(src_label):
                    shutil.copy2(src_label, dst_label)
        
        # data.yamlを生成
        yaml_content = f"""path: {os.path.abspath(dataset_dir)}
train: images/train
val: images/val

names:
  0: male_papillae
  1: female_papillae
"""
        
        with open(os.path.join(dataset_dir, 'data.yaml'), 'w') as f:
            f.write(yaml_content)
        
        return jsonify({
            'success': True,
            'message': 'データセットをエクスポートしました',
            'statistics': {
                'total_images': len(annotated_images),
                'train_images': len(train_images),
                'val_images': len(val_images)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f'データセットエクスポートエラー: {str(e)}')
        return jsonify({'error': str(e)}), 500