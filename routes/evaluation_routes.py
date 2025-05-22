"""
ウニ生殖乳頭分析システム - モデル評価ルート
モデル評価、検証、アノテーション分析機能を提供する
"""

import os
import uuid
import json
from flask import Blueprint, render_template, jsonify, request, send_from_directory, current_app
from utils.model_evaluation import evaluate_model, analyze_annotation_impact, get_model_evaluation_history

evaluation_bp = Blueprint('evaluation', __name__)


@evaluation_bp.route('/')
def index():
    """モデル評価ダッシュボードのメイン画面"""
    return render_template('model_evaluation.html')


@evaluation_bp.route('/run_evaluation', methods=['POST'])
def run_model_evaluation():
    """
    モデル評価を実行
    
    Returns:
    - JSON: 評価タスクの情報
    """
    from app import app, processing_queue, processing_status
    
    try:
        current_app.logger.info("モデル評価実行リクエスト受信")
        
        # モデルとデータセットのパスを確認
        model_path = os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl")
        dataset_dir = app.config['DATASET_FOLDER']
        
        # ファイルとディレクトリの存在確認
        if not os.path.exists(model_path):
            return jsonify({
                "error": "モデルファイルが見つかりません。先にモデルを訓練してください。"
            }), 404
            
        if not os.path.exists(dataset_dir):
            return jsonify({
                "error": "データセットディレクトリが見つかりません。"
            }), 404
        
        current_app.logger.info(f"モデルパス: {model_path} (存在: {os.path.exists(model_path)})")
        current_app.logger.info(f"データセットディレクトリ: {dataset_dir} (存在: {os.path.exists(dataset_dir)})")
        
        # データセット内のファイル数を確認
        try:
            male_dir = os.path.join(dataset_dir, "male")
            female_dir = os.path.join(dataset_dir, "female")
            
            male_files = os.listdir(male_dir) if os.path.exists(male_dir) else []
            female_files = os.listdir(female_dir) if os.path.exists(female_dir) else []
            
            male_images = [f for f in male_files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            female_images = [f for f in female_files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            if len(male_images) == 0 or len(female_images) == 0:
                return jsonify({
                    "error": "データセットが不十分です。オスとメスの両方のサンプルが必要です。"
                }), 400
                
            current_app.logger.info(f"データセット内のファイル - オス: {len(male_images)}件, メス: {len(female_images)}件")
        except Exception as e:
            current_app.logger.error(f"データセット確認エラー: {str(e)}")
            return jsonify({"error": f"データセット確認エラー: {str(e)}"}), 500
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        
        task = {
            "type": "evaluate_model",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": dataset_dir
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "モデル評価を待機中...",
            "progress": 0
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"評価タスクをキューに追加: {task_id}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "モデル評価を開始しました"
        })
    except Exception as e:
        import traceback
        error_msg = f"評価実行リクエスト処理エラー: {str(e)}"
        current_app.logger.error(error_msg)
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": error_msg}), 500


@evaluation_bp.route('/analyze-annotation-impact', methods=['POST'])
def analyze_annotation_impact_route():
    """
    アノテーション影響分析を実行
    
    Returns:
    - JSON: 分析タスクの情報
    """
    from app import app, processing_queue, processing_status
    import os
    import json
    
    try:
        current_app.logger.info("アノテーション影響分析実行リクエスト受信")
        
        # ★ 修正: モデルとデータセットのパスを正しく取得
        model_path = os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl")
        dataset_dir = app.config['DATASET_FOLDER']  # data/dataset を正しく取得
        
        current_app.logger.info(f"モデルパス: {model_path} (存在: {os.path.exists(model_path)})")
        current_app.logger.info(f"データセットディレクトリ: {dataset_dir} (存在: {os.path.exists(dataset_dir)})")
        
        # ファイルとディレクトリの存在確認
        if not os.path.exists(model_path):
            return jsonify({
                "error": "モデルファイルが見つかりません。先にモデルを訓練してください。"
            }), 404
            
        if not os.path.exists(dataset_dir):
            # ★ データセットディレクトリが存在しない場合は作成
            try:
                from config import ensure_directories
                ensure_directories()
                current_app.logger.info(f"データセットディレクトリを作成しました: {dataset_dir}")
            except Exception as e:
                current_app.logger.error(f"ディレクトリ作成エラー: {str(e)}")
                return jsonify({
                    "error": f"データセットディレクトリが見つからず、作成もできませんでした: {dataset_dir}"
                }), 404
        
        # アノテーションマッピングの整合性チェック（追加）
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        mapping_entries = 0
        
        if os.path.exists(mapping_file):
            try:
                with open(mapping_file, 'r') as f:
                    mapping = json.load(f)
                    mapping_entries = len(mapping)
                    
                # 画像ファイル数のカウント
                male_dir = os.path.join(dataset_dir, "male")
                female_dir = os.path.join(dataset_dir, "female")
                male_files = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
                female_files = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
                
                total_images = len(male_files) + len(female_files)
                
                # 警告ログ（不整合がある場合）
                if mapping_entries > total_images:
                    current_app.logger.warning(f"アノテーションマッピング ({mapping_entries}件) がデータセット画像数 ({total_images}件) を超えています。古いマッピングが残っている可能性があります。")
                
            except Exception as e:
                current_app.logger.error(f"マッピングファイル読み込みエラー: {str(e)}")
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        
        task = {
            "type": "analyze_annotation",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": dataset_dir
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {
            "status": "queued", 
            "message": "アノテーション影響分析を待機中...",
            "progress": 0
        }
        
        # キューに追加
        processing_queue.put(task)
        
        current_app.logger.info(f"アノテーション分析タスクをキューに追加: {task_id}")
        
        return jsonify({
            "success": True, 
            "task_id": task_id, 
            "message": "アノテーション影響分析を開始しました"
        })
    except Exception as e:
        import traceback
        error_msg = f"アノテーション分析実行エラー: {str(e)}"
        current_app.logger.error(error_msg)
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": error_msg}), 500


# 念のため、アンダースコア版も追加（どちらかが動作するように）
@evaluation_bp.route('/analyze_annotation_impact', methods=['POST'])
def analyze_annotation_impact_route_underscore():
    """
    アノテーション影響分析を実行（アンダースコア版）
    """
    return analyze_annotation_impact_route()
@evaluation_bp.route('/history')
def get_evaluation_history():
    """
    評価履歴を取得
    
    Returns:
    - JSON: 評価履歴一覧
    """
    from app import app
    
    try:
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        
        # ディレクトリの存在確認
        if not os.path.exists(evaluation_dir):
            os.makedirs(evaluation_dir, exist_ok=True)
            return jsonify({"history": []})
            
        history = get_model_evaluation_history(evaluation_dir)
        return jsonify({"history": history})
    except Exception as e:
        import traceback
        error_msg = f"履歴取得エラー: {str(e)}"
        current_app.logger.error(error_msg)
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": error_msg}), 500


@evaluation_bp.route('/get-latest-result')
def get_latest_evaluation_result():
    """
    最新の評価結果を取得
    
    Returns:
    - JSON: 最新の評価結果
    """
    from app import app
    
    try:
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        
        # ディレクトリの存在確認
        if not os.path.exists(evaluation_dir):
            os.makedirs(evaluation_dir, exist_ok=True)
            current_app.logger.warning("評価ディレクトリが存在しないため作成しました")
            return jsonify({"error": "評価履歴がありません"}), 404
        
        history = get_model_evaluation_history(evaluation_dir)
        current_app.logger.debug(f"履歴取得結果: {len(history)}件")
        
        if not history:
            current_app.logger.warning("評価履歴がありません")
            return jsonify({"error": "評価履歴がありません"}), 404
        
        # 最新の評価結果
        latest = history[0]
        current_app.logger.debug(f"最新の評価結果: {latest['timestamp']}, タイプ: {latest.get('type', 'unknown')}")
        
        # 詳細結果の読み込み
        details = {}
        if latest.get('type') == 'evaluation':
            # 評価ファイルの読み込み
            try:
                eval_path = os.path.join(evaluation_dir, f"eval_{latest['timestamp']}.json")
                if os.path.exists(eval_path):
                    with open(eval_path, 'r') as f:
                        details = json.load(f)
                    current_app.logger.debug(f"評価詳細を読み込みました: {eval_path}")
                else:
                    current_app.logger.warning(f"評価ファイルが見つかりません: {eval_path}")
            except Exception as e:
                current_app.logger.error(f"評価詳細読み込みエラー: {str(e)}")
        else:
            # アノテーション影響ファイルの読み込み
            try:
                anno_path = os.path.join(evaluation_dir, f"annotation_impact_{latest['timestamp']}.json")
                if os.path.exists(anno_path):
                    with open(anno_path, 'r') as f:
                        details = json.load(f)
                    # CV平均値などを追加（フロントエンド互換性のため）
                    dataset = details.get('dataset', {})
                    details['cv_mean'] = dataset.get('annotation_rate', 0)
                    details['cv_std'] = 0
                    details['classification_report'] = {
                        "male": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('male_total', 0)},
                        "female": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('female_total', 0)},
                        "weighted avg": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('male_total', 0) + dataset.get('female_total', 0)}
                    }
                    current_app.logger.debug(f"アノテーション詳細を読み込みました: {anno_path}")
                    current_app.logger.debug(f"返却データサンプル: {json.dumps(details, ensure_ascii=False)[:200]}...")
                else:
                    current_app.logger.warning(f"アノテーションファイルが見つかりません: {anno_path}")
            except Exception as e:
                current_app.logger.error(f"アノテーション詳細読み込みエラー: {str(e)}")
        
        response_data = {"summary": latest, "details": details}
        current_app.logger.debug(f"レスポンスデータ構造: summary={list(latest.keys())}, details={list(details.keys()) if details else 'なし'}")
        return jsonify(response_data)
    except Exception as e:
        import traceback
        error_msg = f"最新評価結果取得エラー: {str(e)}"
        current_app.logger.error(error_msg)
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": error_msg}), 500


