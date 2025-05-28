"""
routes/learning.py - 統合学習ルート

機能:
- 学習データ管理
- モデル訓練・評価
- アノテーション機能  
- タスク状態管理
- 評価履歴
"""

from flask import Blueprint, request, jsonify, render_template, send_from_directory, current_app
from werkzeug.utils import secure_filename
import os
import json
import uuid
import traceback
import base64
from datetime import datetime
from app_utils.file_handlers import handle_multiple_image_upload

learning_bp = Blueprint('learning', __name__, url_prefix='/learning')


# ================================
# データ管理API
# ================================

@learning_bp.route('/upload-data', methods=['POST'])
def upload_learning_data():
    """学習データ用の画像をアップロード（シンプル版）"""
    from app import app
    from config import TRAINING_DATA_DIR, METADATA_FILE
    
    if 'images' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
    
    files = request.files.getlist('images')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    # 保存先ディレクトリ
    target_dir = TRAINING_DATA_DIR
    
    # gender パラメータをチェック
    gender = request.form.get('gender', 'unknown')
    
    # 共通関数を使用
    uploaded_files, errors = handle_multiple_image_upload(
        files, 
        target_dir, 
        app.config.get('ALLOWED_EXTENSIONS')
    )
    
    # メタデータに性別情報を保存
    metadata = {}
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        except:
            metadata = {}
    
    # アップロードされたファイルのメタデータを更新
    for file_info in uploaded_files:
        filename = file_info['filename']
        metadata[filename] = {
            'gender': gender,
            'upload_time': datetime.now().isoformat(),
            'original_name': file_info.get('original_name', filename)
        }
        
        # URLを設定
        file_info['url'] = f'/annotation/images/image/{filename}'
    
    # メタデータを保存
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    result = {
        "success": len(uploaded_files) > 0,
        "uploaded_count": len(uploaded_files),
        "error_count": len(errors),
        "uploaded_files": uploaded_files
    }
    
    if errors:
        result["errors"] = errors
    
    if len(uploaded_files) > 0:
        result["message"] = f"{len(uploaded_files)}個のファイルをアップロードしました"
        current_app.logger.info(f"学習データアップロード: {len(uploaded_files)}ファイル - ディレクトリ: {target_dir}")
    else:
        result["message"] = "アップロードに失敗しました"
        
    return jsonify(result)

