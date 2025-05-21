"""
ウニ生殖乳頭分析システム - メインルート
アプリケーションのメインページと共通機能を提供する
"""

from flask import Blueprint, render_template, jsonify, request
import os

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """メインページを表示"""
    return render_template('index.html')


@main_bp.route('/task-status/<task_id>', methods=['GET'])
def task_status(task_id):
    """
    指定されたタスクIDの処理状況を取得
    
    Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - JSON: タスクの処理状況情報
    """
    from app import processing_status
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
        
    if task_id in processing_status:
        return jsonify(processing_status[task_id])
    
    return jsonify({"status": "unknown", "message": "タスクが見つかりません"}), 404


@main_bp.route('/task-history', methods=['GET'])
def get_task_history():
    """
    タスク履歴を取得
    
    Returns:
    - JSON: タスク履歴のリスト
    """
    from app import app
    from datetime import datetime
    
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
    
    return jsonify({"tasks": extracted_dirs})


@main_bp.route('/dataset-info', methods=['GET'])
def get_dataset_info():
    """
    データセット情報を取得
    
    Returns:
    - JSON: データセットの情報
    """
    from app import app
    
    # 各カテゴリのディレクトリパス
    male_dir = os.path.join(app.config['DATASET_FOLDER'], 'male')
    female_dir = os.path.join(app.config['DATASET_FOLDER'], 'female')
    
    # 画像ファイル数をカウント
    male_count = len([f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
    female_count = len([f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
    
    # 合計カウント
    total_count = male_count + female_count
    
    # アノテーション情報の取得（オプション）
    annotation_count = 0
    annotation_file = os.path.join('static', 'annotation_mapping.json')
    if os.path.exists(annotation_file):
        try:
            import json
            with open(annotation_file, 'r') as f:
                annotations = json.load(f)
                annotation_count = len(annotations)
        except Exception as e:
            print(f"アノテーション情報読み込みエラー: {str(e)}")
    
    return jsonify({
        "male_count": male_count,
        "female_count": female_count,
        "total_count": total_count,
        "annotation_count": annotation_count
    })


@main_bp.route('/train-model', methods=['POST'])
def train_model():
    """
    モデル訓練を開始
    
    Returns:
    - JSON: 訓練タスクの情報
    """
    import uuid
    from app import processing_queue, processing_status, app
    
    # 処理タスクの作成
    task_id = str(uuid.uuid4())
    task = {
        "type": "train_model",
        "id": task_id,
        "dataset_dir": app.config['DATASET_FOLDER']
    }
    
    # 処理状態の初期化
    processing_status[task_id] = {"status": "queued", "message": "モデル訓練を待機中..."}
    
    # キューに追加
    processing_queue.put(task)
    
    return jsonify({"success": True, "task_id": task_id, "message": "モデル訓練を開始しました"})