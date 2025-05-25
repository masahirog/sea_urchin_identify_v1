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
        from config import TRAINING_DATA_MALE, TRAINING_DATA_FEMALE, YOLO_DATASET_DIR
        source_dirs = [TRAINING_DATA_MALE, TRAINING_DATA_FEMALE]  # 設定から取得

        if source_dirs is None:
            source_dirs = [
                'static/images/samples/papillae/male',
                'static/images/samples/papillae/female'
            ]
        
        yolo_dataset_dir = 'data/yolo_dataset'
        
        # ディレクトリ作成
        dirs_to_create = [
            'images/train', 'labels/train',
            'images/val', 'labels/val'
        ]
        
        for dir_path in dirs_to_create:
            os.makedirs(os.path.join(yolo_dataset_dir, dir_path), exist_ok=True)
        
        # 既存のデータセットをクリア（オプション）
        # これにより、古いデータが残らないようにする
        for dir_path in dirs_to_create:
            full_path = os.path.join(yolo_dataset_dir, dir_path)
            if os.path.exists(full_path):
                # ディレクトリ内のファイルを削除
                for file in os.listdir(full_path):
                    file_path = os.path.join(full_path, file)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
        
        # データ分割と配置
        train_count, val_count = DatasetManager._split_and_copy_data(
            source_dirs, yolo_dataset_dir
        )
        
        # data.yaml生成
        DatasetManager._generate_data_yaml(yolo_dataset_dir)
        
        # 検証: 実際にファイルが存在するか確認
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
    def _split_and_copy_data_simple(source_dir, target_dir, train_ratio=0.8):
        """データを訓練用と検証用に分割してコピー（シンプル版）"""
        all_images = []
        
        # 画像を収集（サブディレクトリも含む）
        if os.path.exists(source_dir):
            # 直接配置された画像
            for filename in os.listdir(source_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    all_images.append({
                        'filename': filename,
                        'source_path': os.path.join(source_dir, filename)
                    })
            
            # サブディレクトリ内の画像も収集（後方互換性）
            for subdir in ['male', 'female', 'unknown']:
                subdir_path = os.path.join(source_dir, subdir)
                if os.path.exists(subdir_path):
                    for filename in os.listdir(subdir_path):
                        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                            all_images.append({
                                'filename': filename,
                                'source_path': os.path.join(subdir_path, filename)
                            })
        
        print(f"収集された画像数: {len(all_images)}")
        
        # データが少ない場合は全てを訓練用に使用
        if len(all_images) <= 5:
            train_ratio = 1.0
        
        # シャッフルして分割
        random.shuffle(all_images)
        split_idx = int(len(all_images) * train_ratio)
        train_images = all_images[:split_idx]
        val_images = all_images[split_idx:]
        
        train_count = 0
        val_count = 0
        
        # 訓練データ
        for img_info in train_images:
            dst_path = os.path.join(target_dir, 'images/train', img_info['filename'])
            
            try:
                shutil.copy2(img_info['source_path'], dst_path)
                
                # ラベルファイルがあるか確認
                label_name = os.path.splitext(img_info['filename'])[0] + '.txt'
                label_src = os.path.join('data/yolo_dataset/labels/train', label_name)
                if os.path.exists(label_src):
                    train_count += 1
                else:
                    train_count += 1
                    
            except Exception as e:
                print(f"画像コピーエラー: {img_info['source_path']} -> {dst_path}: {str(e)}")
        
        # 検証データ
        for img_info in val_images:
            dst_path = os.path.join(target_dir, 'images/val', img_info['filename'])
            
            try:
                shutil.copy2(img_info['source_path'], dst_path)
                
                # ラベルファイルの移動
                label_name = os.path.splitext(img_info['filename'])[0] + '.txt'
                label_src = os.path.join('data/yolo_dataset/labels/train', label_name)
                label_dst = os.path.join(target_dir, 'labels/val', label_name)
                if os.path.exists(label_src):
                    shutil.move(label_src, label_dst)
                    val_count += 1
                else:
                    val_count += 1
                    
            except Exception as e:
                print(f"画像コピーエラー: {img_info['source_path']} -> {dst_path}: {str(e)}")
        
        print(f"データセット準備完了: 訓練用 {train_count}枚, 検証用 {val_count}枚")
        
        return train_count, val_count


    @staticmethod
    def _split_and_copy_data(source_dirs, target_dir, train_ratio=0.8):
        """データを訓練用と検証用に分割してコピー"""
        all_images = []
        
        # 全画像を収集
        for source_dir in source_dirs:
            if os.path.exists(source_dir):
                for filename in os.listdir(source_dir):
                    if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                        all_images.append({
                            'filename': filename,
                            'source_dir': source_dir,
                            'gender': os.path.basename(source_dir)
                        })
        
        # データが少ない場合は全てを訓練用に使用
        if len(all_images) <= 5:
            train_ratio = 1.0  # 5枚以下の場合は全て訓練用
        
        # シャッフルして分割
        random.shuffle(all_images)
        split_idx = int(len(all_images) * train_ratio)
        train_images = all_images[:split_idx]
        val_images = all_images[split_idx:]
        
        train_count = 0
        val_count = 0
        
        # 訓練データ
        for img_info in train_images:
            src_path = os.path.join(img_info['source_dir'], img_info['filename'])
            dst_path = os.path.join(target_dir, 'images/train', img_info['filename'])
            
            # 画像をコピー
            try:
                shutil.copy2(src_path, dst_path)
                
                # ラベルファイルがあるか確認してコピー
                label_name = os.path.splitext(img_info['filename'])[0] + '.txt'
                label_src = os.path.join('data/yolo_dataset/labels/train', label_name)
                if os.path.exists(label_src):
                    # ラベルファイルはそのまま train に残す
                    train_count += 1
                else:
                    # ラベルファイルがない場合は画像のみカウント
                    train_count += 1
                    
            except Exception as e:
                print(f"画像コピーエラー: {src_path} -> {dst_path}: {str(e)}")
        
        # 検証データ
        for img_info in val_images:
            src_path = os.path.join(img_info['source_dir'], img_info['filename'])
            dst_path = os.path.join(target_dir, 'images/val', img_info['filename'])
            
            # 画像をコピー
            try:
                shutil.copy2(src_path, dst_path)
                
                # ラベルファイルがあるか確認して移動
                label_name = os.path.splitext(img_info['filename'])[0] + '.txt'
                label_src = os.path.join('data/yolo_dataset/labels/train', label_name)
                label_dst = os.path.join(target_dir, 'labels/val', label_name)
                if os.path.exists(label_src):
                    shutil.move(label_src, label_dst)
                    val_count += 1
                else:
                    # ラベルファイルがない場合は画像のみカウント
                    val_count += 1
                    
            except Exception as e:
                print(f"画像コピーエラー: {src_path} -> {dst_path}: {str(e)}")
        
        print(f"データセット準備完了: 訓練用 {train_count}枚, 検証用 {val_count}枚")
        
        return train_count, val_count
    
    @staticmethod
    def _generate_data_yaml(dataset_dir):
        """YOLOのdata.yamlファイルを生成"""
        yaml_content = f"""path: {os.path.abspath(dataset_dir)}
            train: images/train
            val: images/val

            names:
              0: male_papillae
              1: female_papillae
            """
        with open(os.path.join(dataset_dir, 'data.yaml'), 'w') as f:
            f.write(yaml_content)
    
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