@learning_bp.route('/dataset-stats')
def get_dataset_stats():
    """学習データセットの統計情報を取得"""
    from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, METADATA_FILE
    
    try:
        # メタデータを読み込み
        metadata = {}
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
            except:
                pass
        
        # 画像とラベルのカウント
        total_images = 0
        total_labels = 0
        male_count = 0
        female_count = 0
        unknown_count = 0
        
        if os.path.exists(TRAINING_IMAGES_DIR):
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    total_images += 1
                    
                    # メタデータから性別情報を取得（ある場合）
                    image_info = metadata.get(filename, {})
                    gender = image_info.get('gender', 'unknown')
                    
                    if gender == 'male':
                        male_count += 1
                    elif gender == 'female':
                        female_count += 1
                    else:
                        unknown_count += 1
        
        if os.path.exists(TRAINING_LABELS_DIR):
            total_labels = len([f for f in os.listdir(TRAINING_LABELS_DIR) if f.endswith('.txt')])
        
        # アノテーション率
        annotation_ratio = (total_labels / total_images * 100) if total_images > 0 else 0
        
        return jsonify({
            "total_images": total_images,
            "total_labels": total_labels,
            "male_count": male_count,
            "female_count": female_count,
            "unknown_count": unknown_count,
            "annotation_count": total_labels,
            "total_count": total_images,  # 互換性のため追加
            "ratios": {
                "annotation": annotation_ratio,
                "male": (male_count / total_images * 100) if total_images > 0 else 0,
                "female": (female_count / total_images * 100) if total_images > 0 else 0
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"データセット統計取得エラー: {str(e)}")
        return jsonify({"error": "統計情報の取得に失敗しました"}), 500


@learning_bp.route('/learning-data')
def get_learning_data():
    """学習データ一覧を取得"""
    from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, METADATA_FILE
    
    try:
        gender_filter = request.args.get('gender', 'all')
        
        # メタデータを読み込み
        metadata = {}
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
            except:
                pass
        
        result = {
            'male': [],
            'female': [],
            'unknown': []
        }
        
        # 画像ファイルをリストアップ
        if os.path.exists(TRAINING_IMAGES_DIR):
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    # メタデータから情報を取得
                    image_info = metadata.get(filename, {'gender': 'unknown'})
                    gender = image_info.get('gender', 'unknown')
                    
                    if gender_filter != 'all' and gender_filter != gender:
                        continue
                    
                    # ラベルファイルの存在確認
                    label_file = os.path.splitext(filename)[0] + '.txt'
                    has_annotation = os.path.exists(os.path.join(TRAINING_LABELS_DIR, label_file))
                    
                    # 画像情報を作成
                    sample_info = {
                        'filename': filename,
                        'path': os.path.join(TRAINING_IMAGES_DIR, filename),
                        'url': f"/annotation/images/image/{filename}",
                        'has_annotation': has_annotation,
                        'category': gender,
                        'metadata': image_info
                    }
                    
                    # カテゴリに応じて振り分け
                    if gender in result:
                        result[gender].append(sample_info)
                    else:
                        result['unknown'].append(sample_info)
        
        # 総数情報を追加
        result['counts'] = {
            'male': len(result['male']),
            'female': len(result['female']),
            'unknown': len(result['unknown']),
            'total': len(result['male']) + len(result['female']) + len(result['unknown'])
        }
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"学習データ取得エラー: {str(e)}")
        return jsonify({"error": "学習データの取得に失敗しました"}), 500

@learning_bp.route('/delete-data', methods=['POST'])
def delete_learning_data():
    """学習データを削除"""
    from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, METADATA_FILE, YOLO_DATASET_DIR
    
    try:
        data = request.json
        if not data or ('path' not in data and 'filename' not in data):
            return jsonify({"error": "削除する画像の情報が指定されていません"}), 400
        
        # ファイル名を取得（pathまたはfilenameから）
        if 'filename' in data:
            filename = data['filename']
        else:
            # pathから抽出
            path = data['path']
            filename = os.path.basename(path)
        
        # パスの検証（セキュリティ）
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({"error": "不正なファイル名です"}), 400
        
        # 画像ファイルのフルパス
        image_path = os.path.join(TRAINING_IMAGES_DIR, filename)
        
        if not os.path.exists(image_path):
            return jsonify({"error": "指定された画像が見つかりません"}), 404
        
        # 画像ファイルを削除
        os.remove(image_path)
        
        # 関連するラベルファイルも削除
        base_name = os.path.splitext(filename)[0]
        label_path = os.path.join(TRAINING_LABELS_DIR, f'{base_name}.txt')
        if os.path.exists(label_path):
            os.remove(label_path)
        
        # YOLOデータセットからも削除
        yolo_paths = [
            os.path.join(YOLO_DATASET_DIR, 'images/train', filename),
            os.path.join(YOLO_DATASET_DIR, 'images/val', filename),
            os.path.join(YOLO_DATASET_DIR, 'labels/train', f'{base_name}.txt'),
            os.path.join(YOLO_DATASET_DIR, 'labels/val', f'{base_name}.txt')
        ]
        
        for yolo_path in yolo_paths:
            if os.path.exists(yolo_path):
                try:
                    os.remove(yolo_path)
                except Exception as e:
                    current_app.logger.warning(f"YOLOファイル削除エラー: {yolo_path} - {str(e)}")
        
        # メタデータから削除
        metadata = {}
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
            except:
                pass
        
        if filename in metadata:
            del metadata[filename]
            with open(METADATA_FILE, 'w') as f:
                json.dump(metadata, f, indent=2)
        
        current_app.logger.info(f"学習データ削除: {filename}")
        
        return jsonify({
            "success": True,
            "message": "画像を削除しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"学習データ削除エラー: {str(e)}")
        return jsonify({"error": f"画像の削除に失敗しました: {str(e)}"}), 500

@learning_bp.route('/delete-all-data', methods=['POST'])
def delete_all_learning_data():
    """全ての学習データを削除"""
    from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, METADATA_FILE, YOLO_DATASET_DIR
    
    try:
        deleted_count = 0
        deleted_files = []
        
        # 画像ファイルを削除
        if os.path.exists(TRAINING_IMAGES_DIR):
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    file_path = os.path.join(TRAINING_IMAGES_DIR, filename)
                    try:
                        os.remove(file_path)
                        deleted_count += 1
                        deleted_files.append(filename)
                    except Exception as e:
                        current_app.logger.error(f"ファイル削除エラー: {file_path} - {str(e)}")
        
        # ラベルファイルを削除
        if os.path.exists(TRAINING_LABELS_DIR):
            for filename in os.listdir(TRAINING_LABELS_DIR):
                if filename.endswith('.txt'):
                    file_path = os.path.join(TRAINING_LABELS_DIR, filename)
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        current_app.logger.error(f"ラベル削除エラー: {file_path} - {str(e)}")
        
        # YOLOデータセットもクリア
        yolo_dirs = [
            os.path.join(YOLO_DATASET_DIR, 'images/train'),
            os.path.join(YOLO_DATASET_DIR, 'images/val'),
            os.path.join(YOLO_DATASET_DIR, 'labels/train'),
            os.path.join(YOLO_DATASET_DIR, 'labels/val')
        ]
        
        for yolo_dir in yolo_dirs:
            if os.path.exists(yolo_dir):
                for filename in os.listdir(yolo_dir):
                    file_path = os.path.join(yolo_dir, filename)
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        current_app.logger.warning(f"YOLOファイル削除エラー: {file_path} - {str(e)}")
        
        # メタデータをクリア
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, 'w') as f:
                json.dump({}, f)
        
        current_app.logger.info(f"全学習データ削除: {deleted_count}ファイル")
        
        return jsonify({
            "success": True,
            "message": f"{deleted_count}個の画像を削除しました",
            "deleted_count": deleted_count,
            "deleted_files": deleted_files
        })
        
    except Exception as e:
        current_app.logger.error(f"全データ削除エラー: {str(e)}")
        return jsonify({"error": f"削除中にエラーが発生しました: {str(e)}"}), 500
        
# ================================
# アノテーション機能
# ================================

@learning_bp.route('/save-annotation', methods=['POST'])
def save_annotation():
    """
    アノテーション画像を保存
    
    Request:
    - image_data: Base64エンコードされた画像データ
    - original_path: 元の画像パス
    
    Returns:
    - JSON: 保存結果
    """
    try:
        data = request.json
        
        if not data or 'image_data' not in data or 'original_path' not in data:
            return jsonify({"error": "必要なパラメータが不足しています"}), 400
        
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
        original_path = data['original_path']
        
        # ファイル名を取得
        filename = os.path.basename(original_path)
        basename, ext = os.path.splitext(filename)
        
        # 新しいファイル名（元の名前に_annotation付加）
        new_filename = f"{basename}_annotation{ext}"
        
        # アノテーション保存ディレクトリ（検出結果ディレクトリを使用）
        from config import DETECTION_RESULTS_DIR
        os.makedirs(DETECTION_RESULTS_DIR, exist_ok=True)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        save_path = os.path.join(DETECTION_RESULTS_DIR, new_filename)
        if os.path.exists(save_path):
            unique_suffix = uuid.uuid4().hex[:8]
            new_filename = f"{basename}_annotation_{unique_suffix}{ext}"
            save_path = os.path.join(DETECTION_RESULTS_DIR, new_filename)
        
        # 画像の保存
        with open(save_path, 'wb') as f:
            f.write(image_bytes)
        
        # アノテーションマッピングファイルの更新（後方互換性のため残す）
        annotation_mapping_file = os.path.join('static', 'annotation_mapping.json')
        
        # 既存のマッピングを読み込み
        if os.path.exists(annotation_mapping_file):
            try:
                with open(annotation_mapping_file, 'r') as f:
                    mapping = json.load(f)
            except Exception:
                mapping = {}
        else:
            mapping = {}
        
        # 新しいマッピングを追加
        # 相対パスでマッピングを保存
        relative_annotation_path = f"detection_results/{new_filename}"
        mapping[original_path] = relative_annotation_path
        
        # マッピングファイルを更新
        os.makedirs(os.path.dirname(annotation_mapping_file), exist_ok=True)
        with open(annotation_mapping_file, 'w') as f:
            json.dump(mapping, f, indent=2)
        
        current_app.logger.info(f"アノテーション保存完了: {new_filename}")
        
        return jsonify({
            "success": True,
            "annotation_path": save_path,
            "filename": new_filename,
            "mapping_updated": True
        })
        
    except Exception as e:
        current_app.logger.error(f"アノテーション保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"アノテーションの保存中にエラーが発生しました: {str(e)}"}), 500



# ================================
# タスク状態管理 (旧api_routes.pyから統合)
# ================================

@learning_bp.route('/task-status/<task_id>')
def get_task_status_by_id(task_id):
    """
    タスクIDでの状態取得（パスパラメータ版）
    
    Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - JSON: タスクの処理状態
    """
    from app import processing_status
    
    if not task_id:
        return jsonify({"status": "unknown", "message": "タスクIDが指定されていません"}), 400
    
    # ステータスの取得
    status = processing_status.get(task_id, {"status": "unknown", "message": "タスクが見つかりません"})
    
    current_app.logger.debug(f"タスク状態取得: {task_id} = {status}")
    
    # ステータスをそのまま返す（オブジェクトではなくフラットな形式）
    return jsonify(status)

@learning_bp.route('/cancel-task/<task_id>', methods=['POST'])
def cancel_task(task_id):
    """
    タスクをキャンセル
    
    Parameters:
    - task_id: キャンセルするタスクのID
    
    Returns:
    - JSON: キャンセル結果
    """
    from app import processing_status
    
    if not task_id:
        return jsonify({"error": "タスクIDが指定されていません"}), 400
    
    # タスクの存在確認
    if task_id not in processing_status:
        return jsonify({"error": "指定されたタスクが見つかりません"}), 404
    
    # タスクの状態確認
    status = processing_status[task_id]
    
    # すでに完了または失敗したタスクはキャンセル不可
    if status.get('status') in ['completed', 'failed', 'error']:
        return jsonify({
            "error": "すでに完了または失敗したタスクはキャンセルできません",
            "current_status": status
        }), 400
    
    # 状態をキャンセルに更新
    processing_status[task_id] = {
        "status": "cancelled",
        "message": "ユーザーによってキャンセルされました",
        "previous_status": status
    }
    
    current_app.logger.info(f"タスクをキャンセルしました: {task_id}")
    
    return jsonify({
        "success": True,
        "message": "タスクがキャンセルされました",
        "task_id": task_id
    })




# ================================
# ヘルパー関数
# ================================

def validate_dataset_for_training():
    """
    訓練用データセットの検証
    
    Returns:
    - dict: 検証結果
    """
    try:
        # データセット統計取得
        stats_response = get_dataset_stats()
        stats_data = stats_response.get_json()
        
        # 検証ルール
        validation_rules = [
            {
                "condition": stats_data.get('male_count', 0) >= 5,
                "message": "オス画像が最低5枚必要です",
                "current": stats_data.get('male_count', 0),
                "required": 5,
                "suggestion": "オスのウニ生殖乳頭画像をさらにアップロードしてください"
            },
            {
                "condition": stats_data.get('female_count', 0) >= 5,
                "message": "メス画像が最低5枚必要です",
                "current": stats_data.get('female_count', 0),
                "required": 5,
                "suggestion": "メスのウニ生殖乳頭画像をさらにアップロードしてください"
            },
            {
                "condition": stats_data.get('total_count', 0) >= 10,
                "message": "合計画像数が最低10枚必要です",
                "current": stats_data.get('total_count', 0),
                "required": 10,
                "suggestion": "より多くの学習データを追加することで精度が向上します"
            }
        ]
        
        # 検証実行
        failed_rules = [rule for rule in validation_rules if not rule['condition']]
        
        if failed_rules:
            return {
                "valid": False,
                "message": "データセットが訓練要件を満たしていません",
                "failed_requirements": failed_rules,
                "suggestions": [rule['suggestion'] for rule in failed_rules],
                "stats": stats_data
            }
        
        # 品質チェック
        quality_warnings = check_dataset_quality(stats_data)
        
        return {
            "valid": True,
            "message": "データセットは訓練準備完了です",
            "stats": stats_data,
            "quality_warnings": quality_warnings,
            "estimated_accuracy": estimate_model_accuracy(stats_data)
        }
        
    except Exception as e:
        current_app.logger.error(f"データセット検証エラー: {str(e)}")
        return {
            "valid": False,
            "message": f"検証中にエラーが発生しました: {str(e)}",
            "stats": {}
        }

def calculate_readiness_score(stats_data):
    """
    準備完了度スコアの計算
    
    Parameters:
    - stats_data: データセット統計
    
    Returns:
    - dict: 準備完了度情報
    """
    score = 0
    max_score = 100
    requirements = []
    suggestions = []
    
    # データ量チェック (40点)
    male_count = stats_data.get('male_count', 0)
    female_count = stats_data.get('female_count', 0)
    total_count = stats_data.get('total_count', 0)
    
    if male_count >= 5 and female_count >= 5:
        score += 30
        requirements.append({"item": "最小データ量", "status": "完了", "score": 30})
    else:
        requirements.append({"item": "最小データ量", "status": "不足", "score": 0})
        suggestions.append(f"オス{max(0, 5-male_count)}枚、メス{max(0, 5-female_count)}枚を追加してください")
    
    if total_count >= 20:
        score += 10
        requirements.append({"item": "推奨データ量", "status": "完了", "score": 10})
    else:
        requirements.append({"item": "推奨データ量", "status": "部分", "score": 5})
        suggestions.append(f"より高い精度のため、合計{20-total_count}枚の追加を推奨します")
    
    # バランスチェック (20点)
    if total_count > 0:
        balance = min(male_count, female_count) / max(male_count, female_count, 1)
        if balance >= 0.8:
            score += 20
            requirements.append({"item": "データバランス", "status": "良好", "score": 20})
        elif balance >= 0.6:
            score += 15
            requirements.append({"item": "データバランス", "status": "普通", "score": 15})
        else:
            score += 10
            requirements.append({"item": "データバランス", "status": "改善余地", "score": 10})
            suggestions.append("オスとメスのデータ数をより均等にすることを推奨します")
    
    # アノテーション率チェック (30点)
    annotation_count = stats_data.get('annotation_count', 0)
    if total_count > 0:
        annotation_rate = annotation_count / total_count
        if annotation_rate >= 0.5:
            score += 30
            requirements.append({"item": "アノテーション率", "status": "優秀", "score": 30})
        elif annotation_rate >= 0.3:
            score += 20
            requirements.append({"item": "アノテーション率", "status": "良好", "score": 20})
        elif annotation_rate >= 0.1:
            score += 10
            requirements.append({"item": "アノテーション率", "status": "低い", "score": 10})
            suggestions.append("より多くの画像にアノテーションを追加すると精度が向上します")
        else:
            requirements.append({"item": "アノテーション率", "status": "不足", "score": 0})
            suggestions.append("手動アノテーションを開始してください")
    
    # 品質評価 (10点)
    if total_count >= 10 and male_count >= 5 and female_count >= 5:
        score += 10
        requirements.append({"item": "基本品質", "status": "合格", "score": 10})
    
    # ステータス判定
    if score >= 80:
        status = "excellent"
        message = "学習開始の準備が完了しています！優秀なモデルが期待できます。"
    elif score >= 60:
        status = "good"
        message = "学習を開始できます。さらなる改善でより良い結果が得られます。"
    elif score >= 40:
        status = "fair"
        message = "基本的な学習は可能ですが、データ追加を推奨します。"
    else:
        status = "poor"
        message = "学習開始にはより多くのデータが必要です。"
    
    return {
        "score": score,
        "percentage": score,
        "status": status,
        "message": message,
        "requirements": requirements,
        "suggestions": suggestions
    }

def check_dataset_quality(stats_data):
    """
    データセット品質の詳細チェック
    
    Parameters:
    - stats_data: データセット統計
    
    Returns:
    - list: 品質警告のリスト
    """
    warnings = []
    
    male_count = stats_data.get('male_count', 0)
    female_count = stats_data.get('female_count', 0)
    total_count = stats_data.get('total_count', 0)
    annotation_count = stats_data.get('annotation_count', 0)
    
    # データ量の警告
    if total_count < 20:
        warnings.append({
            "type": "data_quantity",
            "level": "warning",
            "message": f"データ数が少ないため({total_count}枚)、過学習のリスクがあります"
        })
    
    # バランスの警告
    if total_count > 0:
        imbalance = abs(male_count - female_count) / total_count
        if imbalance > 0.3:
            warnings.append({
                "type": "data_balance",
                "level": "warning", 
                "message": f"オス({male_count})とメス({female_count})のデータ比率に偏りがあります"
            })
    
    # アノテーション率の警告
    if total_count > 0:
        annotation_rate = annotation_count / total_count
        if annotation_rate < 0.2:
            warnings.append({
                "type": "annotation_rate",
                "level": "info",
                "message": f"アノテーション率が低いです({annotation_rate*100:.1f}%) - 手動アノテーションで精度向上が可能"
            })
    
    return warnings

def estimate_model_accuracy(stats_data):
    """
    予想モデル精度の推定
    
    Parameters:
    - stats_data: データセット統計
    
    Returns:
    - dict: 精度予想
    """
    base_accuracy = 0.6  # ベース精度
    
    # データ量による補正
    total_count = stats_data.get('total_count', 0)
    if total_count >= 50:
        base_accuracy += 0.15
    elif total_count >= 30:
        base_accuracy += 0.10
    elif total_count >= 20:
        base_accuracy += 0.05
    
    # バランスによる補正
    male_count = stats_data.get('male_count', 0)
    female_count = stats_data.get('female_count', 0)
    balance = 0
    if total_count > 0:
        balance = min(male_count, female_count) / max(male_count, female_count, 1)
        base_accuracy += balance * 0.1
    
    # アノテーション率による補正
    annotation_count = stats_data.get('annotation_count', 0)
    annotation_rate = 0
    if total_count > 0:
        annotation_rate = annotation_count / total_count
        base_accuracy += annotation_rate * 0.15
    
    return {
        "estimated_accuracy": min(0.95, base_accuracy),  # 最大95%
        "confidence_level": "medium" if total_count >= 20 else "low",
        "factors": {
            "data_quantity": total_count,
            "data_balance": balance,
            "annotation_rate": annotation_rate
        }
    }

def estimate_training_duration(stats_data):
    """
    訓練時間の推定
    
    Parameters:
    - stats_data: データセット統計
    
    Returns:
    - dict: 時間推定
    """
    total_count = stats_data.get('total_count', 0)
    
    # 基本時間 (秒)
    base_time = 30  # 基本処理時間
    
    # データ量による追加時間
    data_time = total_count * 2  # 1枚あたり2秒
    
    # アノテーション処理時間
    annotation_count = stats_data.get('annotation_count', 0)
    annotation_time = annotation_count * 3  # アノテーション1つあたり3秒
    
    total_seconds = base_time + data_time + annotation_time
    
    return {
        "estimated_seconds": total_seconds,
        "estimated_minutes": round(total_seconds / 60, 1),
        "phases": {
            "feature_extraction": round(total_seconds * 0.4),
            "model_training": round(total_seconds * 0.3),
            "evaluation": round(total_seconds * 0.2),
            "analysis": round(total_seconds * 0.1)
        }
    }

def get_phase_details(status):
    """
    フェーズ詳細情報の取得
    
    Parameters:
    - status: 処理ステータス
    
    Returns:
    - dict: フェーズ詳細
    """
    current_phase = status.get('current_phase', 'preparation')
    phases_completed = status.get('phases_completed', [])
    
    phase_info = {
        "preparation": {"name": "準備", "description": "データセット検証中"},
        "feature_extraction": {"name": "特徴抽出", "description": "画像から特徴量を抽出中"},
        "model_training": {"name": "モデル訓練", "description": "機械学習モデルを訓練中"},
        "basic_evaluation": {"name": "基本評価", "description": "モデル性能を評価中"},
        "detailed_analysis": {"name": "詳細分析", "description": "詳細な分析を実行中"},
        "annotation_impact": {"name": "アノテーション効果", "description": "アノテーション効果を分析中"}
    }
    
    return {
        "current": phase_info.get(current_phase, {"name": "不明", "description": ""}),
        "completed": [phase_info.get(phase, {"name": phase}) for phase in phases_completed],
        "total_phases": len(phase_info)
    }

def estimate_remaining_time(status):
    """
    残り時間の推定
    
    Parameters:
    - status: 処理ステータス
    
    Returns:
    - dict: 残り時間情報
    """
    progress = status.get('progress', 0)
    
    if progress <= 0:
        return {"estimated_seconds": 180, "estimated_minutes": 3}
    
    # 簡易的な推定（実際の実装ではより精密な計算が必要）
    remaining_percentage = 100 - progress
    estimated_seconds = int(remaining_percentage * 1.8)  # 1%あたり1.8秒
    
    return {
        "estimated_seconds": estimated_seconds,
        "estimated_minutes": round(estimated_seconds / 60, 1)
    }

def get_next_phase(status):
    """
    次フェーズの取得
    
    Parameters:
    - status: 処理ステータス
    
    Returns:
    - str: 次フェーズ名
    """
    current_phase = status.get('current_phase', 'preparation')
    
    phase_order = [
        'preparation',
        'feature_extraction', 
        'model_training',
        'basic_evaluation',
        'detailed_analysis',
        'annotation_impact'
    ]
    
    try:
        current_index = phase_order.index(current_phase)
        if current_index < len(phase_order) - 1:
            return phase_order[current_index + 1]
    except ValueError:
        pass
    
    return None

def calculate_completion_percentage(status):
    """
    完了率の計算
    
    Parameters:
    - status: 処理ステータス
    
    Returns:
    - float: 完了率 (0-100)
    """
    phases_completed = len(status.get('phases_completed', []))
    total_phases = 6  # 全フェーズ数
    base_percentage = (phases_completed / total_phases) * 100
    
    # 現在フェーズの進捗を加算
    current_progress = status.get('progress', 0)
    current_phase_weight = 100 / total_phases
    current_contribution = (current_progress / 100) * current_phase_weight
    
    return min(100, base_percentage + current_contribution)


@learning_bp.route('/delete-annotation', methods=['POST'])
def delete_annotation():
    """
    アノテーションを削除
    
    Request:
    - image_path: 元の画像パス
    - annotation_path: アノテーション画像パス
    
    Returns:
    - JSON: 削除結果
    """
    try:
        data = request.json
        
        if not data or 'image_path' not in data:
            return jsonify({"error": "画像パスが指定されていません"}), 400
        
        image_path = data['image_path']
        annotation_path = data.get('annotation_path')
        
        # アノテーションマッピングファイルの更新
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        
        if os.path.exists(mapping_file):
            try:
                with open(mapping_file, 'r') as f:
                    mapping = json.load(f)
                
                # マッピングから削除
                if image_path in mapping:
                    annotation_file_path = mapping[image_path]
                    
                    # アノテーション画像ファイルを削除
                    full_annotation_path = os.path.join('static', annotation_file_path)
                    if os.path.exists(full_annotation_path):
                        os.remove(full_annotation_path)
                        current_app.logger.info(f"アノテーション画像を削除: {full_annotation_path}")
                    
                    # マッピングから削除
                    del mapping[image_path]
                    
                    # マッピングファイルを更新
                    with open(mapping_file, 'w') as f:
                        json.dump(mapping, f, indent=2)
                    
                    current_app.logger.info(f"アノテーションを削除: {image_path}")
                    
                    return jsonify({
                        "success": True,
                        "message": "アノテーションを削除しました"
                    })
                else:
                    return jsonify({"error": "指定された画像のアノテーションが見つかりません"}), 404
                
            except Exception as e:
                current_app.logger.error(f"アノテーションマッピング処理エラー: {str(e)}")
                return jsonify({"error": "アノテーションマッピングの処理に失敗しました"}), 500
        else:
            return jsonify({"error": "アノテーションマッピングファイルが見つかりません"}), 404
        
    except Exception as e:
        current_app.logger.error(f"アノテーション削除エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"アノテーション削除中にエラーが発生しました: {str(e)}"}), 500


@learning_bp.route('/get-annotation-info/<path:image_path>')
def get_annotation_info(image_path):
    """
    指定された画像のアノテーション情報を取得
    
    Parameters:
    - image_path: 画像パス
    
    Returns:
    - JSON: アノテーション情報
    """
    try:
        # パス検証
        if '..' in image_path:
            return jsonify({"error": "不正なパスです"}), 400
        
        # アノテーションマッピングを確認
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        
        if not os.path.exists(mapping_file):
            return jsonify({
                "exists": False,
                "message": "アノテーションマッピングファイルが見つかりません"
            })
        
        try:
            with open(mapping_file, 'r') as f:
                mapping = json.load(f)
            
            if image_path in mapping:
                annotation_path = mapping[image_path]
                full_annotation_path = os.path.join('static', annotation_path)
                
                # アノテーション画像の存在確認
                if os.path.exists(full_annotation_path):
                    return jsonify({
                        "exists": True,
                        "annotation_path": annotation_path,
                        "annotation_url": f"/static/{annotation_path}",
                        "file_size": os.path.getsize(full_annotation_path),
                        "last_modified": datetime.fromtimestamp(
                            os.path.getmtime(full_annotation_path)
                        ).isoformat()
                    })
                else:
                    # マッピングにはあるが、ファイルが存在しない場合
                    return jsonify({
                        "exists": False,
                        "error": "アノテーション画像ファイルが見つかりません",
                        "mapped_path": annotation_path
                    })
            else:
                return jsonify({
                    "exists": False,
                    "message": "このイメージにはアノテーションがありません"
                })
                
        except Exception as e:
            current_app.logger.error(f"アノテーション情報読み込みエラー: {str(e)}")
            return jsonify({"error": "アノテーション情報の読み込みに失敗しました"}), 500
        
    except Exception as e:
        current_app.logger.error(f"アノテーション情報取得エラー: {str(e)}")
        return jsonify({"error": "アノテーション情報の取得に失敗しました"}), 500


@learning_bp.route('/results')
@learning_bp.route('/results/<exp>')
def view_results(exp=None):
    """学習結果を表示（特定の実験または最新）"""
    try:
        import pandas as pd
        import os
        from datetime import datetime
        
        # YOLOv5の学習結果ディレクトリを確認
        train_dir = 'yolov5/runs/train'
        results_data = None
        
        if os.path.exists(train_dir):
            # 実験ディレクトリを決定
            if exp and os.path.exists(os.path.join(train_dir, exp)):
                target_exp = exp
            else:
                # 最新の実験ディレクトリを取得
                exp_dirs = sorted([d for d in os.listdir(train_dir) if d.startswith('exp')])
                if not exp_dirs:
                    return render_template('learning_results.html', error='学習結果が見つかりません')
                target_exp = exp_dirs[-1]
            
            # 実験に含まれる画像ファイルのリストを生成
            exp_path = os.path.join(train_dir, target_exp)
            available_images = {
                'training': [],
                'validation': [],
                'analysis': []
            }
            
            # 訓練画像
            for i in range(10):  # 最大10個チェック
                if os.path.exists(os.path.join(exp_path, f'train_batch{i}.jpg')):
                    available_images['training'].append(i)
            
            # 検証画像
            if os.path.exists(os.path.join(exp_path, 'val_batch0_labels.jpg')):
                available_images['validation'].append('labels')
            if os.path.exists(os.path.join(exp_path, 'val_batch0_pred.jpg')):
                available_images['validation'].append('pred')
                
            # 分析画像
            for img in ['labels.jpg', 'results.png', 'confusion_matrix.png', 'PR_curve.png', 'P_curve.png', 'R_curve.png', 'F1_curve.png']:
                if os.path.exists(os.path.join(exp_path, img)):
                    available_images['analysis'].append(img)
            
            results_csv_path = os.path.join(train_dir, target_exp, 'results.csv')
            
            if os.path.exists(results_csv_path):
                # CSVファイルを読み込み
                df = pd.read_csv(results_csv_path)
                
                # データを整形（列名の空白を削除）
                df.columns = df.columns.str.strip()
                
                data = []
                for _, row in df.iterrows():
                    data.append({
                        'epoch': int(row['epoch']),
                        'train_box_loss': float(row['train/box_loss']),
                        'train_obj_loss': float(row['train/obj_loss']),
                        'train_cls_loss': float(row['train/cls_loss']),
                        'precision': float(row['metrics/precision']),
                        'recall': float(row['metrics/recall']),
                        'map50': float(row['metrics/mAP_0.5']),
                        'map50_95': float(row['metrics/mAP_0.5:0.95']),
                        'val_box_loss': float(row['val/box_loss']),
                        'val_obj_loss': float(row['val/obj_loss']),
                        'val_cls_loss': float(row['val/cls_loss']),
                        'lr0': float(row['x/lr0']),
                        'lr1': float(row['x/lr1']),
                        'lr2': float(row['x/lr2'])
                    })
                
                # 最新のデータ
                latest = data[-1] if data else None
                
                # 最高mAP@0.5を持つエポックを見つける
                best_map50_epoch = 0
                best_map50 = 0
                for d in data:
                    if d['map50'] > best_map50:
                        best_map50 = d['map50']
                        best_map50_epoch = d['epoch']
                
                # 学習中かどうかを判定（requestsを使わない方法）
                is_training = False
                try:
                    # YoloTrainerのステータスを直接確認
                    from core.YoloTrainer import YoloTrainer
                    trainer_status = YoloTrainer.get_latest_training()
                    if trainer_status and trainer_status.get('is_training'):
                        is_training = True
                except:
                    pass
                
                # モデル情報を取得
                opt_yaml_path = os.path.join(train_dir, target_exp, 'opt.yaml')
                training_params = {
                    'batch_size': 16,
                    'img_size': 640,
                    'lr0': 0.01,
                    'weight_decay': 0.0005
                }
                
                if os.path.exists(opt_yaml_path):
                    try:
                        import yaml
                        with open(opt_yaml_path, 'r') as f:
                            opt_data = yaml.safe_load(f)
                            training_params['batch_size'] = opt_data.get('batch_size', 16)
                            training_params['img_size'] = opt_data.get('imgsz', 640)
                            training_params['lr0'] = opt_data.get('lr0', 0.01)
                            training_params['weight_decay'] = opt_data.get('weight_decay', 0.0005)
                    except:
                        pass
                
                results_data = {
                    'data': data,
                    'summary': {
                        'current_epoch': latest['epoch'] if latest else 0,
                        'total_epochs': len(data),
                        'best_map50': best_map50,
                        'best_map50_epoch': best_map50_epoch,
                        'current_map50': latest['map50'] if latest else 0,
                        'current_loss': (latest['train_box_loss'] + latest['train_obj_loss'] + latest['train_cls_loss']) if latest else 0
                    },
                    'is_training': is_training,
                    'model_info': {
                        'model_type': 'YOLOv5',
                        'experiment': target_exp,
                        'start_time': datetime.fromtimestamp(os.path.getctime(os.path.join(train_dir, target_exp))).strftime('%Y-%m-%d %H:%M:%S'),
                        'last_update': datetime.fromtimestamp(os.path.getmtime(results_csv_path)).strftime('%Y-%m-%d %H:%M:%S'),
                        'dataset_path': 'data/yolo_dataset'
                    },
                    'training_params': training_params
                }
            # results_dataに画像情報を追加
            if results_data:
                results_data['available_images'] = available_images
        
        return render_template('learning_results.html', results=results_data)
        
    except Exception as e:
        print(f"学習結果表示エラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return render_template('learning_results.html', error=f"結果の読み込みに失敗しました: {str(e)}")

@learning_bp.route('/download-results-csv')
def download_results_csv():
    """学習結果CSVをダウンロード"""
    try:
        import os
        from flask import send_file
        
        train_dir = 'yolov5/runs/train'
        
        if os.path.exists(train_dir):
            exp_dirs = sorted([d for d in os.listdir(train_dir) if d.startswith('exp')])
            
            if exp_dirs:
                latest_exp = exp_dirs[-1]
                results_csv_path = os.path.join(train_dir, latest_exp, 'results.csv')
                
                if os.path.exists(results_csv_path):
                    return send_file(results_csv_path, as_attachment=True, download_name=f'yolo_results_{latest_exp}.csv')
        
        return jsonify({'error': 'CSVファイルが見つかりません'}), 404
        
    except Exception as e:
        print(f"CSVダウンロードエラー: {str(e)}")
        return jsonify({'error': str(e)}), 500

# routes/learning.py に追加

@learning_bp.route('/dashboard')
def learning_dashboard():
    """学習全体のダッシュボード表示"""
    try:
        import os
        from datetime import datetime
        import glob
        
        # 全学習履歴を収集
        train_dir = 'yolov5/runs/train'
        all_trainings = []
        total_images = 0
        best_accuracy = 0
        total_epochs = 0
        
        if os.path.exists(train_dir):
            # expディレクトリを数値順にソート（exp, exp2, exp3...の順）
            exp_dirs = []
            for d in os.listdir(train_dir):
                if d.startswith('exp'):
                    exp_dirs.append(d)
            
            # 数値でソート（exp -> exp2 -> exp3 の順）
            def get_exp_number(exp_name):
                if exp_name == 'exp':
                    return 0
                try:
                    return int(exp_name[3:])
                except:
                    return 0
            
            exp_dirs.sort(key=get_exp_number)
            
            for exp_dir in exp_dirs:
                results_csv = os.path.join(train_dir, exp_dir, 'results.csv')
                if os.path.exists(results_csv):
                    try:
                        import pandas as pd
                        df = pd.read_csv(results_csv)
                        df.columns = df.columns.str.strip()
                        
                        # 最高精度を取得
                        max_map = df['metrics/mAP_0.5'].max()
                        best_accuracy = max(best_accuracy, max_map)
                        
                        # エポック数
                        epochs = len(df)
                        total_epochs += epochs
                        
                        # 画像数を推定（データセットから）
                        dataset_info = get_dataset_info()
                        total_images = dataset_info['total']  # 最新の値で更新
                        
                        all_trainings.append({
                            'experiment': exp_dir,
                            'date': datetime.fromtimestamp(os.path.getctime(os.path.join(train_dir, exp_dir))).strftime('%Y-%m-%d %H:%M'),
                            'epochs': epochs,
                            'accuracy': max_map,
                            'final_accuracy': df['metrics/mAP_0.5'].iloc[-1] if len(df) > 0 else 0
                        })
                    except:
                        pass
        
        # 現在のモデル情報
        current_model = {
            'type': 'YOLOv5',
            'accuracy': best_accuracy,
            'is_active': True,
            'last_update': all_trainings[-1]['date'] if all_trainings else '未学習'
        }
        
        # サマリー情報
        summary = {
            'total_trainings': len(all_trainings),
            'total_images': total_images,
            'best_accuracy': best_accuracy,
            'total_annotations': get_total_annotations()
        }
        
        # 最近の学習（最新5件）- 新しい順に並べ替え
        recent_trainings = all_trainings[-5:][::-1] if all_trainings else []
        
        # 改善の推奨事項
        recommendations = []
        
        if best_accuracy < 0.5:
            recommendations.append({
                'type': 'warning',
                'icon': 'exclamation-triangle',
                'message': '精度が低いです。より多くの学習データを追加することを推奨します。'
            })
        
        if total_images < 100:
            recommendations.append({
                'type': 'info',
                'icon': 'info-circle',
                'message': f'現在の学習画像数は{total_images}枚です。100枚以上を推奨します。'
            })
        
        # 最新の学習で過学習をチェック
        if len(all_trainings) > 0:
            latest = all_trainings[-1]
            if latest['final_accuracy'] < latest['accuracy'] * 0.8:
                recommendations.append({
                    'type': 'warning',
                    'icon': 'chart-line',
                    'message': '最新の学習で過学習の兆候があります。エポック数を調整してください。'
                })
        
        return render_template('learning_dashboard.html',
                             summary=summary,
                             current_model=current_model,
                             recent_trainings=recent_trainings,
                             recommendations=recommendations)
        
    except Exception as e:
        print(f"ダッシュボード表示エラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return render_template('learning_dashboard.html',
                             summary={'total_trainings': 0, 'total_images': 0, 'best_accuracy': 0, 'total_annotations': 0},
                             current_model={'type': 'YOLOv5', 'accuracy': 0, 'is_active': False, 'last_update': '未学習'},
                             recent_trainings=[],
                             recommendations=[{'type': 'info', 'icon': 'info-circle', 'message': 'データの読み込みに失敗しました。'}])

def get_dataset_info():
    """データセット情報を取得"""
    from config import TRAINING_IMAGES_DIR, METADATA_FILE
    import os
    
    # メタデータを読み込み
    metadata = {}
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        except:
            pass
    
    male_count = 0
    female_count = 0
    unknown_count = 0
    total_count = 0
    
    if os.path.exists(TRAINING_IMAGES_DIR):
        for filename in os.listdir(TRAINING_IMAGES_DIR):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                total_count += 1
                
                # メタデータから性別情報を取得
                image_info = metadata.get(filename, {})
                gender = image_info.get('gender', 'unknown')
                
                if gender == 'male':
                    male_count += 1
                elif gender == 'female':
                    female_count += 1
                else:
                    unknown_count += 1
    
    return {
        'male': male_count,
        'female': female_count,
        'unknown': unknown_count,
        'total': total_count
    }

@learning_bp.route('/learning-history')
def get_learning_history():
    """学習履歴を取得"""
    try:
        # YOLOv5の学習履歴を取得
        train_dir = 'yolov5/runs/train'
        history = []
        
        if os.path.exists(train_dir):
            for exp_dir in os.listdir(train_dir):
                if not exp_dir.startswith('exp'):
                    continue
                    
                exp_path = os.path.join(train_dir, exp_dir)
                results_csv = os.path.join(exp_path, 'results.csv')
                
                if os.path.exists(results_csv):
                    # 実験の情報を収集
                    created_time = os.path.getctime(exp_path)
                    modified_time = os.path.getmtime(results_csv)
                    
                    # CSVから最終エポックの情報を取得
                    try:
                        with open(results_csv, 'r') as f:
                            lines = f.readlines()
                            if len(lines) > 1:
                                # 最終行から精度を取得
                                last_line = lines[-1].strip()
                                if last_line:
                                    parts = last_line.split(',')
                                    # mAP@0.5の位置を確認（通常は7番目のカラム）
                                    map50 = float(parts[6]) if len(parts) > 6 else 0
                                else:
                                    map50 = 0
                            else:
                                map50 = 0
                    except:
                        map50 = 0
                    
                    history.append({
                        'id': exp_dir,
                        'name': f'実験 {exp_dir}',
                        'created_at': datetime.fromtimestamp(created_time).isoformat(),
                        'updated_at': datetime.fromtimestamp(modified_time).isoformat(),
                        'status': 'completed',
                        'accuracy': map50,
                        'model_path': os.path.join(exp_path, 'weights/best.pt')
                    })
        
        # 新しい順にソート
        history.sort(key=lambda x: x['updated_at'], reverse=True)
        
        return jsonify({
            'success': True,
            'history': history[:10]  # 最新10件まで
        })
        
    except Exception as e:
        current_app.logger.error(f'学習履歴取得エラー: {str(e)}')
        return jsonify({
            'success': False,
            'history': [],
            'error': str(e)
        }), 500

def get_total_annotations():
    """総アノテーション数を取得（修正版）"""
    from config import TRAINING_LABELS_DIR, YOLO_DATASET_DIR
    import os
    
    total_annotations = 0
    
    # 学習ラベルディレクトリ
    if os.path.exists(TRAINING_LABELS_DIR):
        for txt_file in os.listdir(TRAINING_LABELS_DIR):
            if txt_file.endswith('.txt'):
                file_path = os.path.join(TRAINING_LABELS_DIR, txt_file)
                try:
                    with open(file_path, 'r') as f:
                        content = f.read().strip()
                        if content:
                            lines = content.split('\n')
                            total_annotations += len([line for line in lines if line.strip()])
                except:
                    pass
    
    # YOLOデータセットのラベルファイルもカウント（重複を避けるため別途カウント）
    yolo_label_dirs = [
        os.path.join(YOLO_DATASET_DIR, 'labels/train'),
        os.path.join(YOLO_DATASET_DIR, 'labels/val')
    ]
    
    yolo_annotations = 0
    for label_dir in yolo_label_dirs:
        if os.path.exists(label_dir):
            for txt_file in os.listdir(label_dir):
                if txt_file.endswith('.txt'):
                    file_path = os.path.join(label_dir, txt_file)
                    try:
                        with open(file_path, 'r') as f:
                            content = f.read().strip()
                            if content:
                                lines = content.split('\n')
                                yolo_annotations += len([line for line in lines if line.strip()])
                    except:
                        pass
    
    # より大きい値を返す（重複を避けるため）
    return max(total_annotations, yolo_annotations)

@learning_bp.route('/train-all', methods=['POST'])
def train_all_models():
    """YOLOとRandomForestの統合学習を実行"""
    from app import app, processing_queue
    import uuid
    
    try:
        # データセットの確認
        from config import TRAINING_IMAGES_DIR, METADATA_FILE
        import os
        import json
        
        # メタデータ読み込み
        metadata = {}
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        
        # 画像数の確認
        male_count = 0
        female_count = 0
        total_count = 0
        
        if os.path.exists(TRAINING_IMAGES_DIR):
            for filename in os.listdir(TRAINING_IMAGES_DIR):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    total_count += 1
                    image_info = metadata.get(filename, {})
                    gender = image_info.get('gender', 'unknown')
                    
                    if gender == 'male':
                        male_count += 1
                    elif gender == 'female':
                        female_count += 1
        
        # 最低要件チェック
        if total_count < 4:
            return jsonify({
                "error": f"学習には最低4枚の画像が必要です（現在: {total_count}枚）"
            }), 400
        
        if male_count == 0 or female_count == 0:
            return jsonify({
                "error": f"オスとメスの両方の画像が必要です（オス: {male_count}枚, メス: {female_count}枚）"
            }), 400
        
        # タスクIDの生成
        task_id = str(uuid.uuid4())
        
        # タスクをキューに追加
        task = {
            'id': task_id,
            'type': 'unified_training',
            'dataset_dir': TRAINING_IMAGES_DIR,
            'phases': ['feature_extraction', 'model_training', 'basic_evaluation']
        }
        
        processing_queue.put(task)
        
        current_app.logger.info(f"統合学習タスク開始: {task_id}")
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "message": "統合学習を開始しました",
            "dataset_info": {
                "male_count": male_count,
                "female_count": female_count,
                "total_count": total_count
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"統合学習開始エラー: {str(e)}")
        return jsonify({"error": str(e)}), 500


@learning_bp.route('/quick-train', methods=['POST'])
def quick_train_rf():
    """RandomForestモデルのみ素早く学習（YOLOは既存のものを使用）"""
    from app import app, processing_queue
    from core.analyzer import UnifiedAnalyzer
    import uuid
    
    try:
        # 簡易学習の実行
        analyzer = UnifiedAnalyzer()
        task_id = str(uuid.uuid4())
        
        # 直接学習を実行（非同期処理をスキップ）
        success = analyzer.train_model(None, task_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "RandomForestモデルの学習が完了しました",
                "task_id": task_id
            })
        else:
            return jsonify({
                "error": "モデル学習に失敗しました。学習データを確認してください。"
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"クイック学習エラー: {str(e)}")
        return jsonify({"error": str(e)}), 500