from flask import Blueprint, render_template, request, jsonify, send_from_directory
import os
import uuid
import json
from datetime import datetime

# モデル評価モジュールをインポート
from utils.model_evaluation import evaluate_model, get_model_evaluation_history, analyze_annotation_impact

evaluation_bp = Blueprint('evaluation', __name__)

@evaluation_bp.route('/')
def evaluation_dashboard():
    """モデル評価ダッシュボードページを表示"""
    return render_template('model_evaluation.html')

@evaluation_bp.route('/history')
def evaluation_history():
    """評価履歴を取得"""
    from app import app
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    history = get_model_evaluation_history(evaluation_dir)
    
    return jsonify({"history": history})

@evaluation_bp.route('/run_evaluation', methods=['POST'])
def run_model_evaluation():
    """モデル評価を実行"""
    from app import app, processing_queue, processing_status
    
    # 処理タスクの作成
    task_id = str(uuid.uuid4())
    task = {
        "type": "evaluate_model",
        "id": task_id,
        "model_path": os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl"),
        "dataset_dir": app.config['DATASET_FOLDER']
    }
    
    # 処理状態の初期化
    processing_status[task_id] = {"status": "queued", "message": "モデル評価を待機中..."}
    
    # キューに追加
    processing_queue.put(task)
    
    return jsonify({"success": True, "task_id": task_id, "message": "モデル評価を開始しました"})

@evaluation_bp.route('/analyze-annotation-impact', methods=['POST'])
def analyze_annotations():
    """アノテーションの影響分析を実行"""
    from app import app
    
    try:
        model_path = os.path.join(app.config['MODEL_FOLDER'], "sea_urchin_rf_model.pkl")
        dataset_dir = app.config['DATASET_FOLDER']
        
        # アノテーション影響分析
        result = analyze_annotation_impact(dataset_dir, model_path)
        
        return jsonify({
            "success": True, 
            "result": result
        })
    except Exception as e:
        return jsonify({
            "error": f"分析実行エラー: {str(e)}"
        }), 500

@evaluation_bp.route('/get-latest-result')
def get_latest_evaluation():
    """最新の評価結果を取得"""
    from app import app
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    history = get_model_evaluation_history(evaluation_dir)
    
    if not history:
        return jsonify({"error": "評価結果が見つかりません"}), 404
    
    # 最新の結果を返す
    latest = history[0]
    
    # 結果の詳細情報を読み込む
    result_file = os.path.join(evaluation_dir, latest["file"])
    try:
        with open(result_file, 'r') as f:
            detailed_result = json.load(f)
    except Exception as e:
        detailed_result = {"error": f"ファイル読み込みエラー: {str(e)}"}
    
    return jsonify({
        "summary": latest,
        "details": detailed_result
    })

@evaluation_bp.route('/static/evaluation/<path:filename>')
def evaluation_static(filename):
    """評価結果の静的ファイルを提供"""
    from app import app
    
    evaluation_dir = os.path.join(app.config.get('STATIC_FOLDER', 'static'), 'evaluation')
    return send_from_directory(evaluation_dir, filename)