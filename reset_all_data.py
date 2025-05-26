# reset_annotations.py
import os
import shutil
import json

def reset_annotations(confirm=False):
    """アノテーションデータを完全にリセット"""
    
    if not confirm:
        response = input("本当に全てのアノテーションデータを削除しますか？ (yes/no): ")
        if response.lower() != 'yes':
            print("キャンセルしました")
            return
    
    print("アノテーションデータをリセット中...")
    
    # 削除対象
    targets = [
        # アノテーション画像
        ('static/images/annotations', 'dir'),
        # メタデータ
        ('static/annotation_metadata.json', 'file'),
        ('data/annotation_metadata.json', 'file'),
        # YOLOデータセット
        ('data/yolo_dataset/images', 'dir'),
        ('data/yolo_dataset/labels', 'dir'),
        # アップロード画像（オプション）
        # ('data/uploads', 'dir'),
    ]
    
    deleted_count = 0
    
    for target, target_type in targets:
        try:
            if target_type == 'dir' and os.path.exists(target):
                # ディレクトリ内のファイルを削除（.gitkeepは残す）
                for item in os.listdir(target):
                    if item != '.gitkeep':
                        item_path = os.path.join(target, item)
                        if os.path.isfile(item_path):
                            os.remove(item_path)
                        elif os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        deleted_count += 1
                print(f"✓ ディレクトリをクリア: {target}")
                
            elif target_type == 'file' and os.path.exists(target):
                os.remove(target)
                deleted_count += 1
                print(f"✓ ファイルを削除: {target}")
                
        except Exception as e:
            print(f"✗ エラー ({target}): {e}")
    
    # 空のメタデータファイルを作成
    for metadata_file in ['static/annotation_metadata.json', 'data/annotation_metadata.json']:
        try:
            os.makedirs(os.path.dirname(metadata_file), exist_ok=True)
            with open(metadata_file, 'w') as f:
                json.dump({}, f)
            print(f"✓ 空のメタデータファイルを作成: {metadata_file}")
        except Exception as e:
            print(f"✗ メタデータ作成エラー: {e}")
    
    print(f"\n完了: {deleted_count}個のアイテムを削除しました")
    print("アノテーションデータがリセットされました")

if __name__ == "__main__":
    reset_annotations()