# core/dataset_manager.py（新規ファイル）

import os
import shutil
import random
import json

class DatasetManager:
    """データセット管理の共通クラス"""
    
    @staticmethod
    def validate_annotations(dataset_dir):
        """アノテーションの検証"""
        issues = []
        
        # 各ラベルファイルをチェック
        label_dir = os.path.join(dataset_dir, 'labels/train')
        if not os.path.exists(label_dir):
            issues.append("ラベルディレクトリが存在しません")
            return issues
            
        label_files = [f for f in os.listdir(label_dir) if f.endswith('.txt')]
        
        if not label_files:
            issues.append("ラベルファイルが見つかりません")
            return issues
        
        for label_file in label_files:
            label_path = os.path.join(label_dir, label_file)
            with open(label_path, 'r') as f:
                lines = f.readlines()
                
            if not lines:
                issues.append(f"空のラベルファイル: {label_file}")
                continue
                
            # YOLOフォーマットの検証
            for i, line in enumerate(lines):
                parts = line.strip().split()
                if len(parts) != 5:
                    issues.append(f"不正なフォーマット {label_file}:{i+1}")
                    continue
                    
                try:
                    class_id = int(parts[0])
                    x, y, w, h = map(float, parts[1:5])
                    
                    # 値の範囲チェック
                    if not all(0 <= v <= 1 for v in [x, y, w, h]):
                        issues.append(f"座標が範囲外 {label_file}:{i+1}")
                        
                except ValueError:
                    issues.append(f"数値変換エラー {label_file}:{i+1}")
        
        return issues
    
    @staticmethod
    def prepare_yolo_dataset():
        from config import TRAINING_IMAGES_DIR, TRAINING_LABELS_DIR, YOLO_DATASET_DIR
        
        print("=== データセット準備開始 ===")
        
        # YOLOデータセットディレクトリの作成
        dirs_to_create = [
            os.path.join(YOLO_DATASET_DIR, 'images/train'),
            os.path.join(YOLO_DATASET_DIR, 'images/val'),
            os.path.join(YOLO_DATASET_DIR, 'labels/train'),
            os.path.join(YOLO_DATASET_DIR, 'labels/val')
        ]
        
        for dir_path in dirs_to_create:
            os.makedirs(dir_path, exist_ok=True)
        
        # 既存のデータをクリア
        for split in ['train', 'val']:
            for data_type in ['images', 'labels']:
                dir_path = os.path.join(YOLO_DATASET_DIR, data_type, split)
                for file in os.listdir(dir_path):
                    os.remove(os.path.join(dir_path, file))
        
        # 画像とラベルを収集
        all_data = []
        
        # 訓練データディレクトリから収集
        if os.path.exists(TRAINING_IMAGES_DIR):
            for image_file in os.listdir(TRAINING_IMAGES_DIR):
                if image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    base_name = os.path.splitext(image_file)[0]
                    label_file = base_name + '.txt'
                    
                    image_path = os.path.join(TRAINING_IMAGES_DIR, image_file)
                    label_path = os.path.join(TRAINING_LABELS_DIR, label_file)
                    
                    if os.path.exists(label_path):
                        all_data.append({
                            'image': image_path,
                            'label': label_path,
                            'name': base_name
                        })
        
        print(f"収集されたデータ数: {len(all_data)}")
        
        # データを訓練用と検証用に分割（8:2）
        import random
        random.shuffle(all_data)
        
        split_idx = int(len(all_data) * 0.8)
        train_data = all_data[:split_idx]
        val_data = all_data[split_idx:]
        
        # データをコピー
        for data_list, split in [(train_data, 'train'), (val_data, 'val')]:
            for item in data_list:
                # 画像をコピー
                dst_image = os.path.join(YOLO_DATASET_DIR, 'images', split, 
                                       os.path.basename(item['image']))
                shutil.copy2(item['image'], dst_image)
                
                # ラベルをコピー
                dst_label = os.path.join(YOLO_DATASET_DIR, 'labels', split, 
                                       os.path.basename(item['label']))
                shutil.copy2(item['label'], dst_label)
        
        # data.yaml生成
        DatasetManager._generate_data_yaml(YOLO_DATASET_DIR)
        
        print(f"データセット準備完了:")
        print(f"  - 訓練データ: {len(train_data)}セット")
        print(f"  - 検証データ: {len(val_data)}セット")
        
        return {
            'train_count': len(train_data),
            'val_count': len(val_data),
            'total_count': len(all_data),
            'actual_train_images': len(train_data),
            'actual_train_labels': len(train_data)
        }



    @staticmethod
    def _split_and_copy_data(source_dirs, target_dir, train_ratio=0.8):
        """データを訓練用と検証用に分割してコピー（改良版）"""
        import random
        import shutil
        
        all_images = []
        
        # 全画像を収集（既存のコードと同じ）
        for source_dir in source_dirs:
            if os.path.exists(source_dir):
                # ディレクトリ直下の画像
                for filename in os.listdir(source_dir):
                    if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                        all_images.append({
                            'filename': filename,
                            'source_path': os.path.join(source_dir, filename),
                            'source_dir': source_dir
                        })
        
        print(f"収集された画像数: {len(all_images)}")
        
        # データ分割の改良
        if len(all_images) == 0:
            return 0, 0
        elif len(all_images) == 1:
            # 1枚しかない場合は、訓練と検証の両方に同じ画像を使用
            train_images = all_images
            val_images = all_images
            print("警告: 画像が1枚のみのため、訓練と検証に同じ画像を使用します")
        elif len(all_images) <= 3:
            # 2-3枚の場合は、1枚を検証用に確保
            random.shuffle(all_images)
            val_images = all_images[:1]
            train_images = all_images
            print(f"少数データモード: 訓練{len(train_images)}枚（重複あり）, 検証{len(val_images)}枚")
        else:
            # 4枚以上の場合は通常の分割
            random.shuffle(all_images)
            if len(all_images) <= 5:
                train_ratio = 0.8  # 80%を訓練用
            split_idx = int(len(all_images) * train_ratio)
            split_idx = max(1, split_idx)  # 最低1枚は検証用
            train_images = all_images[:split_idx]
            val_images = all_images[split_idx:]
        
        train_count = 0
        val_count = 0
        
        # 訓練データ処理（既存のコードと同じ）
        for img_info in train_images:
            src_path = img_info['source_path']
            filename = img_info['filename']
            dst_path = os.path.join(target_dir, 'images/train', filename)
            
            try:
                # 画像をコピー
                shutil.copy2(src_path, dst_path)
                print(f"訓練画像コピー: {filename}")
                
                # ラベルファイル処理
                label_name = os.path.splitext(filename)[0] + '.txt'
                label_src_train = os.path.join(target_dir, 'labels/train', label_name)
                
                if os.path.exists(label_src_train):
                    print(f"訓練ラベル既存: {label_name}")
                    train_count += 1
                else:
                    print(f"警告: 訓練ラベルなし: {label_name}")
                    train_count += 1
                    
            except Exception as e:
                print(f"訓練データエラー: {str(e)}")
        
        # 検証データ処理
        for img_info in val_images:
            src_path = img_info['source_path']
            filename = img_info['filename']
            dst_path = os.path.join(target_dir, 'images/val', filename)
            
            try:
                # 画像をコピー
                shutil.copy2(src_path, dst_path)
                print(f"検証画像コピー: {filename}")
                
                # ラベルファイル処理
                label_name = os.path.splitext(filename)[0] + '.txt'
                label_src = os.path.join(target_dir, 'labels/train', label_name)
                label_dst = os.path.join(target_dir, 'labels/val', label_name)
                
                if os.path.exists(label_src):
                    # 少数データの場合はコピー（移動ではなく）
                    if len(all_images) <= 3:
                        shutil.copy2(label_src, label_dst)
                        print(f"検証ラベルコピー: {label_name}")
                    else:
                        shutil.move(label_src, label_dst)
                        print(f"検証ラベル移動: {label_name}")
                    val_count += 1
                else:
                    print(f"警告: 検証ラベルなし: {label_name}")
                    # 空のラベルファイルを作成
                    with open(label_dst, 'w') as f:
                        f.write('')
                    val_count += 1
                    
            except Exception as e:
                print(f"検証データエラー: {str(e)}")
        
        print(f"データセット準備完了: 訓練用 {train_count}枚, 検証用 {val_count}枚")
        
        return train_count, val_count
    
    @staticmethod
    def _generate_data_yaml(dataset_dir):
        """YOLOのdata.yamlファイルを生成"""
        abs_path = os.path.abspath(dataset_dir)
        
        # リストとして定義してから結合
        yaml_lines = [
            f"path: {abs_path}",
            "train: images/train",
            "val: images/val",
            "",
            "names:",
            "  0: male_papillae",
            "  1: female_papillae",
            "  2: madreporite"
        ]
        
        yaml_content = '\n'.join(yaml_lines) + '\n'
        
        yaml_path = os.path.join(dataset_dir, 'data.yaml')
        with open(yaml_path, 'w') as f:
            f.write(yaml_content)
        
        print(f"data.yaml生成: {yaml_path}")
        print("=== data.yaml内容 ===")
        print(yaml_content)
        print("===================")


    @staticmethod
    def get_dataset_stats():
        """データセットの統計情報を取得"""
        yolo_dataset_dir = 'data/yolo_dataset'
        
        stats = {
            'train_images': 0,
            'train_labels': 0,
            'val_images': 0,
            'val_labels': 0,
            'total_images': 0,
            'total_labels': 0
        }
        
        # 訓練データのカウント
        train_img_dir = os.path.join(yolo_dataset_dir, 'images/train')
        train_label_dir = os.path.join(yolo_dataset_dir, 'labels/train')
        
        if os.path.exists(train_img_dir):
            stats['train_images'] = len([f for f in os.listdir(train_img_dir) 
                                        if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        if os.path.exists(train_label_dir):
            stats['train_labels'] = len([f for f in os.listdir(train_label_dir) 
                                        if f.endswith('.txt')])
        
        # 検証データのカウント
        val_img_dir = os.path.join(yolo_dataset_dir, 'images/val')
        val_label_dir = os.path.join(yolo_dataset_dir, 'labels/val')
        
        if os.path.exists(val_img_dir):
            stats['val_images'] = len([f for f in os.listdir(val_img_dir) 
                                      if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        if os.path.exists(val_label_dir):
            stats['val_labels'] = len([f for f in os.listdir(val_label_dir) 
                                      if f.endswith('.txt')])
        
        stats['total_images'] = stats['train_images'] + stats['val_images']
        stats['total_labels'] = stats['train_labels'] + stats['val_labels']
        
        return stats