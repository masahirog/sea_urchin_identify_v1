"""
routes/main.py - 統合メインルート
雌雄判定、画像管理、システム情報の統合
"""

from flask import Blueprint, render_template, jsonify, request, url_for, send_from_directory, current_app
from werkzeug.utils import secure_filename
import os
import uuid
import traceback
import cv2
from datetime import datetime
import json
import shutil

main_bp = Blueprint('main', __name__)

# ================================
# ページ表示
# ================================

@main_bp.route('/')
def index():
    """メインページ（雌雄判定）を表示"""
    return render_template('index.html')

# ================================
# 雌雄判定機能
# ================================

@main_bp.route('/classify', methods=['POST'])
def classify_image():
    """
    画像をアップロードして雌雄判定を実行
    /upload エンドポイントも内部的にこの関数を使用
    """
    from app import app
    from app_utils.file_handlers import allowed_file, is_image_file
    from core.analyzer import UnifiedAnalyzer
    from core.YoloDetector import YoloDetector
    
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
            analyzer = UnifiedAnalyzer()
            result = analyzer.classify_image(file_path)
            
            if "error" in result:
                current_app.logger.error(f"画像分析エラー: {result['error']}")
                
                # YOLOv5関連のエラーの場合、詳細なメッセージを返す
                if "YOLO" in result["error"] or "検出器" in result["error"]:
                    return jsonify({
                        "error": "YOLOv5が利用できません。セットアップが必要です。",
                        "details": result["error"],
                        "solution": "python setup_yolo.py を実行してください"
                    }), 500
                
                return jsonify({"error": result["error"]}), 400
            
            # 画像へのURLを追加
            result["image_url"] = url_for('main.get_uploaded_file', filename=filename, _external=True)
            result["filename"] = filename
            
            # YOLOで検出画像を生成
            detector = YoloDetector()
            detection_result = detector.detect(file_path)

            if detection_result and "annotated_image" in detection_result:
                # 検出結果画像を保存
                marked_filename = f"marked_{filename}"
                marked_path = os.path.join(app.config['UPLOAD_FOLDER'], marked_filename)
                cv2.imwrite(marked_path, detection_result["annotated_image"])
                
                result["marked_image_url"] = url_for('main.get_uploaded_file', filename=marked_filename, _external=True)
                result["papillae_count"] = detection_result["count"]
                result["papillae_details"] = detection_result.get("detections", [])
            
            # 判定履歴に記録
            record_classification_history(filename, result)

            current_app.logger.info(f"雌雄判定完了: {filename} -> {result.get('gender', 'unknown')}")

            # numpy配列をすべてリストに変換
            import numpy as np
            def convert_numpy(obj):
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                elif isinstance(obj, dict):
                    return {key: convert_numpy(value) for key, value in obj.items()}
                elif isinstance(obj, list):
                    return [convert_numpy(item) for item in obj]
                return obj

            result = convert_numpy(result)

            return jsonify(result)
        
        except Exception as e:
            current_app.logger.error(f"画像処理エラー: {str(e)}")
            traceback.print_exc()
            return jsonify({"error": f"画像処理中にエラーが発生しました: {str(e)}"}), 500
    
    return jsonify({"error": "無効なファイル形式です"}), 400

# 後方互換性のためのエイリアス
@main_bp.route('/upload', methods=['POST'])
def upload_image():
    """画像をアップロードして分析（後方互換性）"""
    return classify_image()

# ================================
# ファイル管理
# ================================

@main_bp.route('/uploads/<filename>')
def get_uploaded_file(filename):
    """アップロードファイルを配信"""
    from app import app
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@main_bp.route('/image', methods=['POST', 'DELETE'])
def manage_image():
    """画像管理の統合エンドポイント"""
    if request.method == 'POST':
        # マーキング画像の保存またはデータセットへの保存
        action = request.json.get('action', 'save_marked')
        if action == 'save_marked':
            return save_marked_image()
        elif action == 'save_to_dataset':
            return save_to_dataset()
        else:
            return jsonify({"error": "無効なアクションです"}), 400
    elif request.method == 'DELETE':
        return delete_image()

def delete_image():
    """指定された画像を削除（内部処理）"""
    data = request.json
    
    if not data or 'image_path' not in data:
        return jsonify({"error": "画像パスが指定されていません"}), 400
    
    image_path = data['image_path']
    
    # セキュリティチェック
    if '..' in image_path or os.path.isabs(image_path):
        return jsonify({"error": "不正なパスです"}), 400
    
    # アップロードフォルダ内のファイルのみ削除可能
    from app import app
    full_path = os.path.join(app.config['UPLOAD_FOLDER'], os.path.basename(image_path))
    
    if not os.path.exists(full_path):
        return jsonify({"error": "指定された画像が見つかりません"}), 404
    
    try:
        os.remove(full_path)
        current_app.logger.info(f"画像を削除しました: {full_path}")
        return jsonify({"success": True, "message": "画像を削除しました"})
    except Exception as e:
        current_app.logger.error(f"画像削除エラー: {str(e)}")
        return jsonify({"error": str(e)}), 500