@evaluation_bp.route('/static/evaluation/<path:filename>')
def evaluation_static(filename):
    """
    評価結果の静的ファイルを提供
    
    Parameters:
    - filename: 評価結果ファイルの名前
    
    Returns:
    - Response: 評価結果ファイル
    """
    from app import app
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    
    # パスの検証
    if '..' in filename or filename.startswith('/'):
        current_app.logger.warning(f"不正なパスへのアクセス試行: {filename}")
        return jsonify({"error": "不正なパスです"}), 400
        
    current_app.logger.debug(f"静的ファイル要求: {filename}, ディレクトリ: {evaluation_dir}")
    
    # ファイルの存在確認
    full_path = os.path.join(evaluation_dir, filename)
    if os.path.exists(full_path):
        current_app.logger.debug(f"ファイルが見つかりました: {full_path}")
        return send_from_directory(evaluation_dir, filename)
    else:
        current_app.logger.warning(f"ファイルが見つかりません: {full_path}")
        return jsonify({"error": "ファイルが見つかりません"}), 404


@evaluation_bp.route('/debug-directory')
def debug_directory():
    """
    評価ディレクトリの内容を確認（デバッグ用）
    
    Returns:
    - JSON: ディレクトリ内容
    """
    from app import app
    import os
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    
    # ディレクトリの存在確認
    if not os.path.exists(evaluation_dir):
        return jsonify({
            "error": f"ディレクトリが存在しません: {evaluation_dir}",
            "current_directory": os.getcwd()
        })
    
    # ディレクトリ内のファイル一覧を取得
    files = os.listdir(evaluation_dir)
    
    file_info = []
    for file in files:
        file_path = os.path.join(evaluation_dir, file)
        file_info.append({
            "name": file,
            "is_dir": os.path.isdir(file_path),
            "size": os.path.getsize(file_path) if os.path.isfile(file_path) else None,
            "created": os.path.getctime(file_path),
            "modified": os.path.getmtime(file_path)
        })
    
    return jsonify({
        "directory": evaluation_dir,
        "exists": True,
        "files": file_info,
        "count": len(files)
    })


