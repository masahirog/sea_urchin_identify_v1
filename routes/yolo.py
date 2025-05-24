# routes/yolo.py

# ファイル先頭のインポートを整理
from flask import Blueprint, request, jsonify, render_template, current_app
import os
import json
import csv
import shutil
from werkzeug.utils import secure_filename
import cv2
import numpy as np
from PIL import Image

# カスタムモジュール
from core.YoloDetector import YoloDetector
from core.YoloTrainer import YoloTrainer
from core.dataset_manager import DatasetManager
from utils.file_handlers import find_image_path, handle_multiple_image_upload

# Blueprintの作成
yolo_bp = Blueprint('yolo', __name__, url_prefix='/yolo')

# YOLOトレーナーのインスタンス
trainer = YoloTrainer()


@yolo_bp.route('/training/start', methods=['POST'])
def start_training():
    """YOLOのトレーニングを開始"""
    data = request.json or {}
    
    # トレーニングパラメータの取得
    weights = data.get('weights', 'yolov5s.pt')
    batch_size = int(data.get('batch_size', 4))
    epochs = int(data.get('epochs', 50))
    img_size = int(data.get('img_size', 640))
    device = data.get('device', '')
    workers = int(data.get('workers', 4))
    name = data.get('name', 'exp')
    exist_ok = data.get('exist_ok', False)
    
    # トレーニングの開始
    success = trainer.start_training(
        weights=weights,
        batch_size=batch_size,
        epochs=epochs,
        img_size=img_size,
        device=device,
        workers=workers,
        name=name,
        exist_ok=exist_ok
    )
    
    if success:
        return jsonify({
            'status': 'success',
            'message': 'トレーニングを開始しました'
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'トレーニングの開始に失敗しました。すでにトレーニングが実行中の可能性があります。'
        }), 400

@yolo_bp.route('/training/stop', methods=['POST'])
def stop_training():
    """YOLOのトレーニングを停止"""
    success = trainer.stop_training()
    
    if success:
        return jsonify({
            'status': 'success',
            'message': 'トレーニングを停止しました'
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'トレーニングの停止に失敗しました。トレーニングが実行中ではない可能性があります。'
        }), 400

@yolo_bp.route('/training/status', methods=['GET'])
def training_status():
    """YOLOのトレーニング状況を取得"""
    status = trainer.get_training_status()
    return jsonify(status)

@yolo_bp.route('/detect', methods=['POST'])
def detect_objects():
    """画像内の物体を検出"""
    if 'image' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '画像がアップロードされていません'
        }), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': '画像が選択されていません'
        }), 400
    
    # 信頼度閾値の取得
    conf_threshold = float(request.form.get('confidence', 0.25))
    
    # 画像の保存
    filename = secure_filename(file.filename)
    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'yolo_detect')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)
    
    try:
        # YoloDetectorを使用して検出
        detector = YoloDetector(conf_threshold=conf_threshold)
        result = detector.detect(file_path)
        
        # 結果画像の保存
        if result.get('annotated_image') is not None:
            result_dir = os.path.join('static', 'images', 'detection_results')
            os.makedirs(result_dir, exist_ok=True)
            result_filename = f"result_{os.path.splitext(filename)[0]}.jpg"
            result_path = os.path.join(result_dir, result_filename)
            cv2.imwrite(result_path, result['annotated_image'])
            
            return jsonify({
                'status': 'success',
                'message': f'{result["count"]}個の生殖乳頭を検出しました',
                'detections': result['detections'],
                'image_path': '/' + os.path.relpath(file_path, start='.').replace('\\', '/'),
                'result_image_path': '/' + os.path.relpath(result_path, start='.').replace('\\', '/'),
                'fallback': result.get('fallback', False)
            })
        else:
            return jsonify({
                'status': 'error',
                'message': '検出処理に失敗しました',
                'error': result.get('error', '不明なエラー')
            }), 500
    
    except Exception as e:
        current_app.logger.error(f'検出処理エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'検出処理中にエラーが発生しました: {str(e)}'
        }), 500

