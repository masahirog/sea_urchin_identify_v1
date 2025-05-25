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
        from config import TRAINING_DATA_MALE, TRAINING_DATA_FEMALE, YOLO_DATASET_DIR, STATIC_SAMPLES_DIR
        
        yolo_dataset_dir = 'data/yolo_dataset'
        
        # デバッグ: クリア前の状態を確認
        print("=== データセット準備開始 ===")
        train_labels_dir = os.path.join(yolo_dataset_dir, 'labels/train')
        if os.path.exists(train_labels_dir):
            existing_labels = [f for f in os.listdir(train_labels_dir) if f.endswith('.txt')]
            print(f"既存のラベルファイル: {existing_labels}")
        
        # ソースディレクトリの設定
        source_dirs = []
        
        # 1. 性別ごとのディレクトリ
        if os.path.exists(TRAINING_DATA_MALE):
            source_dirs.append(TRAINING_DATA_MALE)
        if os.path.exists(TRAINING_DATA_FEMALE):
            source_dirs.append(TRAINING_DATA_FEMALE)
        
        # 2. papillaeディレクトリ直下も含める
        papillae_dir = os.path.join(STATIC_SAMPLES_DIR, 'papillae')
        if os.path.exists(papillae_dir):
            source_dirs.append(papillae_dir)
        
        # ディレクトリ作成
        dirs_to_create = [
            'images/train', 'labels/train',
            'images/val', 'labels/val'
        ]
        
        for dir_path in dirs_to_create:
            os.makedirs(os.path.join(yolo_dataset_dir, dir_path), exist_ok=True)
        
        # 既存のデータセットをクリア（画像のみクリア、ラベルは残す）
        for dir_name in ['images/train', 'images/val']:
            full_path = os.path.join(yolo_dataset_dir, dir_name)
            if os.path.exists(full_path):
                for file in os.listdir(full_path):
                    if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                        file_path = os.path.join(full_path, file)
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            print(f"画像削除: {file_path}")
        
        # 検証用ラベルディレクトリのみクリア
        val_labels_dir = os.path.join(yolo_dataset_dir, 'labels/val')
        if os.path.exists(val_labels_dir):
            for file in os.listdir(val_labels_dir):
                if file.endswith('.txt'):
                    file_path = os.path.join(val_labels_dir, file)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
        
        # データ分割と配置
        train_count, val_count = DatasetManager._split_and_copy_data(
            source_dirs, yolo_dataset_dir
        )
        
        # data.yaml生成
        DatasetManager._generate_data_yaml(yolo_dataset_dir)
        
        # 検証
        train_images_dir = os.path.join(yolo_dataset_dir, 'images/train')
        train_labels_dir = os.path.join(yolo_dataset_dir, 'labels/train')
        
        actual_train_images = len([f for f in os.listdir(train_images_dir) 
                                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(train_images_dir) else 0
        actual_train_labels = len([f for f in os.listdir(train_labels_dir) 
                                 if f.endswith('.txt')]) if os.path.exists(train_labels_dir) else 0
        
        print(f"データセット準備完了:")
        print(f"  - 訓練画像: {actual_train_images}枚")
        print(f"  - 訓練ラベル: {actual_train_labels}個")
        print(f"  - 検証データ: {val_count}セット")
        
        return {
            'train_count': train_count,
            'val_count': val_count,
            'total_count': train_count + val_count,
            'actual_train_images': actual_train_images,
            'actual_train_labels': actual_train_labels
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
            "  1: female_papillae"
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