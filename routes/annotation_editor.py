from flask import Blueprint, request, jsonify, render_template, current_app
import os
import json
from datetime import datetime
from config import METADATA_FILE

annotation_editor_bp = Blueprint('annotation_editor', __name__, url_prefix='/annotation')

@annotation_editor_bp.route('/editor/')
def editor_page():
    """アノテーションエディタページ"""
    image_id = request.args.get('image', '')  # imageパラメータから取得
    folder = request.args.get('folder', 'default')  # folderパラメータから取得
    return render_template('annotation_editor.html',
                         initial_image_id=image_id,
                         folder=folder)

@annotation_editor_bp.route('/editor/load/<image_id>')
def load_annotation(image_id):
    """特定の画像とアノテーションを読み込み"""
    try:
        # フォルダパラメータを取得
        folder = request.args.get('folder', 'default')

        # フォルダごとのパスを構築
        base_dir = os.path.join('static', 'training_data', 'datasets', folder)
        images_dir = os.path.join(base_dir, 'images')
        labels_dir = os.path.join(base_dir, 'labels')

        # 画像の存在確認
        image_path = os.path.join(images_dir, image_id)
        if not os.path.exists(image_path):
            return jsonify({'error': '画像が見つかりません'}), 404

        # ラベルファイルの読み込み
        label_path = os.path.join(labels_dir,
                                 os.path.splitext(image_id)[0] + '.txt')
        
        annotations = ''
        if os.path.exists(label_path):
            with open(label_path, 'r') as f:
                annotations = f.read()
        
        # メタデータの取得
        metadata = load_annotation_metadata()
        image_info = metadata.get(image_id, {})
        
        return jsonify({
            'id': image_id,
            'original_name': image_info.get('original_name', image_id),
            'annotations': annotations,
            'annotation_count': len([line for line in annotations.split('\n') if line.strip()]),
            'image_url': f'/static/training_data/datasets/{folder}/images/{image_id}',
            'redirect_url': f'/annotation/editor/?image={image_id}&folder={folder}',
            'folder': folder
        })
        
    except Exception as e:
        current_app.logger.error(f'アノテーション読み込みエラー: {str(e)}')
        return jsonify({'error': str(e)}), 500

@annotation_editor_bp.route('/editor/save/<image_id>', methods=['POST'])
def save_annotation(image_id):
    """アノテーションを保存"""
    data = request.json
    yolo_annotations = data.get('annotations', '')
    annotation_count = data.get('annotation_count', 0)
    folder = data.get('folder', 'default')  # フォルダ情報を受け取る

    try:
        # フォルダごとのパスを構築
        base_dir = os.path.join('static', 'training_data', 'datasets', folder)
        labels_dir = os.path.join(base_dir, 'labels')

        # ラベルファイルの保存
        label_path = os.path.join(labels_dir,
                                 os.path.splitext(image_id)[0] + '.txt')
        
        with open(label_path, 'w') as f:
            f.write(yolo_annotations)
        
        # クラス別カウント
        male_count = 0
        female_count = 0
        madreporite_count = 0
        anus_count = 0

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
                    elif class_id == 3:
                        anus_count += 1

        # メタデータを更新
        update_annotation_metadata(image_id, {
            'annotated': annotation_count > 0,
            'annotation_count': annotation_count,
            'annotation_time': datetime.now().isoformat(),
            'classes': {
                'male': male_count,
                'female': female_count,
                'madreporite': madreporite_count,
                'anus': anus_count
            }
        })
        
        return jsonify({
            'success': True,
            'annotation_count': annotation_count
        })
        
    except Exception as e:
        current_app.logger.error(f'アノテーション保存エラー: {str(e)}')
        return jsonify({'error': str(e)}), 500

