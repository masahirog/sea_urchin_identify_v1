import os
import glob
import shutil
import yaml

def diagnose_yolo_dataset():
    """YOLOデータセットの問題を診断して修正する"""
    dataset_dir = '../data/yolo_dataset'
    
    # 1. ディレクトリ構造の確認
    print("=== ディレクトリ構造の確認 ===")
    for subdir in ['images/train', 'labels/train']:
        path = os.path.join(dataset_dir, subdir)
        if os.path.exists(path):
            files = os.listdir(path)
            print(f"{path}: {len(files)} ファイル")
        else:
            print(f"エラー: {path} が存在しません")
    
    # 2. 画像とラベルの対応を確認
    print("\n=== 画像とラベルの対応確認 ===")
    images_dir = os.path.join(dataset_dir, 'images/train')
    labels_dir = os.path.join(dataset_dir, 'labels/train')
    
    if not os.path.exists(images_dir) or not os.path.exists(labels_dir):
        print("エラー: 画像またはラベルディレクトリが存在しません")
        return
    
    image_files = [os.path.splitext(f)[0] for f in os.listdir(images_dir) 
                  if f.endswith(('.jpg', '.jpeg', '.png'))]
    label_files = [os.path.splitext(f)[0] for f in os.listdir(labels_dir) 
                  if f.endswith('.txt')]
    
    # 対応するラベルがない画像を検出
    images_without_labels = [img for img in image_files if img not in label_files]
    if images_without_labels:
        print(f"警告: 以下の画像にはラベルがありません ({len(images_without_labels)}枚):")
        for img in images_without_labels:
            print(f"  - {img}")
    else:
        print("すべての画像にラベルが対応しています")
    
    # 対応する画像がないラベルを検出
    labels_without_images = [lbl for lbl in label_files if lbl not in image_files]
    if labels_without_images:
        print(f"警告: 以下のラベルには画像がありません ({len(labels_without_images)}個):")
        for lbl in labels_without_images:
            print(f"  - {lbl}")
    else:
        print("すべてのラベルに画像が対応しています")
    
    # 3. ラベルファイルの内容確認
    print("\n=== ラベルファイルの内容確認 ===")
    empty_labels = []
    invalid_labels = []
    
    for label_file in os.listdir(labels_dir):
        if not label_file.endswith('.txt'):
            continue
        
        label_path = os.path.join(labels_dir, label_file)
        with open(label_path, 'r') as f:
            content = f.read().strip()
        
        if not content:
            empty_labels.append(label_file)
            continue
        
        # YOLOフォーマットの検証 (各行が「クラスID x_center y_center width height」)
        try:
            for line in content.split('\n'):
                parts = line.split()
                if len(parts) != 5:
                    invalid_labels.append((label_file, "値の数が不正"))
                    break
                
                # 値を浮動小数点数として解析
                class_id = int(parts[0])
                x_center, y_center, width, height = map(float, parts[1:5])
                
                # 座標値の範囲チェック (0-1の範囲内であるべき)
                if not (0 <= x_center <= 1 and 0 <= y_center <= 1 and 
                        0 <= width <= 1 and 0 <= height <= 1):
                    invalid_labels.append((label_file, "座標値が範囲外"))
                    break
        except ValueError:
            invalid_labels.append((label_file, "数値変換エラー"))
    
    if empty_labels:
        print(f"警告: 以下のラベルファイルは空です ({len(empty_labels)}個):")
        for lbl in empty_labels:
            print(f"  - {lbl}")
    
    if invalid_labels:
        print(f"警告: 以下のラベルファイルに問題があります ({len(invalid_labels)}個):")
        for lbl, reason in invalid_labels:
            print(f"  - {lbl}: {reason}")
    
    if not empty_labels and not invalid_labels:
        print("すべてのラベルファイルが有効です")
    
    # 4. data.yamlの確認
    print("\n=== data.yamlの確認 ===")
    yaml_path = os.path.join(dataset_dir, 'data.yaml')
    if os.path.exists(yaml_path):
        with open(yaml_path, 'r') as f:
            try:
                data_config = yaml.safe_load(f)
                print("data.yamlの内容:")
                for key, value in data_config.items():
                    print(f"  {key}: {value}")
                
                # pathが絶対パスになっていないか確認
                if 'path' in data_config and os.path.isabs(data_config['path']):
                    print(f"警告: 絶対パスが使用されています: {data_config['path']}")
                    print("  相対パスに変更することをお勧めします: ../data/yolo_dataset")
            except yaml.YAMLError as e:
                print(f"エラー: YAMLファイルの解析に失敗しました: {e}")
    else:
        print(f"エラー: {yaml_path} が存在しません")

if __name__ == "__main__":
    # カレントディレクトリをyolov5に設定
    os.chdir('yolov5')
    diagnose_yolo_dataset()