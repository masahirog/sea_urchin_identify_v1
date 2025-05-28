"""
非同期処理用のワーカー機能
タスクキューからジョブを取得して処理を行う
"""

import os
import json
import traceback
from datetime import datetime

def processing_worker(queue, status_dict, app_config):
    """
    処理タスクを実行するワーカースレッド
    
    Parameters:
    - queue: 処理キュー
    - status_dict: 処理状態の辞書
    - app_config: アプリケーション設定
    """
    print("ワーカースレッド開始")
    
    while True:
        try:
            # キューからタスクを取得（ブロッキング）
            task = queue.get()
            
            if task is None:
                # 終了シグナル
                break
            
            task_id = task.get('id')
            task_type = task.get('type')
            
            try:
                # 処理開始を記録
                status_dict[task_id] = {
                    "status": "running",
                    "message": f"{task_type}処理を実行中...",
                    "progress": 10
                }
                
                # タスクの種類に応じた処理
                if task_type == 'yolo_training':
                    # YOLO学習タスク（将来的に実装）
                    handle_yolo_training_task(task, task_id, status_dict)
                else:
                    # 未知のタスクタイプ
                    status_dict[task_id] = {
                        "status": "failed",
                        "message": f"未知のタスクタイプ: {task_type}",
                        "progress": 100
                    }
            
            except Exception as e:
                # エラーを記録
                error_msg = f"処理エラー ({task_type}): {str(e)}"
                print(error_msg)
                traceback.print_exc()
                
                status_dict[task_id] = {
                    "status": "failed",
                    "message": error_msg,
                    "error_details": traceback.format_exc(),
                    "progress": 100
                }
            
            finally:
                # タスク完了を通知
                queue.task_done()
        
        except Exception as e:
            # ワーカースレッド自体のエラー
            error_msg = f"ワーカースレッドエラー: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            
            if 'task_id' in locals() and task_id in status_dict:
                status_dict[task_id] = {
                    "status": "failed",
                    "message": error_msg,
                    "progress": 100
                }
            
            if 'queue' in locals() and hasattr(queue, 'task_done'):
                try:
                    queue.task_done()
                except Exception:
                    pass


def handle_yolo_training_task(task, task_id, status_dict):
    """YOLO学習タスクの処理（将来実装）"""
    # 現在はプレースホルダー
    status_dict[task_id] = {
        "status": "completed",
        "message": "YOLO学習タスクは別プロセスで実行されます",
        "progress": 100
    }