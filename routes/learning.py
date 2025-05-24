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
from utils.file_handlers import handle_multiple_image_upload


learning_bp = Blueprint('learning', __name__)

# ================================
# ページルート
# ================================

@learning_bp.route('/')
def learning_page():
    """統合学習システムのメインページ"""
    return render_template('learning_management.html')

# ================================
# データ管理API
# ================================

@learning_bp.route('/upload-data', methods=['POST'])
def upload_learning_data():
    """学習データ用の画像をアップロード（改良版）"""
    from app import app
    from config import STATIC_SAMPLES_DIR
    
    if 'images' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
    
    files = request.files.getlist('images')
    gender = request.form.get('gender', 'unknown')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    # 保存先ディレクトリの決定
    if gender in ['male', 'female']:
        target_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', gender)
    else:
        target_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'unknown')
    
    # 共通関数を使用
    uploaded_files, errors = handle_multiple_image_upload(
        files, 
        target_dir, 
        app.config.get('ALLOWED_EXTENSIONS')
    )
    
    # パスの調整（gender情報を追加）
    for file_info in uploaded_files:
        file_info['gender'] = gender
        file_info['path'] = f'papillae/{gender}/{file_info["filename"]}'
    
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
        current_app.logger.info(f"学習データアップロード: {len(uploaded_files)}ファイル ({gender})")
    else:
        result["message"] = "アップロードに失敗しました"
        
    return jsonify(result)

