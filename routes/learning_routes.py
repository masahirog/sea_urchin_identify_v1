"""
ウニ生殖乳頭分析システム - 学習管理ルート
学習データ作成からモデル評価まで統合した機能を提供する
"""

from flask import Blueprint, request, jsonify, render_template, send_from_directory, current_app
from werkzeug.utils import secure_filename
import os
import json
import uuid
import traceback
import base64
from datetime import datetime

learning_bp = Blueprint('learning', __name__)


@learning_bp.route('/management')
def management_page():
    """学習管理統合ページを表示"""
    return render_template('learning_management.html')


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


@learning_bp.route('/upload-data', methods=['POST'])
def upload_learning_data():
    """
    学習データ用の画像をアップロード
    
    Request:
    - images: アップロードする画像ファイル（複数可）
    - gender: 性別カテゴリ ('male', 'female', 'unknown')
    
    Returns:
    - JSON: アップロード結果
    """
    from app import app
    from utils.file_handlers import allowed_file, is_image_file
    from config import STATIC_SAMPLES_DIR
    
    if 'images' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
    
    files = request.files.getlist('images')
    gender = request.form.get('gender', 'unknown')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    uploaded_files = []
    errors = []
    
    # 保存先ディレクトリの決定
    if gender in ['male', 'female']:
        target_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', gender)
    else:
        target_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'unknown')
    
    # ディレクトリが存在しない場合は作成
    os.makedirs(target_dir, exist_ok=True)
    
    for file in files:
        if file and file.filename != '':
            if allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
                try:
                    # 安全なファイル名に変換
                    filename = secure_filename(file.filename)
                    
                    # 同名ファイルが既に存在する場合はユニークな名前に変更
                    target_path = os.path.join(target_dir, filename)
                    if os.path.exists(target_path):
                        name, ext = os.path.splitext(filename)
                        unique_suffix = uuid.uuid4().hex[:8]
                        filename = f"{name}_{unique_suffix}{ext}"
                        target_path = os.path.join(target_dir, filename)
                    
                    # ファイルを保存
                    file.save(target_path)
                    uploaded_files.append({
                        'filename': filename,
                        'path': f'papillae/{gender}/{filename}',
                        'gender': gender
                    })
                    current_app.logger.info(f"学習データアップロード: {gender}/{filename}")
                    
                except Exception as e:
                    current_app.logger.error(f"ファイル保存エラー {file.filename}: {str(e)}")
                    errors.append(f"{file.filename}: {str(e)}")
            else:
                errors.append(f"{file.filename}: 無効なファイル形式です")
    
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
    else:
        result["message"] = "アップロードに失敗しました"
        
    return jsonify(result)


@learning_bp.route('/dataset-stats')
def get_dataset_stats():
    """
    学習データセットの統計情報を取得
    
    Returns:
    - JSON: データセット統計情報
    """
    from config import STATIC_SAMPLES_DIR
    
    try:
        # 各カテゴリのディレクトリパス
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


@learning_bp.route('/start-training', methods=['POST'])
def start_model_training():
    """
    モデル訓練を開始
    
    Returns:
    - JSON: 訓練タスクの情報
    """
    import uuid
    from app import processing_queue, processing_status, app
    
    try:
        # データセット統計を確認
        stats_response = get_dataset_stats()
        stats_data = stats_response.get_json()
        
        if stats_data.get('male_count', 0) == 0 or stats_data.get('female_count', 0) == 0:
            return jsonify({
                "error": "オスとメスの両方の学習データが必要です。データをアップロードしてください。"
            }), 400
        
        total_count = stats_data.get('total_count', 0)
        if total_count < 10:
            return jsonify({
                "error": f"学習データが不足しています。最低10枚必要ですが、現在{total_count}枚です。"
            }), 400
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        task = {
            "type": "train_model",
            "id": task_id,
            "dataset_dir": app.config['DATASET_FOLDER']
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "モデル訓練を待機中...",
            "progress": 0
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"モデル訓練開始: {task_id}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "モデル訓練を開始しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"モデル訓練開始エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"モデル訓練の開始に失敗しました: {str(e)}"}), 500


@learning_bp.route('/start-evaluation', methods=['POST'])
def start_model_evaluation():
    """
    モデル評価を開始
    
    Returns:
    - JSON: 評価タスクの情報
    """
    import uuid
    from app import processing_queue, processing_status, app
    from config import MODELS_DIR
    
    try:
        # モデルファイルの確認
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        if not os.path.exists(model_path):
            return jsonify({
                "error": "評価するモデルが見つかりません。先にモデル訓練を実行してください。"
            }), 404
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        task = {
            "type": "evaluate_model",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": app.config['DATASET_FOLDER']
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "モデル評価を待機中...",
            "progress": 0
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"モデル評価開始: {task_id}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "モデル評価を開始しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"モデル評価開始エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"モデル評価の開始に失敗しました: {str(e)}"}), 500


@learning_bp.route('/start-annotation-analysis', methods=['POST'])
def start_annotation_analysis():
    """
    アノテーション効果分析を開始
    
    Returns:
    - JSON: 分析タスクの情報
    """
    import uuid
    from app import processing_queue, processing_status, app
    from config import MODELS_DIR
    
    try:
        # モデルファイルの確認
        model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
        if not os.path.exists(model_path):
            return jsonify({
                "error": "分析するモデルが見つかりません。先にモデル訓練を実行してください。"
            }), 404
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        task = {
            "type": "analyze_annotation",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": app.config['DATASET_FOLDER']
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "アノテーション効果分析を待機中...",
            "progress": 0
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"アノテーション効果分析開始: {task_id}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "アノテーション効果分析を開始しました"
        })
        
    except Exception as e:
        current_app.logger.error(f"アノテーション効果分析開始エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"アノテーション効果分析の開始に失敗しました: {str(e)}"}), 500


@learning_bp.route('/learning-history')
def get_learning_history():
    """
    学習・評価履歴を取得
    
    Returns:
    - JSON: 学習・評価履歴
    """
    try:
        from utils.model_evaluation import get_model_evaluation_history
        from config import EVALUATION_DATA_DIR
        
        # 評価履歴を取得
        evaluation_history = get_model_evaluation_history(EVALUATION_DATA_DIR)
        
        # 学習履歴も含める（将来の拡張用）
        combined_history = []
        
        # 評価履歴を追加
        for item in evaluation_history:
            combined_history.append({
                "id": item.get("timestamp"),
                "type": item.get("type", "evaluation"),
                "timestamp": item.get("timestamp"),
                "date": format_timestamp_to_date(item.get("timestamp")),
                "accuracy": item.get("cv_mean", 0),
                "details": item
            })
        
        # 日付でソート（新しい順）
        combined_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return jsonify({
            "history": combined_history,
            "count": len(combined_history)
        })
        
    except Exception as e:
        current_app.logger.error(f"学習履歴取得エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "学習履歴の取得に失敗しました"}), 500


def format_timestamp_to_date(timestamp):
    """
    タイムスタンプを読みやすい日付形式に変換
    
    Parameters:
    - timestamp: YYYYMMdd_HHmmss形式のタイムスタンプ
    
    Returns:
    - str: フォーマットされた日付文字列
    """
    if not timestamp or len(timestamp) < 15:
        return 'Invalid date'
    
    try:
        year = timestamp[0:4]
        month = timestamp[4:6]
        day = timestamp[6:8]
        hour = timestamp[9:11]
        minute = timestamp[11:13]
        second = timestamp[13:15]
        
        date = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second))
        return date.strftime("%Y年%m月%d日 %H:%M:%S")
    except Exception:
        return timestamp


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