# reset_all_data.py として保存
import os
import shutil

def reset_all_data():
    """すべてのデータをリセットし、ディレクトリ構造を再作成"""
    
    print("データリセットを開始します...")
    
    # 1. データディレクトリの削除
    directories_to_remove = [
        'data',
        'yolov5/runs',
        'logs'
    ]
    
    for dir_path in directories_to_remove:
        if os.path.exists(dir_path):
            try:
                shutil.rmtree(dir_path)
                print(f"削除: {dir_path}")
            except Exception as e:
                print(f"削除エラー: {dir_path} - {e}")
    
    # 2. 静的ファイルのクリーンアップ
    static_dirs_to_clean = [
        'static/images/detection_results',
        'static/images/annotations',
        'static/images/evaluations',
        'static/images/samples/papillae/male',
        'static/images/samples/papillae/female',
        'static/images/samples/papillae/unknown'
    ]
    
    for dir_path in static_dirs_to_clean:
        if os.path.exists(dir_path):
            # ディレクトリ内のファイルを削除（.gitkeepは残す）
            for file in os.listdir(dir_path):
                if file != '.gitkeep':
                    file_path = os.path.join(dir_path, file)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            print(f"削除: {file_path}")
                    except Exception as e:
                        print(f"ファイル削除エラー: {file_path} - {e}")
    
    # 3. アノテーションマッピングのリセット
    annotation_file = 'static/annotation_mapping.json'
    with open(annotation_file, 'w') as f:
        f.write('{}')
    print(f"リセット: {annotation_file}")
    
    # 4. 必要なディレクトリの再作成
    from config import ensure_directories
    ensure_directories()
    print("ディレクトリ構造を再作成しました")
    
    # 5. .gitkeepファイルの作成
    gitkeep_dirs = [
        'data/uploads',
        'data/extracted_frames',
        'data/models/saved',
        'data/evaluations',
        'data/yolo_dataset/images/train',
        'data/yolo_dataset/images/val',
        'data/yolo_dataset/labels/train',
        'data/yolo_dataset/labels/val',
        'static/images/detection_results',
        'static/images/annotations',
        'static/images/evaluations',
        'static/images/samples/papillae/male',
        'static/images/samples/papillae/female',
        'static/images/samples/papillae/unknown',
        'static/annotations/yolo',
        'logs'
    ]
    
    for dir_path in gitkeep_dirs:
        os.makedirs(dir_path, exist_ok=True)
        gitkeep_path = os.path.join(dir_path, '.gitkeep')
        if not os.path.exists(gitkeep_path):
            with open(gitkeep_path, 'w') as f:
                f.write('')
            print(f"作成: {gitkeep_path}")
    
    print("\nデータリセットが完了しました！")
    print("すべての学習データ、モデル、結果が削除されました。")
    print("アプリケーションを再起動して、新しく始めることができます。")

if __name__ == "__main__":
    # 確認プロンプト
    response = input("警告: すべてのデータが削除されます。続行しますか？ (yes/no): ")
    if response.lower() == 'yes':
        reset_all_data()
    else:
        print("キャンセルしました。")