@learning_bp.route('/dataset-stats')
def get_dataset_stats():
    """
    学習データセットの統計情報を取得（修正版）
    
    Returns:
    - JSON: データセット統計情報
    """
    from config import STATIC_SAMPLES_DIR  # 修正: 正しいディレクトリを使用
    
    try:
        # 各カテゴリのディレクトリパス（修正版）
        male_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'male')
        female_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'female')
        unknown_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'unknown')
        
        # 画像ファイル数をカウント
        male_count = len([f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
        female_count = len([f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
        unknown_count = len([f for f in os.listdir(unknown_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(unknown_dir) else 0
        
        # 合計カウント
        total_count = male_count + female_count + unknown_count
        
        # アノテーション情報の取得
        annotation_count = 0
        annotation_file = os.path.join('static', 'annotation_mapping.json')
        if os.path.exists(annotation_file):
            try:
                with open(annotation_file, 'r') as f:
                    annotations = json.load(f)
                    annotation_count = len(annotations)
            except Exception as e:
                current_app.logger.error(f"アノテーション情報読み込みエラー: {str(e)}")
        
        # 比率計算
        male_ratio = (male_count / total_count * 100) if total_count > 0 else 0
        female_ratio = (female_count / total_count * 100) if total_count > 0 else 0
        annotation_ratio = (annotation_count / total_count * 100) if total_count > 0 else 0
        
        # デバッグログ追加
        current_app.logger.info(f"データセット統計: オス={male_count}, メス={female_count}, 合計={total_count}")
        
        return jsonify({
            "male_count": male_count,
            "female_count": female_count,
            "unknown_count": unknown_count,
            "total_count": total_count,
            "annotation_count": annotation_count,
            "ratios": {
                "male": male_ratio,
                "female": female_ratio,
                "annotation": annotation_ratio
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"データセット統計取得エラー: {str(e)}")
        return jsonify({"error": "統計情報の取得に失敗しました"}), 500


@learning_bp.route('/learning-data')
def get_learning_data():
    """
    学習データ一覧を取得
    
    Parameters:
    - gender: フィルタリングする性別 (オプション)
    
    Returns:
    - JSON: 学習データ一覧
    """
    from config import STATIC_SAMPLES_DIR
    
    try:
        gender_filter = request.args.get('gender', 'all')
        
        # サンプルディレクトリ
        samples_base_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae')
        
        result = {
            'male': [],
            'female': [],
            'unknown': []
        }
        
        # 各性別フォルダを検索
        for category in ['male', 'female', 'unknown']:
            if gender_filter != 'all' and gender_filter != category:
                continue
                
            category_dir = os.path.join(samples_base_dir, category)
            if not os.path.exists(category_dir):
                continue
                
            # 画像ファイルをリストアップ
            for filename in os.listdir(category_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    # アノテーション情報を確認
                    rel_path = f"papillae/{category}/{filename}"
                    
                    # アノテーション状態を確認
                    has_annotation = False
                    annotation_path = None
                    
                    mapping_file = os.path.join('static', 'annotation_mapping.json')
                    if os.path.exists(mapping_file):
                        try:
                            with open(mapping_file, 'r') as f:
                                mapping = json.load(f)
                                if rel_path in mapping:
                                    has_annotation = True
                                    annotation_path = mapping[rel_path]
                        except Exception:
                            pass
                    
                    # 画像情報を追加
                    sample_info = {
                        'filename': filename,
                        'path': rel_path,
                        'url': f"/sample/{rel_path}",
                        'has_annotation': has_annotation,
                        'category': category
                    }
                    
                    if has_annotation:
                        sample_info['annotation_path'] = annotation_path
                    
                    result[category].append(sample_info)
        
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
    """
    学習データを削除
    
    Request:
    - path: 削除する画像のパス
    
    Returns:
    - JSON: 削除結果
    """
    from config import STATIC_SAMPLES_DIR
    
    try:
        data = request.json
        if not data or 'path' not in data:
            return jsonify({"error": "削除する画像のパスが指定されていません"}), 400
        
        image_path = data['path']
        
        # パスの検証
        if '..' in image_path or not image_path.startswith('papillae/'):
            return jsonify({"error": "不正なパスです"}), 400
        
        # フルパスの構築
        full_path = os.path.join(STATIC_SAMPLES_DIR, image_path)
        
        if not os.path.exists(full_path):
            return jsonify({"error": "指定された画像が見つかりません"}), 404
        
        # 画像の削除
        os.remove(full_path)
        
        # アノテーションマッピングからも削除
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        if os.path.exists(mapping_file):
            try:
                with open(mapping_file, 'r') as f:
                    mapping = json.load(f)
                
                if image_path in mapping:
                    # アノテーション画像も削除
                    annotation_path = os.path.join('static', mapping[image_path])
                    if os.path.exists(annotation_path):
                        os.remove(annotation_path)
                    
                    # マッピングから削除
                    del mapping[image_path]
                    
                    with open(mapping_file, 'w') as f:
                        json.dump(mapping, f, indent=2)
                
            except Exception as e:
                current_app.logger.error(f"アノテーション削除エラー: {str(e)}")
        
        current_app.logger.info(f"学習データ削除: {image_path}")
        
        return jsonify({
            "success": True,
            "message": "画像を削除しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"学習データ削除エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"画像の削除に失敗しました: {str(e)}"}), 500

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
        
        # アノテーション保存ディレクトリ
        from config import STATIC_ANNOTATIONS_DIR
        os.makedirs(STATIC_ANNOTATIONS_DIR, exist_ok=True)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        save_path = os.path.join(STATIC_ANNOTATIONS_DIR, new_filename)
        if os.path.exists(save_path):
            unique_suffix = uuid.uuid4().hex[:8]
            new_filename = f"{basename}_annotation_{unique_suffix}{ext}"
            save_path = os.path.join(STATIC_ANNOTATIONS_DIR, new_filename)
        
        # 画像の保存
        with open(save_path, 'wb') as f:
            f.write(image_bytes)
        
        # アノテーションマッピングファイルの更新
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
        relative_annotation_path = f"images/annotations/{new_filename}"
        mapping[original_path] = relative_annotation_path
        
        # マッピングファイルを更新
        with open(annotation_mapping_file, 'w') as f:
            json.dump(mapping, f, indent=2)
        
        current_app.logger.info(f"アノテーション保存完了: {new_filename}")
        
        return jsonify({
            "success": True, 
            "message": "アノテーションを保存しました",
            "annotation_path": save_path,
            "filename": new_filename,
            "mapping_updated": True
        })
        
    except Exception as e:
        current_app.logger.error(f"アノテーション保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"アノテーションの保存中にエラーが発生しました: {str(e)}"}), 500

# ================================
# 学習・評価実行
# ================================

@learning_bp.route('/start-unified-training', methods=['POST'])
def start_unified_training():
    """
    統合学習プロセスを開始
    データ検証 → モデル訓練 → 基本評価 → 詳細分析を一括実行
    
    Returns:
    - JSON: 統合処理タスクの情報
    """
    import uuid
    from app import processing_queue, processing_status, app
    
    try:
        # 1. データセット検証（修正版）
        validation_result = validate_dataset_for_training_fixed()
        if not validation_result['valid']:
            return jsonify({
                "error": validation_result['message'],
                "suggestions": validation_result.get('suggestions', [])
            }), 400
        
        # 2. 統合処理タスクの作成
        task_id = str(uuid.uuid4())
        unified_task = {
            "type": "unified_training",
            "id": task_id,
            "dataset_dir": app.config['DATASET_FOLDER'],
            "phases": [
                "feature_extraction",
                "model_training", 
                "basic_evaluation",
                "detailed_analysis",
                "annotation_impact"
            ],
            "dataset_stats": validation_result['stats']
        }
        
        # 3. 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued",
            "message": "統合学習プロセスを準備中...",
            "progress": 0,
            "current_phase": "preparation",
            "phases_completed": [],
            "dataset_stats": validation_result['stats']
        }
        
        # 4. キューに追加
        processing_queue.put(unified_task)
        
        current_app.logger.info(f"統合学習開始: {task_id}")
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "message": "統合学習プロセスを開始しました",
            "estimated_duration": estimate_training_duration(validation_result['stats']),
            "phases": unified_task["phases"]
        })
        
    except Exception as e:
        current_app.logger.error(f"統合学習開始エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"統合学習の開始に失敗しました: {str(e)}"}), 500


def validate_dataset_for_training_fixed():
    """
    訓練用データセットの検証（修正版）
    
    Returns:
    - dict: 検証結果
    """
    try:
        # データセット統計取得（修正版）
        stats_response = get_dataset_stats()
        stats_data = stats_response.get_json()
        
        # 修正: より緩い検証ルール
        validation_rules = [
            {
                "condition": stats_data.get('male_count', 0) >= 1,  # 1枚以上に緩和
                "message": "オス画像が最低1枚必要です",
                "current": stats_data.get('male_count', 0),
                "required": 1,
                "suggestion": "オスのウニ生殖乳頭画像をアップロードしてください"
            },
            {
                "condition": stats_data.get('female_count', 0) >= 1,  # 1枚以上に緩和
                "message": "メス画像が最低1枚必要です",
                "current": stats_data.get('female_count', 0),
                "required": 1,
                "suggestion": "メスのウニ生殖乳頭画像をアップロードしてください"
            },
            {
                "condition": stats_data.get('total_count', 0) >= 2,  # 2枚以上に緩和
                "message": "合計画像数が最低2枚必要です",
                "current": stats_data.get('total_count', 0),
                "required": 2,
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


@learning_bp.route('/unified-status/<task_id>')
def get_unified_status(task_id):
    """
    統合学習プロセスの詳細ステータスを取得
    
    Parameters:
    - task_id: 統合処理タスクのID
    
    Returns:
    - JSON: 詳細なステータス情報
    """
    from app import processing_status
    
    try:
        if task_id not in processing_status:
            return jsonify({"error": "指定されたタスクが見つかりません"}), 404
        
        status = processing_status[task_id]
        
        # 統合プロセス専用の追加情報
        enhanced_status = {
            **status,
            "phase_details": get_phase_details(status),
            "estimated_remaining": estimate_remaining_time(status),
            "next_phase": get_next_phase(status),
            "completion_percentage": calculate_completion_percentage(status)
        }
        
        return jsonify(enhanced_status)
        
    except Exception as e:
        current_app.logger.error(f"統合ステータス取得エラー: {str(e)}")
        return jsonify({"error": "ステータス取得に失敗しました"}), 500

# ================================
# 評価履歴 (旧api_routes.pyから統合)
# ================================

@learning_bp.route('/learning-history')
def get_learning_history():
    """
    学習・評価履歴を取得（修正版）
    
    Returns:
    - JSON: 学習・評価履歴
    """
    try:
        from core.evaluator import UnifiedEvaluator
        
        # デバッグログ追加
        current_app.logger.info("履歴データ取得開始")
        
        # 評価履歴を取得
        evaluator = UnifiedEvaluator()
        evaluation_history = evaluator.get_evaluation_history()
        
        # デバッグ出力
        current_app.logger.info(f"取得した履歴数: {len(evaluation_history)}")
        if evaluation_history:
            for i, item in enumerate(evaluation_history[:3]):  # 最初の3件だけログ出力
                current_app.logger.info(f"履歴{i}: タイプ={item.get('type', '不明')}, タイムスタンプ={item.get('timestamp', 'なし')}")
        
        # 学習履歴も含める（将来の拡張用）
        combined_history = []
        
        # 評価履歴を追加
        for item in evaluation_history:
            # 日付フォーマットの標準化（ISOフォーマットをYYYYMMDD_HHMMSSに変換）
            timestamp = item.get("timestamp", "")
            normalized_timestamp = timestamp
            
            # ISO形式の場合は変換
            if timestamp and 'T' in timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.split('.')[0])
                    normalized_timestamp = dt.strftime("%Y%m%d_%H%M%S")
                except:
                    pass
            
            # タイプを明示的に設定
            if 'type' not in item:
                if 'annotation' in str(item).lower():
                    item_type = 'annotation'
                else:
                    item_type = 'evaluation'
            else:
                item_type = item.get('type', 'evaluation')
            
            # 精度値の取得（cv_mean優先、なければaccuracy）
            if 'cv_mean' in item:
                accuracy = item['cv_mean']
            elif 'accuracy' in item:
                accuracy = item['accuracy']
            else:
                accuracy = 0
                
            combined_history.append({
                "id": normalized_timestamp,
                "type": item_type,
                "timestamp": normalized_timestamp,
                "date": format_timestamp_to_date(timestamp),
                "accuracy": accuracy,
                "details": item
            })
        
        # 日付でソート（新しい順）
        combined_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        current_app.logger.info(f"返却する履歴データ: {len(combined_history)}件")
        if combined_history:
            for i, item in enumerate(combined_history[:3]):  # 最初の3件だけログ出力
                current_app.logger.info(f"結果{i}: タイプ={item.get('type')}, タイムスタンプ={item.get('timestamp')}")
        
        return jsonify({
            "history": combined_history,
            "count": len(combined_history)
        })
        
    except Exception as e:
        current_app.logger.error(f"学習履歴取得エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "学習履歴の取得に失敗しました"}), 500

# ================================
# データセット準備度評価
# ================================

@learning_bp.route('/readiness-check')
def readiness_check():
    """
    学習開始の準備完了度をチェック
    
    Returns:
    - JSON: 準備完了状況と推奨アクション
    """
    try:
        # データセット統計取得
        stats_response = get_dataset_stats()
        stats_data = stats_response.get_json()
        
        # 準備完了度の計算
        readiness = calculate_readiness_score(stats_data)
        
        return jsonify({
            "readiness_score": readiness['score'],
            "readiness_percentage": readiness['percentage'],
            "status": readiness['status'],
            "message": readiness['message'],
            "requirements": readiness['requirements'],
            "suggestions": readiness['suggestions']
        })
        
    except Exception as e:
        current_app.logger.error(f"準備完了度チェックエラー: {str(e)}")
        return jsonify({"error": "準備完了度の確認に失敗しました"}), 500

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
    if total_count > 0:
        balance = min(male_count, female_count) / max(male_count, female_count, 1)
        base_accuracy += balance * 0.1
    
    # アノテーション率による補正
    annotation_count = stats_data.get('annotation_count', 0)
    if total_count > 0:
        annotation_rate = annotation_count / total_count
        base_accuracy += annotation_rate * 0.15
    
    return {
        "estimated_accuracy": min(0.95, base_accuracy),  # 最大95%
        "confidence_level": "medium" if total_count >= 20 else "low",
        "factors": {
            "data_quantity": total_count,
            "data_balance": balance if total_count > 0 else 0,
            "annotation_rate": annotation_rate if total_count > 0 else 0
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

def format_timestamp_to_date(timestamp):
    """
    タイムスタンプを読みやすい日付形式に変換（修正版）
    
    Parameters:
    - timestamp: タイムスタンプ文字列（複数形式対応）
    
    Returns:
    - str: フォーマットされた日付文字列
    """
    if not timestamp:
        return '日時不明'
    
    try:
        # ISO形式（2025-05-23T09:18:35.558600）の場合
        if 'T' in timestamp:
            dt = datetime.fromisoformat(timestamp.split('.')[0])
            return dt.strftime("%Y年%m月%d日 %H:%M:%S")
        
        # YYYYMMdd_HHMMSS形式の場合
        elif '_' in timestamp and len(timestamp) >= 15:
            year = timestamp[0:4]
            month = timestamp[4:6]
            day = timestamp[6:8]
            hour = timestamp[9:11]
            minute = timestamp[11:13]
            second = timestamp[13:15]
            
            date = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second))
            return date.strftime("%Y年%m月%d日 %H:%M:%S")
        
        # その他の形式
        else:
            return timestamp
    except Exception as e:
        current_app.logger.error(f"日付変換エラー: {timestamp} - {str(e)}")
        return timestamp


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