@yolo_bp.route('/batch_detect', methods=['POST'])
def batch_detect():
    """複数画像の一括検出"""
    if 'images[]' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '画像がアップロードされていません'
        }), 400
    
    files = request.files.getlist('images[]')
    if not files or files[0].filename == '':
        return jsonify({
            'status': 'error',
            'message': '画像が選択されていません'
        }), 400
    
    # 信頼度閾値の取得
    conf_threshold = float(request.form.get('confidence', 0.25))
    
    # 画像の保存
    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'yolo_batch')
    os.makedirs(upload_dir, exist_ok=True)
    
    file_paths = []
    for file in files:
        filename = secure_filename(file.filename)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        file_paths.append(file_path)
    
    try:
        # YoloDetectorを使用して一括検出
        detector = YoloDetector(conf_threshold=conf_threshold)
        batch_results = detector.batch_detect(file_paths)
        
        # 結果の整形
        results = []
        result_dir = os.path.join('static', 'images', 'detection_results')
        os.makedirs(result_dir, exist_ok=True)
        
        for i, result in enumerate(batch_results):
            base_name = os.path.basename(result['image_path'])
            
            # エラーがある場合
            if 'error' in result:
                results.append({
                    'path': result['image_path'],
                    'error': result['error']
                })
                continue
            
            # 結果画像の保存
            if result.get('annotated_image') is not None:
                result_filename = f"result_{os.path.splitext(base_name)[0]}.jpg"
                result_path = os.path.join(result_dir, result_filename)
                cv2.imwrite(result_path, result['annotated_image'])
                
                results.append({
                    'path': result['image_path'],
                    'count': result['count'],
                    'detections': result['detections'],
                    'result_image_path': '/' + os.path.relpath(result_path, start='.').replace('\\', '/')
                })
        
        return jsonify({
            'status': 'success',
            'message': f'{len(results)}枚の画像を処理しました',
            'results': results
        })
    
    except Exception as e:
        current_app.logger.error(f'一括検出処理エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'一括検出処理中にエラーが発生しました: {str(e)}'
        }), 500

@yolo_bp.route('/api/images', methods=['GET'])
def get_images():
    """アノテーション用の画像リストを取得"""
    # 画像ディレクトリの設定
    image_dirs = [
        os.path.join(current_app.config['STATIC_FOLDER'], 'images/samples/papillae/male'),
        os.path.join(current_app.config['STATIC_FOLDER'], 'images/samples/papillae/female')
    ]
    
    images = []
    for img_dir in image_dirs:
        if os.path.exists(img_dir):
            for filename in os.listdir(img_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    image_path = os.path.join(img_dir, filename)
                    relative_path = os.path.relpath(image_path, start='.')
                    url_path = '/' + relative_path.replace('\\', '/')
                    
                    images.append({
                        'id': filename,
                        'filename': filename,
                        'path': image_path,
                        'url': url_path
                    })
    
    return jsonify({
        'status': 'success',
        'images': images
    })



@yolo_bp.route('/training/save', methods=['POST'])
def save_training_results():
    """トレーニング結果を保存"""
    try:
        result = trainer.save_training_results()
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f'トレーニング結果保存エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'結果保存エラー: {str(e)}'
        }), 500


@yolo_bp.route('/prepare-dataset', methods=['POST'])
def prepare_dataset():
    """YOLOデータセットを準備"""
    try:
        result = DatasetManager.prepare_yolo_dataset()
        
        return jsonify({
            'status': 'success',
            'message': 'データセットの準備が完了しました',
            **result
        })
    except Exception as e:
        current_app.logger.error(f'データセット準備エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'データセット準備エラー: {str(e)}'
        }), 500

