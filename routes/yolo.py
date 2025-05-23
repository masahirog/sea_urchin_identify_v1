# routes/yolo.py

from flask import Blueprint, request, jsonify, render_template, current_app
import os
import json
from werkzeug.utils import secure_filename
from core.YoloDetector import YoloDetector
from core.YoloTrainer import YoloTrainer

# Blueprintの作成
yolo_bp = Blueprint('yolo', __name__, url_prefix='/yolo')

# YOLOトレーナーのインスタンス
trainer = YoloTrainer()

@yolo_bp.route('/', methods=['GET'])
def yolo_management():
    """YOLO管理ページの表示"""
    return render_template('yolo_management.html')

@yolo_bp.route('/annotate', methods=['GET'])
def annotate_page():
    """アノテーションページの表示"""
    return render_template('yolo_annotate.html')

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
        # 検出の実行
        detector = YoloDetector(conf_threshold=conf_threshold)
        results = detector.detect(file_path)
        
        return jsonify({
            'status': 'success',
            'message': f'{results["count"]}個の物体を検出しました',
            'detections': results['detections'],
            'image_path': '/' + os.path.relpath(file_path, start='.'),
            'result_image_path': '/' + os.path.relpath(results['result_image_path'], start='.') if results['result_image_path'] else None
        })
    
    except Exception as e:
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
        # 一括検出の実行
        detector = YoloDetector(conf_threshold=conf_threshold)
        results = detector.batch_detect(file_paths)
        
        return jsonify({
            'status': 'success',
            'message': f'{len(results)}枚の画像を処理しました',
            'results': results
        })
    
    except Exception as e:
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

@yolo_bp.route('/api/annotations/<image_id>', methods=['GET', 'POST'])
def handle_annotations(image_id):
    """画像のアノテーション情報を取得・保存"""
    annotation_dir = os.path.join(current_app.config['STATIC_FOLDER'], 'annotations/yolo')
    os.makedirs(annotation_dir, exist_ok=True)
    
    annotation_file = os.path.join(annotation_dir, f'{image_id}.json')
    
    if request.method == 'GET':
        if os.path.exists(annotation_file):
            with open(annotation_file, 'r') as f:
                return jsonify(json.load(f))
        return jsonify({'annotations': []})
    
    elif request.method == 'POST':
        data = request.json
        
        # アノテーションを保存
        with open(annotation_file, 'w') as f:
            json.dump(data, f)
        
        # YOLO形式に変換して保存
        # 画像ファイルを検索
        image_dirs = [
            os.path.join(current_app.config['STATIC_FOLDER'], 'images/samples/papillae/male'),
            os.path.join(current_app.config['STATIC_FOLDER'], 'images/samples/papillae/female')
        ]
        
        image_path = None
        for img_dir in image_dirs:
            possible_path = os.path.join(img_dir, image_id)
            if os.path.exists(possible_path):
                image_path = possible_path
                break
        
        if image_path and 'annotations' in data:
            from PIL import Image
            img = Image.open(image_path)
            img_width, img_height = img.size
            
            # YOLO形式（クラスID, 中心x, 中心y, 幅, 高さ）に変換
            yolo_annotations = []
            for ann in data['annotations']:
                # 座標の取得と正規化
                x1, y1, x2, y2 = ann['x1'], ann['y1'], ann['x2'], ann['y2']
                center_x = (x1 + x2) / 2 / img_width
                center_y = (y1 + y2) / 2 / img_height
                width = (x2 - x1) / img_width
                height = (y2 - y1) / img_height
                
                # クラスIDの設定（デフォルトは0=生殖乳頭）
                class_id = 0
                
                yolo_annotations.append(f"{class_id} {center_x} {center_y} {width} {height}")
            
            # YOLOデータセットディレクトリの設定
            yolo_dataset_dir = 'data/yolo_dataset'
            yolo_images_dir = os.path.join(yolo_dataset_dir, 'images/train')
            yolo_labels_dir = os.path.join(yolo_dataset_dir, 'labels/train')
            
            os.makedirs(yolo_images_dir, exist_ok=True)
            os.makedirs(yolo_labels_dir, exist_ok=True)
            
            # 画像をYOLOデータセットにコピー
            import shutil
            img_copy_path = os.path.join(yolo_images_dir, image_id)
            shutil.copy(image_path, img_copy_path)
            
            # アノテーションをYOLO形式で保存
            label_file = os.path.join(yolo_labels_dir, os.path.splitext(image_id)[0] + '.txt')
            with open(label_file, 'w') as f:
                f.write('\n'.join(yolo_annotations))
        
        return jsonify({
            'status': 'success',
            'message': 'アノテーションを保存しました'
        })