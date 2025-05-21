"""
ウニ生殖乳頭分析システム - API ルート
処理状態や結果を取得するREST APIを提供する
"""

from flask import Blueprint, jsonify, request, current_app

api_bp = Blueprint('api', __name__)


@api_bp.route('/task-status')
def get_task_status():
    """
    タスクの状態を取得
    
    Query Parameters:
    - task_id: 処理タスクのID
    
    Returns:
    - JSON: タスクの処理状態
    """
    from app import processing_status
    
    task_id = request.args.get('task_id')
    
    if not task_id:
        return jsonify({"error": "task_id is required"}), 400
    
    # 状態の取得
    if task_id in processing_status:
        status = processing_status.get(task_id)
        return jsonify({"status": status})
    else:
        return jsonify({"status": {"status": "unknown", "message": "タスクが見つかりません"}})


@api_bp.route('/task-status/<task_id>')
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


@api_bp.route('/all-tasks')
def get_all_tasks():
    """
    すべてのタスク状態を取得
    
    Returns:
    - JSON: すべてのタスクの処理状態
    """
    from app import processing_status
    
    # APIキーによる認証（オプション）
    api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if not api_key or api_key != current_app.config.get('API_KEY', 'dev_key'):
        return jsonify({"error": "認証が必要です"}), 401
    
    # 全タスクのステータスを返す
    return jsonify({
        "tasks": processing_status,
        "count": len(processing_status)
    })


@api_bp.route('/cancel-task/<task_id>', methods=['POST'])
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


@api_bp.route('/stats')
def get_system_stats():
    """
    システム統計情報を取得
    
    Returns:
    - JSON: システム統計情報
    """
    from app import processing_status, app
    import os
    
    # データセット統計
    dataset_dir = app.config['DATASET_FOLDER']
    male_dir = os.path.join(dataset_dir, 'male')
    female_dir = os.path.join(dataset_dir, 'female')
    
    male_count = len([f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(male_dir) else 0
    female_count = len([f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(female_dir) else 0
    
    # タスク統計
    tasks = processing_status
    active_tasks = len([t for t in tasks.values() if t.get('status') in ['processing', 'queued', 'running']])
    completed_tasks = len([t for t in tasks.values() if t.get('status') == 'completed'])
    failed_tasks = len([t for t in tasks.values() if t.get('status') in ['failed', 'error']])
    
    return jsonify({
        "dataset": {
            "male_count": male_count,
            "female_count": female_count,
            "total_count": male_count + female_count
        },
        "tasks": {
            "total": len(tasks),
            "active": active_tasks,
            "completed": completed_tasks,
            "failed": failed_tasks
        },
        "system": {
            "version": "1.0.0",
            "uptime": "Unknown"  # 実際のアプリ起動時間を追跡する場合はここに追加
        }
    })