# データセット状態確認エンドポイントを追加
@yolo_bp.route('/dataset-status', methods=['GET'])
def dataset_status():
    """YOLOデータセットの状態を確認"""
    try:
        stats = DatasetManager.get_dataset_stats()
        
        return jsonify({
            'status': 'success',
            'exists': stats['total_images'] > 0,
            'stats': stats
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500




# save_yolo_annotationでfind_image_pathを使用
@yolo_bp.route('/save-annotation', methods=['POST'])
def save_yolo_annotation():
    """YOLOアノテーションを保存（改良版）"""
    try:
        data = request.json
        image_path = data.get('image_path')
        yolo_data = data.get('yolo_data')
        
        if not image_path or yolo_data is None:
            return jsonify({
                'status': 'error',
                'message': '必要なパラメータが不足しています'
            }), 400
        
        filename = os.path.basename(image_path)
        label_name = os.path.splitext(filename)[0] + '.txt'
        
        # YOLOフォーマットで保存
        label_dir = os.path.join('data/yolo_dataset/labels/train')
        os.makedirs(label_dir, exist_ok=True)
        label_path = os.path.join(label_dir, label_name)
        
        with open(label_path, 'w') as f:
            f.write(yolo_data)
        
        # データセットに画像をコピー（必要な場合）
        if not os.path.exists(os.path.join('data/yolo_dataset/images/train', filename)):
            # find_image_pathを使用して画像を検索
            source_image = find_image_path(filename)
            
            if source_image:
                import shutil
                dst_path = os.path.join('data/yolo_dataset/images/train', filename)
                shutil.copy2(source_image, dst_path)
        
        return jsonify({
            'status': 'success',
            'message': 'アノテーションを保存しました',
            'label_path': label_path
        })
        
    except Exception as e:
        current_app.logger.error(f'アノテーション保存エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'保存エラー: {str(e)}'
        }), 500


# handle_annotationsのPOST部分を簡略化
@yolo_bp.route('/api/annotations/<image_id>', methods=['GET', 'POST'])
def handle_annotations(image_id):
    """画像のアノテーション情報を取得・保存"""
    if request.method == 'GET':
        # GET処理はそのまま
        annotation_dir = os.path.join(current_app.config['STATIC_FOLDER'], 'annotations/yolo')
        annotation_file = os.path.join(annotation_dir, f'{image_id}.json')
        
        if os.path.exists(annotation_file):
            with open(annotation_file, 'r') as f:
                return jsonify(json.load(f))
        return jsonify({'annotations': []})
    
    elif request.method == 'POST':
        # save_yolo_annotationを呼び出す
        data = request.json
        data['image_path'] = image_id
        data['save_json'] = True
        return save_yolo_annotation()

@yolo_bp.route('/training/results', methods=['GET'])
def get_training_results():
    """トレーニング結果を取得"""
    try:
        # 最新の実験結果を探す
        runs_dir = 'yolov5/runs/train'
        if not os.path.exists(runs_dir):
            return jsonify({
                'status': 'error',
                'message': 'トレーニング結果が見つかりません'
            }), 404
        
        # 最新のexpディレクトリを取得
        exp_dirs = [d for d in os.listdir(runs_dir) if d.startswith('exp')]
        if not exp_dirs:
            return jsonify({
                'status': 'error',
                'message': 'トレーニング結果が見つかりません'
            }), 404
        
        latest_exp = sorted(exp_dirs)[-1]
        exp_path = os.path.join(runs_dir, latest_exp)
        
        # results.csvから結果を読み取り
        results_csv = os.path.join(exp_path, 'results.csv')
        results = {}
        
        if os.path.exists(results_csv):
            import csv
            with open(results_csv, 'r') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                if rows:
                    last_row = rows[-1]
                    results['mAP'] = float(last_row.get('metrics/mAP_0.5', 0))
                    results['precision'] = float(last_row.get('metrics/precision', 0))
                    results['recall'] = float(last_row.get('metrics/recall', 0))
        
        # トレーニング時間を計算（簡易版）
        results['training_time'] = '計測中'
        
        # 精度はmAPから推定
        results['accuracy'] = results.get('mAP', 0)
        
        return jsonify(results)
        
    except Exception as e:
        current_app.logger.error(f'結果取得エラー: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'結果取得エラー: {str(e)}'
        }), 500

@yolo_bp.route('/dataset-check', methods=['GET'])
def check_dataset():
    """データセットの詳細チェック"""
    dataset_dir = 'data/yolo_dataset'
    
    # 画像とラベルの対応チェック
    train_images = os.listdir(os.path.join(dataset_dir, 'images/train'))
    train_labels = os.listdir(os.path.join(dataset_dir, 'labels/train'))
    
    # ラベルファイルの内容確認
    empty_labels = []
    valid_labels = []
    
    for label_file in train_labels:
        label_path = os.path.join(dataset_dir, 'labels/train', label_file)
        with open(label_path, 'r') as f:
            content = f.read().strip()
            if not content:
                empty_labels.append(label_file)
            else:
                valid_labels.append(label_file)
    
    return jsonify({
        'train_images': len(train_images),
        'train_labels': len(train_labels),
        'empty_labels': len(empty_labels),
        'valid_labels': len(valid_labels),
        'empty_label_files': empty_labels
    })

# トレーニングセッション管理
training_sessions = {}

@yolo_bp.route('/training/session', methods=['POST'])
def create_training_session():
    """トレーニングセッションを作成"""
    session_id = str(uuid.uuid4())
    training_sessions[session_id] = {
        'created_at': datetime.now(),
        'status': 'initialized',
        'uploaded_images': request.json.get('uploaded_images', []),
        'current_step': request.json.get('current_step', 1)
    }
    
    # セッションIDをクッキーに保存
    response = jsonify({'session_id': session_id})
    response.set_cookie('yolo_training_session', session_id, max_age=3600)
    return response

@yolo_bp.route('/training/session/status', methods=['GET'])
def get_training_session_status():
    """セッション状態を取得"""
    session_id = request.cookies.get('yolo_training_session')
    
    if not session_id or session_id not in training_sessions:
        return jsonify({'error': 'セッションが見つかりません'}), 404
    
    session = training_sessions[session_id]
    
    # 実際のトレーニング状態も確認
    training_status = trainer.get_training_status()
    session['training_status'] = training_status
    
    return jsonify(session)