@evaluation_bp.route('/get-specific-result/<timestamp>')
def get_specific_evaluation_result(timestamp):
    """
    特定のタイムスタンプの評価結果を取得
    
    Parameters:
    - timestamp: 評価結果のタイムスタンプ
    
    Returns:
    - JSON: 評価結果
    """
    from app import app
    
    try:
        if not timestamp or '..' in timestamp or '/' in timestamp:
            return jsonify({"error": "不正なタイムスタンプです"}), 400
            
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        
        # 評価ファイルのパス
        eval_path = os.path.join(evaluation_dir, f"eval_{timestamp}.json")
        anno_path = os.path.join(evaluation_dir, f"annotation_impact_{timestamp}.json")
        
        details = {}
        result_type = "unknown"
        
        # 評価ファイルの確認
        if os.path.exists(eval_path):
            with open(eval_path, 'r') as f:
                details = json.load(f)
            result_type = "evaluation"
        # アノテーション影響ファイルの確認
        elif os.path.exists(anno_path):
            with open(anno_path, 'r') as f:
                details = json.load(f)
            result_type = "annotation"
            
            # CV平均値を追加（フロントエンド互換性のため）
            dataset = details.get('dataset', {})
            details['cv_mean'] = dataset.get('annotation_rate', 0)
            details['cv_std'] = 0
        else:
            return jsonify({"error": "指定されたタイムスタンプの評価結果が見つかりません"}), 404
        
        # 結果のサマリーを作成
        summary = {
            "timestamp": timestamp,
            "type": result_type,
            "cv_mean": details.get('cv_mean', 0)
        }
        
        return jsonify({"summary": summary, "details": details})
    except Exception as e:
        import traceback
        error_msg = f"評価結果取得エラー: {str(e)}"
        current_app.logger.error(error_msg)
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": error_msg}), 500


