# routes/file_manager.py
"""
アノテーションデータのファイルマネージャー機能
フォルダ構造での画像・ラベル管理を提供
"""

from flask import Blueprint, request, jsonify, render_template, current_app
import os
import shutil
from datetime import datetime
import json
from pathlib import Path

file_manager_bp = Blueprint('file_manager', __name__)

# ベースディレクトリ
BASE_DIR = os.path.join('static', 'training_data', 'datasets')

def ensure_base_directory():
    """ベースディレクトリとデフォルトフォルダを作成"""
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR)

    # デフォルトフォルダ
    default_dir = os.path.join(BASE_DIR, 'default')
    if not os.path.exists(default_dir):
        os.makedirs(os.path.join(default_dir, 'images'))
        os.makedirs(os.path.join(default_dir, 'labels'))

        # 既存データの移行（初回のみ）
        old_images = os.path.join('static', 'training_data', 'images')
        old_labels = os.path.join('static', 'training_data', 'labels')

        if os.path.exists(old_images):
            for file in os.listdir(old_images):
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    src = os.path.join(old_images, file)
                    dst = os.path.join(default_dir, 'images', file)
                    if not os.path.exists(dst):
                        shutil.copy2(src, dst)

        if os.path.exists(old_labels):
            for file in os.listdir(old_labels):
                if file.endswith('.txt'):
                    src = os.path.join(old_labels, file)
                    dst = os.path.join(default_dir, 'labels', file)
                    if not os.path.exists(dst):
                        shutil.copy2(src, dst)

@file_manager_bp.route('/')
def index():
    """ファイルマネージャーのメインページ"""
    ensure_base_directory()
    return render_template('file_manager_simple.html')