def save_to_dataset():
    """画像をデータセットに保存（内部処理）"""
    from app import app
    
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
    
    # URLパスをファイルパスに変換
    if not os.path.exists(image_path) and image_path.startswith('/'):
        if image_path.startswith('/main/images/'):
            image_path = image_path.replace('/main/images/', '')
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

def save_marked_image():
    """マーキングされた画像を保存（内部処理）"""
    from app import app
    import base64
    
    data = request.json
    
    if not data or 'image_data' not in data or 'original_image_path' not in data:
        return jsonify({"error": "必要なパラメータが不足しています"}), 400
    
    try:
        # Base64データの処理
        image_data_parts = data['image_data'].split(',')
        image_data = image_data_parts[1] if len(image_data_parts) > 1 else image_data_parts[0]
        
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            current_app.logger.error(f"Base64デコードエラー: {str(e)}")
            return jsonify({"error": f"画像データの解析に失敗しました: {str(e)}"}), 400
        
        # ファイル名処理
        original_path = data['original_image_path']
        filename = os.path.basename(original_path)
        basename, ext = os.path.splitext(filename)
        new_filename = f"{basename}_marked{ext}"
        
        # 保存先ディレクトリ
        save_dir = os.path.dirname(original_path) if os.path.exists(original_path) else app.config['UPLOAD_FOLDER']
        if not os.path.exists(save_dir):
            save_dir = app.config['UPLOAD_FOLDER']
        
        # 同名ファイル対策
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
            "filename": new_filename,
            "image_url": url_for('main.get_uploaded_file', filename=new_filename, _external=True)
        })
        
    except Exception as e:
        current_app.logger.error(f"マーキング画像保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"画像の保存中にエラーが発生しました: {str(e)}"}), 500

# ================================
# タスク管理
# ================================

@main_bp.route('/task/<task_id>', methods=['GET'])
def task_status(task_id):
    """指定されたタスクIDの処理状況を取得"""
    from app import processing_status
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
        
    if task_id in processing_status:
        return jsonify(processing_status[task_id])
    
    return jsonify({"status": "unknown", "message": "タスクが見つかりません"}), 404

# ================================
# システム情報
# ================================

@main_bp.route('/system', methods=['GET'])
def system_info():
    """システム情報の統合エンドポイント"""
    info_type = request.args.get('type', 'stats')
    
    if info_type == 'stats':
        return get_system_stats()
    elif info_type == 'dataset':
        return get_dataset_info()
    elif info_type == 'classification':
        return get_classification_stats()
    else:
        return jsonify({"error": "無効な情報タイプです"}), 400

def get_system_stats():
    """システム統計情報を取得（内部処理）"""
    from app import processing_status, app
    
    try:
        # データセット統計
        dataset_info = get_dataset_info_internal()
        
        # タスク統計
        tasks = processing_status
        active_tasks = len([t for t in tasks.values() if t.get('status') in ['processing', 'queued', 'running']])
        completed_tasks = len([t for t in tasks.values() if t.get('status') == 'completed'])
        failed_tasks = len([t for t in tasks.values() if t.get('status') in ['failed', 'error']])
        
        # 判定履歴統計
        classification_stats = get_classification_stats_internal()
        
        # モデル存在確認
        from config import MODELS_DIR
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        model_exists = os.path.exists(model_path)
        
        # アップロードファイル統計
        upload_dir = app.config['UPLOAD_FOLDER']
        upload_count = len([f for f in os.listdir(upload_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(upload_dir) else 0
        
        return jsonify({
            "dataset": dataset_info,
            "tasks": {
                "total": len(tasks),
                "active": active_tasks,
                "completed": completed_tasks,
                "failed": failed_tasks
            },
            "classifications": classification_stats,
            "uploads": {
                "current_files": upload_count
            },
            "model": {
                "exists": model_exists,
                "path": model_path if model_exists else None
            },
            "system": {
                "version": "1.0.0",
                "status": "healthy"
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"システム統計取得エラー: {str(e)}")
        return jsonify({"error": "システム統計の取得に失敗しました"}), 500

def get_dataset_info():
    """データセット情報を取得（エンドポイント用）"""
    return jsonify(get_dataset_info_internal())

def get_dataset_info_internal():
    """データセット情報を取得（内部処理）"""
    from app import app
    
    # 各カテゴリのディレクトリパス
    male_dir = os.path.join(app.config['DATASET_FOLDER'], 'male')
    female_dir = os.path.join(app.config['DATASET_FOLDER'], 'female')
    
    # 画像ファイル数をカウント
    male_count = len([f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
    female_count = len([f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
    
    # 合計カウント
    total_count = male_count + female_count
    
    # アノテーション情報の取得
    annotation_count = 0
    annotation_file = os.path.join('static', 'annotation_mapping.json')
    if os.path.exists(annotation_file):
        try:
            with open(annotation_file, 'r') as f:
                annotations = json.load(f)
                annotation_count = len(annotations)
        except Exception as e:
            print(f"アノテーション情報読み込みエラー: {str(e)}")
    
    return {
        "male_count": male_count,
        "female_count": female_count,
        "total_count": total_count,
        "annotation_count": annotation_count
    }

def get_classification_stats():
    """判定統計を取得（エンドポイント用）"""
    return jsonify(get_classification_stats_internal())

def get_classification_stats_internal():
    """判定統計を計算（内部処理）"""
    history = load_classification_history()
    
    if not history:
        return {
            "total_classifications": 0,
            "accuracy_rate": 0,
            "male_predictions": 0,
            "female_predictions": 0
        }
    
    total = len(history)
    male_count = len([h for h in history if h.get("gender") == "male"])
    female_count = len([h for h in history if h.get("gender") == "female"])
    
    # フィードバックがある記録での正解率計算
    feedback_records = [h for h in history if h.get("feedback")]
    correct_count = len([h for h in feedback_records if h.get("feedback", {}).get("correct")])
    accuracy_rate = (correct_count / len(feedback_records)) if feedback_records else 0
    
    return {
        "total_classifications": total,
        "accuracy_rate": accuracy_rate,
        "male_predictions": male_count,
        "female_predictions": female_count,
        "feedback_count": len(feedback_records)
    }

# ================================
# 判定履歴管理
# ================================

@main_bp.route('/classification', methods=['GET', 'POST'])
def manage_classification():
    """判定履歴管理の統合エンドポイント"""
    if request.method == 'GET':
        return get_classification_history()
    elif request.method == 'POST':
        return submit_feedback()

def get_classification_history():
    """雌雄判定履歴を取得"""
    try:
        history = load_classification_history()
        
        # 日付でソート（新しい順）
        history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # 最新20件に制限
        recent_history = history[:20]
        
        return jsonify({
            "history": recent_history,
            "total_count": len(history),
            "recent_count": len(recent_history)
        })
        
    except Exception as e:
        current_app.logger.error(f"判定履歴取得エラー: {str(e)}")
        return jsonify({"error": "判定履歴の取得に失敗しました"}), 500

def submit_feedback():
    """判定結果へのフィードバックを記録"""
    try:
        data = request.json
        
        if not data or 'filename' not in data:
            return jsonify({"error": "必要なパラメータがありません"}), 400
        
        filename = data['filename']
        correct = data.get('correct', False)
        actual_gender = data.get('actual_gender')
        
        # フィードバックを履歴に記録
        update_classification_feedback(filename, correct, actual_gender)
        
        current_app.logger.info(f"フィードバック記録: {filename} - 正解: {correct}, 実際: {actual_gender}")
        
        return jsonify({
            "success": True,
            "message": "フィードバックを記録しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"フィードバック記録エラー: {str(e)}")
        return jsonify({"error": "フィードバックの記録に失敗しました"}), 500

# ================================
# クリーンアップ機能
# ================================

@main_bp.route('/cleanup', methods=['POST'])
def cleanup_temp_files():
    """一時ファイルをクリーンアップ"""
    from app import app
    from app_utils.file_cleanup import cleanup_temp_files as cleanup_function
    
    try:
        upload_dir = app.config.get('UPLOAD_FOLDER')
        max_age = request.json.get('max_age_hours', 24) if request.json else 24
        
        deleted_count = cleanup_function(upload_dir, max_age)
        
        return jsonify({
            "success": True,
            "message": f"{deleted_count}個のファイルを削除しました",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        current_app.logger.error(f"一時ファイルクリーンアップエラー: {str(e)}")
        return jsonify({"error": f"クリーンアップに失敗しました: {str(e)}"}), 500

# ================================
# デバッグ機能
# ================================

@main_bp.route('/debug/info')
def debug_info():
    """デバッグ情報を取得"""
    if not current_app.config.get('DEBUG', False):
        return jsonify({"error": "デバッグモードでのみ利用可能"}), 403
    
    from app import app
    
    info = {
        "config": {
            "upload_folder": app.config.get('UPLOAD_FOLDER'),
            "dataset_folder": app.config.get('DATASET_FOLDER'),
            "extracted_folder": app.config.get('EXTRACTED_FOLDER'),
            "max_content_length": app.config.get('MAX_CONTENT_LENGTH')
        },
        "directories": {},
        "file_counts": {}
    }
    
    # ディレクトリ存在確認
    dirs_to_check = ['UPLOAD_FOLDER', 'DATASET_FOLDER', 'EXTRACTED_FOLDER']
    for dir_key in dirs_to_check:
        dir_path = app.config.get(dir_key)
        if dir_path:
            info["directories"][dir_key] = {
                "path": dir_path,
                "exists": os.path.exists(dir_path),
                "is_dir": os.path.isdir(dir_path) if os.path.exists(dir_path) else False
            }
            
            # ファイル数カウント
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                try:
                    files = os.listdir(dir_path)
                    info["file_counts"][dir_key] = len(files)
                except:
                    info["file_counts"][dir_key] = "access_denied"
    
    return jsonify(info)

# ================================
# ヘルパー関数
# ================================

def load_classification_history():
    """判定履歴を読み込み"""
    history_file = os.path.join('data', 'classification_history.json')
    
    if os.path.exists(history_file):
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            current_app.logger.error(f"履歴読み込みエラー: {str(e)}")
    
    return []

def save_classification_history(history):
    """判定履歴を保存"""
    from config import DATA_DIR
    
    os.makedirs(DATA_DIR, exist_ok=True)
    history_file = os.path.join(DATA_DIR, 'classification_history.json')
    
    try:
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        current_app.logger.error(f"履歴保存エラー: {str(e)}")

def record_classification_history(filename, result):
    """新しい判定結果を履歴に記録"""
    history = load_classification_history()
    
    # 新しい記録を作成
    record = {
        "filename": filename,
        "timestamp": datetime.now().isoformat(),
        "gender": result.get("gender", "unknown"),
        "confidence": result.get("confidence", 0),
        "features": result.get("features", []),
        "papillae_count": result.get("papillae_count", 0),
        "feedback": None
    }
    
    # 履歴に追加（最新を先頭に）
    history.insert(0, record)
    
    # 履歴サイズ制限（最新1000件まで）
    if len(history) > 1000:
        history = history[:1000]
    
    # 保存
    save_classification_history(history)

def update_classification_feedback(filename, correct, actual_gender):
    """判定結果にフィードバックを追加"""
    history = load_classification_history()
    
    # 該当する記録を検索して更新
    for record in history:
        if record.get("filename") == filename:
            record["feedback"] = {
                "correct": correct,
                "actual_gender": actual_gender,
                "feedback_timestamp": datetime.now().isoformat()
            }
            break
    
    # 保存
    save_classification_history(history)

# ================================
# 後方互換性のための個別ルート定義（非推奨）
# ================================

# 画像管理の個別ルート
@main_bp.route('/delete-image', methods=['POST'])
def delete_image_legacy():
    """後方互換性のための削除ルート"""
    return delete_image()

@main_bp.route('/save-to-dataset', methods=['POST'])
def save_to_dataset_legacy():
    """後方互換性のためのデータセット保存ルート"""
    return save_to_dataset()

@main_bp.route('/save-marked-image', methods=['POST'])
def save_marked_image_legacy():
    """後方互換性のためのマーキング画像保存ルート"""
    return save_marked_image()

# タスク管理の個別ルート
@main_bp.route('/task-status/<task_id>', methods=['GET'])
def task_status_legacy(task_id):
    """後方互換性のためのタスク状態取得ルート"""
    return task_status(task_id)

# システム情報の個別ルート
@main_bp.route('/dataset-info', methods=['GET'])
def get_dataset_info_legacy():
    """後方互換性のためのデータセット情報取得ルート"""
    return get_dataset_info()

@main_bp.route('/system-stats', methods=['GET'])
def get_system_stats_legacy():
    """後方互換性のためのシステム統計取得ルート"""
    return get_system_stats()

# 判定履歴の個別ルート
@main_bp.route('/classification-history', methods=['GET'])
def get_classification_history_legacy():
    """後方互換性のための判定履歴取得ルート"""
    return get_classification_history()

@main_bp.route('/feedback', methods=['POST'])
def submit_feedback_legacy():
    """後方互換性のためのフィードバック送信ルート"""
    return submit_feedback()

# クリーンアップの個別ルート
@main_bp.route('/cleanup/temp-files', methods=['POST'])
def cleanup_temp_files_legacy():
    """後方互換性のためのクリーンアップルート"""
    return cleanup_temp_files()