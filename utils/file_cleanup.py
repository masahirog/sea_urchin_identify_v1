"""
ウニ生殖乳頭分析システム - 一時ファイルクリーンアップユーティリティ
一時ファイルの管理と定期的なクリーンアップ機能を提供する
"""

import os
import time
import glob
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def cleanup_temp_files(directory='static/uploads', max_age_hours=24):
    """
    指定されたディレクトリ内の古い一時ファイルを削除する
    
    Parameters:
    - directory: クリーンアップするディレクトリのパス
    - max_age_hours: 保持する最大時間（時間単位）
    
    Returns:
    - int: 削除されたファイル数
    """
    if not os.path.exists(directory):
        logger.warning(f"ディレクトリが存在しません: {directory}")
        return 0
        
    # 現在時刻
    now = time.time()
    
    # 削除したファイル数をカウント
    deleted_count = 0
    
    # 画像と動画ファイルのパターン
    patterns = ['*.jpg', '*.jpeg', '*.png', '*.mp4', '*.avi', '*.mov', '*.mkv']
    
    # すべてのパターンに対して検索
    for pattern in patterns:
        for filepath in glob.glob(os.path.join(directory, pattern)):
            # ファイルの最終変更時刻を取得
            file_modified = os.path.getmtime(filepath)
            
            # 指定された時間より古いファイルを削除
            if now - file_modified > max_age_hours * 3600:
                try:
                    os.remove(filepath)
                    deleted_count += 1
                    logger.info(f"一時ファイルを削除しました: {filepath}")
                except Exception as e:
                    logger.error(f"ファイル削除エラー {filepath}: {str(e)}")
    
    if deleted_count > 0:
        logger.info(f"合計 {deleted_count} 個の一時ファイルを削除しました")
    else:
        logger.debug(f"削除対象の一時ファイルはありませんでした")
                
    return deleted_count


def schedule_cleanup(app, interval_hours=12):
    """
    定期的なクリーンアップをスケジュールする
    （Flaskアプリケーションと組み合わせて使用）
    
    Parameters:
    - app: Flaskアプリケーションインスタンス
    - interval_hours: クリーンアップの間隔（時間単位）
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        
        scheduler = BackgroundScheduler()
        
        def cleanup_job():
            with app.app_context():
                temp_dir = app.config.get('TEMP_FILES_FOLDER', 'static/uploads')
                max_age = app.config.get('TEMP_FILES_MAX_AGE', 24)
                count = cleanup_temp_files(directory=temp_dir, max_age_hours=max_age)
                if count > 0:
                    logger.info(f"定期クリーンアップ: {count}ファイルを削除しました")
        
        # クリーンアップジョブをスケジュール
        scheduler.add_job(
            func=cleanup_job,
            trigger=IntervalTrigger(hours=interval_hours),
            id='cleanup_job',
            name='Temporary files cleanup',
            replace_existing=True
        )
        
        # スケジューラーを開始
        scheduler.start()
        logger.info(f"一時ファイルの定期クリーンアップをスケジュール（{interval_hours}時間ごと）")
        
        # アプリケーション終了時にスケジューラーをシャットダウン
        import atexit
        atexit.register(lambda: scheduler.shutdown())
        
    except ImportError:
        logger.warning("APSchedulerがインストールされていないため、定期クリーンアップはスケジュールされません")
        logger.warning("pip install apscheduler を実行してインストールしてください")


# コマンドラインから直接実行可能
if __name__ == "__main__":
    import argparse
    
    # コマンドライン引数の設定
    parser = argparse.ArgumentParser(description='一時ファイルのクリーンアップツール')
    parser.add_argument('--directory', default='static/uploads', help='クリーンアップするディレクトリ')
    parser.add_argument('--max-age', type=int, default=24, help='保持する最大時間（時間単位）')
    parser.add_argument('--verbose', action='store_true', help='詳細なログを表示')
    
    args = parser.parse_args()
    
    # ロギングの設定
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # クリーンアップの実行
    count = cleanup_temp_files(directory=args.directory, max_age_hours=args.max_age)
    print(f"{count}個のファイルを削除しました")