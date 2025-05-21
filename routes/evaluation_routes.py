"""
モデル評価ダッシュボード関連のルート
"""

import os
import uuid
import json
from flask import Blueprint, render_template, jsonify, request, send_from_directory
from utils.model_evaluation import evaluate_model, analyze_annotation_impact, get_model_evaluation_history

evaluation_bp = Blueprint('evaluation', __name__)

@evaluation_bp.route('/')
def index():
    """モデル評価ダッシュボードのメイン画面"""
    return render_template('model_evaluation.html')

@evaluation_bp.route('/run_evaluation', methods=['POST'])
def run_model_evaluation():
    """モデル評価を実行"""
    from app import app, processing_queue, processing_status
    
    try:
        print("モデル評価実行リクエスト受信")
        
        # モデルとデータセットのパスを確認
        model_path = os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl")
        dataset_dir = app.config['DATASET_FOLDER']
        
        print(f"モデルパス: {model_path} (存在: {os.path.exists(model_path)})")
        print(f"データセットディレクトリ: {dataset_dir} (存在: {os.path.exists(dataset_dir)})")
        
        # データセット内のファイル数を確認
        try:
            male_dir = os.path.join(dataset_dir, "male")
            female_dir = os.path.join(dataset_dir, "female")
            
            male_files = os.listdir(male_dir) if os.path.exists(male_dir) else []
            female_files = os.listdir(female_dir) if os.path.exists(female_dir) else []
            
            male_images = [f for f in male_files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            female_images = [f for f in female_files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            print(f"データセット内のファイル - オス: {len(male_images)}件, メス: {len(female_images)}件")
        except Exception as e:
            print(f"データセット確認エラー: {str(e)}")
        
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        
        task = {
            "type": "evaluate_model",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": dataset_dir
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {"status": "queued", "message": "モデル評価を待機中..."}
        
        # キューに追加
        processing_queue.put(task)
        
        print(f"評価タスクをキューに追加: {task_id}")
        
        return jsonify({"success": True, "task_id": task_id, "message": "モデル評価を開始しました"})
    except Exception as e:
        import traceback
        error_msg = f"評価実行リクエスト処理エラー: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

@evaluation_bp.route('/analyze-annotation-impact', methods=['POST'])
def analyze_annotation_impact_route():
    """アノテーション影響分析を実行"""
    from app import app, processing_queue, processing_status
    
    try:
        # 処理タスクの作成
        task_id = str(uuid.uuid4())
        model_path = os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl")
        dataset_dir = app.config['DATASET_FOLDER']
        
        task = {
            "type": "analyze_annotation",
            "id": task_id,
            "model_path": model_path,
            "dataset_dir": dataset_dir
        }
        
        # 処理状態の初期化
        processing_status[task_id] = {"status": "queued", "message": "アノテーション影響分析を待機中..."}
        
        # キューに追加
        processing_queue.put(task)
        
        return jsonify({"success": True, "task_id": task_id, "message": "アノテーション影響分析を開始しました"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"アノテーション分析実行エラー: {str(e)}"}), 500

@evaluation_bp.route('/history')
def get_evaluation_history():
    """評価履歴を取得"""
    from app import app
    
    try:
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        history = get_model_evaluation_history(evaluation_dir)
        return jsonify({"history": history})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"履歴取得エラー: {str(e)}"}), 500

@evaluation_bp.route('/get-latest-result')
def get_latest_evaluation_result():
    """最新の評価結果を取得"""
    from app import app
    
    try:
        evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
        history = get_model_evaluation_history(evaluation_dir)
        
        if not history:
            print("評価履歴がありません")
            return jsonify({"error": "評価履歴がありません"}), 404
        
        # 最新の評価結果
        latest = history[0]
        print(f"最新の評価結果: {latest['timestamp']}, タイプ: {latest.get('type', 'unknown')}")
        
        # 詳細結果の読み込み
        details = {}
        if latest.get('type') == 'evaluation':
            # 評価ファイルの読み込み
            try:
                eval_path = os.path.join(evaluation_dir, f"eval_{latest['timestamp']}.json")
                if os.path.exists(eval_path):
                    with open(eval_path, 'r') as f:
                        details = json.load(f)
                    print(f"評価詳細を読み込みました: {eval_path}")
                else:
                    print(f"評価ファイルが見つかりません: {eval_path}")
            except Exception as e:
                print(f"評価詳細読み込みエラー: {str(e)}")
        else:
            # アノテーション影響ファイルの読み込み
            try:
                anno_path = os.path.join(evaluation_dir, f"annotation_impact_{latest['timestamp']}.json")
                if os.path.exists(anno_path):
                    with open(anno_path, 'r') as f:
                        details = json.load(f)
                    # CV平均値を追加（フロントエンド互換性のため）
                    dataset = details.get('dataset', {})
                    details['cv_mean'] = dataset.get('annotation_rate', 0)
                    details['cv_std'] = 0
                    details['classification_report'] = {
                        "male": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('male_total', 0)},
                        "female": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('female_total', 0)},
                        "weighted avg": {"precision": 0, "recall": 0, "f1_score": 0, "support": dataset.get('male_total', 0) + dataset.get('female_total', 0)}
                    }
                    print(f"アノテーション詳細を読み込みました: {anno_path}")
                else:
                    print(f"アノテーションファイルが見つかりません: {anno_path}")
            except Exception as e:
                print(f"アノテーション詳細読み込みエラー: {str(e)}")
        
        return jsonify({"summary": latest, "details": details})
    except Exception as e:
        import traceback
        error_msg = f"最新評価結果取得エラー: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

@evaluation_bp.route('/static/evaluation/<path:filename>')
def evaluation_static(filename):
    """評価結果の静的ファイルを提供"""
    from app import app
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    print(f"静的ファイル要求: {filename}, ディレクトリ: {evaluation_dir}")
    
    # ファイルの存在確認
    full_path = os.path.join(evaluation_dir, filename)
    if os.path.exists(full_path):
        print(f"ファイルが見つかりました: {full_path}")
    else:
        print(f"ファイルが見つかりません: {full_path}")
    
    return send_from_directory(evaluation_dir, filename)

@evaluation_bp.route('/debug-directory')
def debug_directory():
    """評価ディレクトリの内容を確認"""
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
            "created": os.path.getctime(file_path)
        })
    
    return jsonify({
        "directory": evaluation_dir,
        "exists": True,
        "files": file_info
    })