"""
API関連のルート
"""

from flask import Blueprint, jsonify, request

api_bp = Blueprint('api', __name__)

@api_bp.route('/task-status')
def get_task_status():
    """タスクの状態を取得"""
    from app import processing_status
    
    task_id = request.args.get('task_id')
    
    if not task_id:
        return jsonify({"error": "task_id is required"}), 400
    
    status = processing_status.get(task_id, {"status": "unknown", "message": "タスクが見つかりません"})
    
    return jsonify({"status": status})

@api_bp.route('/task-status/<task_id>')
def get_task_status_by_id(task_id):
    """タスクIDでの状態取得 (元のコードとの互換性用)"""
    from app import processing_status
    
    if not task_id:
        return jsonify({"status": "unknown", "message": "タスクIDが指定されていません"}), 400
    
    # ステータスの取得
    status = processing_status.get(task_id, {"status": "unknown", "message": "タスクが見つかりません"})
    
    print(f"タスク状態取得: {task_id} = {status}")
    
    # ステータスをそのまま返す（オブジェクトではなくフラットな形式）
    return jsonify(status)