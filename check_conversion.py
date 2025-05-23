# check_conversion.py
import os
import json

# 重要なパスを確認
def check_paths():
    print("===== ディレクトリとファイルの確認 =====")
    
    # アノテーションマッピングの確認
    mapping_file = 'static/annotation_mapping.json'
    if os.path.exists(mapping_file):
        with open(mapping_file, 'r') as f:
            mapping = json.load(f)
        print(f"アノテーションマッピング: {len(mapping)}個のアノテーション")
    else:
        print(f"エラー: アノテーションマッピングファイル{mapping_file}が見つかりません")
    
    # ディレクトリ構造の確認
    paths = [
        'data',
        'data/yolo_dataset',
        'data/yolo_dataset/images',
        'data/yolo_dataset/images/train',
        'data/yolo_dataset/images/val',
        'data/yolo_dataset/labels',
        'data/yolo_dataset/labels/train',
        'data/yolo_dataset/labels/val'
    ]
    
    for path in paths:
        exists = os.path.exists(path)
        status = "✅" if exists else "❌"
        print(f"{status} {path}")
    
    # 設定ファイルの確認
    config_file = 'data/yolo_dataset/data.yaml'
    if os.path.exists(config_file):
        print(f"✅ {config_file}")
        with open(config_file, 'r') as f:
            print("内容:")
            print(f.read())
    else:
        print(f"❌ {config_file}")
    
    # 訓練データの確認
    train_images = os.listdir('data/yolo_dataset/images/train') if os.path.exists('data/yolo_dataset/images/train') else []
    train_labels = os.listdir('data/yolo_dataset/labels/train') if os.path.exists('data/yolo_dataset/labels/train') else []
    
    val_images = os.listdir('data/yolo_dataset/images/val') if os.path.exists('data/yolo_dataset/images/val') else []
    val_labels = os.listdir('data/yolo_dataset/labels/val') if os.path.exists('data/yolo_dataset/labels/val') else []
    
    print(f"\n訓練データ: {len(train_images)}画像, {len(train_labels)}ラベル")
    print(f"検証データ: {len(val_images)}画像, {len(val_labels)}ラベル")
    
    # 問題の可能性
    if len(train_images) == 0 or len(train_labels) == 0:
        print("\n⚠️ 訓練データが見つかりません。データ変換が成功していない可能性があります。")

if __name__ == "__main__":
    check_paths()