@evaluation_bp.route('/reset-annotations', methods=['POST'])
def reset_annotations():
    """
    アノテーションデータをリセットする
    
    Request:
    - confirmation: 確認テキスト（"DELETE ANNOTATION"である必要がある）
    
    Returns:
    - JSON: リセット結果
    """
    from app import app
    import os
    import json
    import shutil
    
    try:
        # POSTデータの検証
        data = request.json
        confirmation = data.get('confirmation', '')
        
        if confirmation != "DELETE ANNOTATION":
            return jsonify({
                "success": False, 
                "message": "確認テキストが正しくありません。'DELETE ANNOTATION'と入力してください。"
            }), 400
        
        # 1. アノテーションマッピングのリセット
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        with open(mapping_file, 'w') as f:
            json.dump({}, f)
        
        # 2. アノテーション画像ディレクトリのクリア
        annotations_dir = os.path.join('static', 'annotations')
        if os.path.exists(annotations_dir):
            # ディレクトリ内のファイルのみを削除
            for filename in os.listdir(annotations_dir):
                file_path = os.path.join(annotations_dir, filename)
                if os.path.isfile(file_path):
                    os.unlink(file_path)
        else:
            # ディレクトリが存在しない場合は作成
            os.makedirs(annotations_dir, exist_ok=True)
        
        # 3. アノテーション関連の評価ファイルの削除
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        if os.path.exists(evaluation_dir):
            for filename in os.listdir(evaluation_dir):
                if filename.startswith('annotation_impact_'):
                    file_path = os.path.join(evaluation_dir, filename)
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
        
        current_app.logger.info("アノテーションデータのリセットが完了しました")
        
        return jsonify({
            "success": True, 
            "message": "アノテーションデータのリセットが完了しました"
        })
    except Exception as e:
        current_app.logger.error(f"アノテーションリセットエラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False, 
            "message": f"リセット中にエラーが発生しました: {str(e)}"
        }), 500