@file_manager_bp.route('/api/folders')
def get_folder_structure():
    """フォルダ構造を取得"""
    ensure_base_directory()

    def build_tree(path, name):
        """再帰的にフォルダツリーを構築"""
        node = {
            'name': name,
            'path': os.path.relpath(path, BASE_DIR).replace('\\', '/'),
            'type': 'folder',
            'children': [],
            'image_count': 0,
            'label_count': 0
        }

        try:
            # images/labelsサブフォルダのファイル数をカウント
            images_dir = os.path.join(path, 'images')
            labels_dir = os.path.join(path, 'labels')

            if os.path.exists(images_dir):
                node['image_count'] = len([f for f in os.listdir(images_dir)
                                          if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

            if os.path.exists(labels_dir):
                node['label_count'] = len([f for f in os.listdir(labels_dir)
                                          if f.endswith('.txt')])

            # サブフォルダを探索（images/labels以外）
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path) and item not in ['images', 'labels']:
                    child_node = build_tree(item_path, item)
                    node['children'].append(child_node)

                    # datasetsフォルダの場合、子フォルダの画像数を合計
                    if name == 'datasets':
                        node['image_count'] += child_node['image_count']
                        node['label_count'] += child_node['label_count']
                        # 子フォルダの子フォルダも含める（再帰的集計）
                        if child_node['children']:
                            for grandchild in child_node['children']:
                                node['image_count'] += grandchild.get('image_count', 0)
                                node['label_count'] += grandchild.get('label_count', 0)

        except PermissionError:
            pass

        return node

    tree = build_tree(BASE_DIR, 'datasets')
    return jsonify(tree)

@file_manager_bp.route('/api/folder/create', methods=['POST'])
def create_folder():
    """新規フォルダを作成"""
    data = request.json
    parent_path = data.get('parent_path', '')
    folder_name = data.get('folder_name')

    if not folder_name:
        return jsonify({'error': 'フォルダ名が必要です'}), 400

    # 安全なフォルダ名に変換
    safe_name = "".join(c for c in folder_name if c.isalnum() or c in ('_', '-', ' '))
    if not safe_name:
        return jsonify({'error': '無効なフォルダ名です'}), 400

    # フォルダパスを構築
    if parent_path:
        folder_path = os.path.join(BASE_DIR, parent_path, safe_name)
    else:
        folder_path = os.path.join(BASE_DIR, safe_name)

    # フォルダが既に存在する場合
    if os.path.exists(folder_path):
        return jsonify({'error': 'フォルダが既に存在します'}), 400

    try:
        # フォルダとサブフォルダを作成
        os.makedirs(os.path.join(folder_path, 'images'))
        os.makedirs(os.path.join(folder_path, 'labels'))

        return jsonify({
            'success': True,
            'folder_name': safe_name,
            'path': os.path.relpath(folder_path, BASE_DIR).replace('\\', '/')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_manager_bp.route('/api/folder/rename', methods=['POST'])
def rename_folder():
    """フォルダ名を変更"""
    data = request.json
    folder_path = data.get('folder_path')
    new_name = data.get('new_name')

    if not folder_path or not new_name:
        return jsonify({'error': 'パラメータが不足しています'}), 400

    if folder_path == 'default':
        return jsonify({'error': 'デフォルトフォルダは変更できません'}), 400

    # 安全なフォルダ名に変換
    safe_name = "".join(c for c in new_name if c.isalnum() or c in ('_', '-', ' '))
    if not safe_name:
        return jsonify({'error': '無効なフォルダ名です'}), 400

    old_path = os.path.join(BASE_DIR, folder_path)
    new_path = os.path.join(BASE_DIR, os.path.dirname(folder_path), safe_name)

    if not os.path.exists(old_path):
        return jsonify({'error': 'フォルダが見つかりません'}), 404

    if os.path.exists(new_path):
        return jsonify({'error': '同名のフォルダが既に存在します'}), 400

    try:
        os.rename(old_path, new_path)
        return jsonify({
            'success': True,
            'new_name': safe_name
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_manager_bp.route('/api/folder/delete', methods=['POST'])
def delete_folder():
    """フォルダを削除"""
    data = request.json
    folder_path = data.get('folder_path')

    if not folder_path or folder_path == 'default':
        return jsonify({'error': 'デフォルトフォルダは削除できません'}), 400

    full_path = os.path.join(BASE_DIR, folder_path)

    if not os.path.exists(full_path):
        return jsonify({'error': 'フォルダが見つかりません'}), 404

    try:
        # フォルダ内のファイル数を確認
        images_dir = os.path.join(full_path, 'images')
        image_count = 0
        if os.path.exists(images_dir):
            image_count = len([f for f in os.listdir(images_dir)
                             if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

        if image_count > 0:
            return jsonify({
                'warning': f'このフォルダには{image_count}枚の画像が含まれています',
                'confirm_required': True
            })

        # フォルダを削除
        shutil.rmtree(full_path)
        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_manager_bp.route('/api/images/move', methods=['POST'])
def move_images():
    """画像を別のフォルダに移動"""
    data = request.json
    source_folder = data.get('source_folder')
    target_folder = data.get('target_folder')
    image_ids = data.get('image_ids', [])

    if not all([source_folder, target_folder, image_ids]):
        return jsonify({'error': 'パラメータが不足しています'}), 400

    source_path = os.path.join(BASE_DIR, source_folder)
    target_path = os.path.join(BASE_DIR, target_folder)

    if not os.path.exists(source_path) or not os.path.exists(target_path):
        return jsonify({'error': 'フォルダが見つかりません'}), 404

    moved_count = 0
    errors = []

    for image_id in image_ids:
        try:
            # 画像ファイルを移動
            src_image = os.path.join(source_path, 'images', image_id)
            dst_image = os.path.join(target_path, 'images', image_id)

            if os.path.exists(src_image):
                shutil.move(src_image, dst_image)

                # 対応するラベルファイルも移動
                label_name = os.path.splitext(image_id)[0] + '.txt'
                src_label = os.path.join(source_path, 'labels', label_name)
                dst_label = os.path.join(target_path, 'labels', label_name)

                if os.path.exists(src_label):
                    shutil.move(src_label, dst_label)

                moved_count += 1
            else:
                errors.append(f'{image_id}: ファイルが見つかりません')

        except Exception as e:
            errors.append(f'{image_id}: {str(e)}')

    return jsonify({
        'success': moved_count > 0,
        'moved_count': moved_count,
        'errors': errors
    })

@file_manager_bp.route('/api/images/delete', methods=['POST'])
def delete_images():
    """選択された画像を削除"""
    data = request.json
    folder_path = data.get('folder_path')
    image_ids = data.get('image_ids', [])

    if not folder_path or not image_ids:
        return jsonify({'error': 'パラメータが不足しています'}), 400

    full_path = os.path.join(BASE_DIR, folder_path)

    if not os.path.exists(full_path):
        return jsonify({'error': 'フォルダが見つかりません'}), 404

    deleted_count = 0
    errors = []

    for image_id in image_ids:
        try:
            # 画像ファイルを削除
            image_path = os.path.join(full_path, 'images', image_id)
            if os.path.exists(image_path):
                os.remove(image_path)

                # 対応するラベルファイルも削除
                label_name = os.path.splitext(image_id)[0] + '.txt'
                label_path = os.path.join(full_path, 'labels', label_name)
                if os.path.exists(label_path):
                    os.remove(label_path)

                deleted_count += 1
            else:
                errors.append(f'{image_id}: ファイルが見つかりません')

        except Exception as e:
            errors.append(f'{image_id}: {str(e)}')

    return jsonify({
        'success': deleted_count > 0,
        'deleted_count': deleted_count,
        'errors': errors
    })

@file_manager_bp.route('/api/folder/images/')
@file_manager_bp.route('/api/folder/images/<path:folder_path>')
def get_folder_images(folder_path=''):
    """指定フォルダ内の画像一覧を取得"""
    # 空のパスまたはdatasetsの場合はデフォルトフォルダへ
    if not folder_path or folder_path == '.' or folder_path == 'datasets':
        # デフォルトフォルダがあればそれを使用
        if os.path.exists(os.path.join(BASE_DIR, 'default')):
            folder_path = 'default'
        else:
            # なければ最初のフォルダ（datasetsは除外）
            try:
                folders = [f for f in os.listdir(BASE_DIR)
                          if os.path.isdir(os.path.join(BASE_DIR, f)) and f != 'datasets']
                if folders:
                    folder_path = folders[0]
                else:
                    return jsonify({'images': [], 'count': 0, 'message': 'フォルダを作成してください'})
            except:
                return jsonify({'images': [], 'count': 0})

    full_path = os.path.join(BASE_DIR, folder_path, 'images')

    # フォルダが存在しない場合は空配列を返す
    if not os.path.exists(full_path):
        return jsonify({'images': [], 'count': 0})

    images = []
    try:
        for file in os.listdir(full_path):
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                # ラベルファイルの存在確認
                label_path = os.path.join(BASE_DIR, folder_path, 'labels',
                                         os.path.splitext(file)[0] + '.txt')
                has_label = os.path.exists(label_path)

                images.append({
                    'id': file,
                    'name': file,
                    'has_label': has_label,
                    'url': f'/static/training_data/datasets/{folder_path}/images/{file}'
                })
    except Exception as e:
        current_app.logger.error(f"画像リスト取得エラー: {str(e)}")
        return jsonify({'images': [], 'count': 0, 'error': str(e)})

    return jsonify({'images': images, 'count': len(images)})