@annotation_editor_bp.route('/images/delete', methods=['POST'])
def delete_images():
    """選択された画像を削除"""
    data = request.json
    folder = data.get('folder', 'default')
    image_ids = data.get('image_ids', [])

    current_app.logger.info(f'削除リクエスト受信: folder={folder}, image_ids={image_ids}')

    if not image_ids:
        return jsonify({'error': 'パラメータが不足しています'}), 400

    # フォルダごとのパスを構築
    base_dir = os.path.join('static', 'training_data', 'datasets', folder)
    images_dir = os.path.join(base_dir, 'images')
    labels_dir = os.path.join(base_dir, 'labels')

    current_app.logger.info(f'削除対象ディレクトリ: images_dir={images_dir}, labels_dir={labels_dir}')

    if not os.path.exists(base_dir):
        current_app.logger.error(f'フォルダが見つかりません: {base_dir}')
        return jsonify({'error': 'フォルダが見つかりません'}), 404

    deleted_count = 0
    errors = []

    for image_id in image_ids:
        try:
            # 画像ファイルを削除
            image_path = os.path.join(images_dir, image_id)
            current_app.logger.info(f'削除対象画像: {image_path}, 存在: {os.path.exists(image_path)}')

            if os.path.exists(image_path):
                os.remove(image_path)
                current_app.logger.info(f'画像削除成功: {image_path}')

                # 対応するラベルファイルも削除
                label_name = os.path.splitext(image_id)[0] + '.txt'
                label_path = os.path.join(labels_dir, label_name)
                if os.path.exists(label_path):
                    os.remove(label_path)
                    current_app.logger.info(f'ラベル削除成功: {label_path}')

                deleted_count += 1
            else:
                error_msg = f'{image_id}: ファイルが見つかりません'
                errors.append(error_msg)
                current_app.logger.warning(error_msg)

        except Exception as e:
            errors.append(f'{image_id}: {str(e)}')
            current_app.logger.error(f'画像削除エラー: {image_id} - {str(e)}')

    current_app.logger.info(f'削除結果: deleted_count={deleted_count}, errors={errors}')

    return jsonify({
        'success': deleted_count > 0,
        'deleted_count': deleted_count,
        'errors': errors
    })

@annotation_editor_bp.route('/editor/list-for-edit')
def list_for_edit():
    """エディタ用の画像リストを取得（選択された画像のみ）"""
    # URLパラメータから選択された画像IDリストとフォルダを取得
    selected_ids = request.args.get('selected', '')
    folder = request.args.get('folder', 'default')

    if selected_ids:
        # カンマ区切りのIDリストを配列に変換
        selected_image_ids = [id.strip() for id in selected_ids.split(',') if id.strip()]
    else:
        selected_image_ids = None

    metadata = load_annotation_metadata()
    images = []

    # フォルダごとのパスを構築
    base_dir = os.path.join('static', 'training_data', 'datasets', folder)
    images_dir = os.path.join(base_dir, 'images')
    labels_dir = os.path.join(base_dir, 'labels')

    if os.path.exists(images_dir):
        all_image_files = []
        for image_file in os.listdir(images_dir):
            if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                # 選択されたIDリストがある場合はフィルタリング
                if selected_image_ids is None or image_file in selected_image_ids:
                    all_image_files.append(image_file)

        # ファイル名でソート（新しい順）
        all_image_files.sort(reverse=True)

        # 各画像の情報を構築
        for image_file in all_image_files:
            image_info = metadata.get(image_file, {})

            # アノテーション数を確認
            label_path = os.path.join(labels_dir,
                                     os.path.splitext(image_file)[0] + '.txt')
            annotation_count = 0
            if os.path.exists(label_path):
                with open(label_path, 'r') as f:
                    annotation_count = len([line for line in f.readlines() if line.strip()])
            
            images.append({
                'id': image_file,
                'original_name': image_info.get('original_name', image_file),
                'annotated': annotation_count > 0,
                'annotation_count': annotation_count,
                'thumbnail_url': f'/static/training_data/datasets/{folder}/images/{image_file}',
                'upload_time': image_info.get('upload_time', '')
            })
    
    return jsonify({
        'images': images,
        'total': len(images),
        'selected_mode': selected_image_ids is not None,
        'folder': folder
    })

# ヘルパー関数
def load_annotation_metadata():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def update_annotation_metadata(image_id, info):
    metadata = load_annotation_metadata()
    if image_id not in metadata:
        metadata[image_id] = {}
    metadata[image_id].update(info)
    save_annotation_metadata(metadata)

def save_annotation_metadata(metadata):
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)