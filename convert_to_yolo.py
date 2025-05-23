#!/usr/bin/env python
"""
アノテーション画像からYOLOv5形式のデータセットを生成するスクリプト
"""

import os
import sys
import json
import shutil
import yaml
from pathlib import Path

def convert_to_yolo_dataset():
    """アノテーションデータをYOLO形式に変換"""
    
    print("=== YOLO形式データセット変換開始 ===")
    
    # PapillaeDetectorのインポート
    try:
        from core.PapillaeDetector import PapillaeDetector
    except ImportError:
        print("エラー: PapillaeDetectorのインポートに失敗しました")
        print("プロジェクトのルートディレクトリから実行してください")
        return False
    
    # データ変換を実行
    detector = PapillaeDetector()
    
    # ソースディレクトリの確認
    source_dir = 'static/images/annotations'
    if not os.path.exists(source_dir):
        print(f"エラー: アノテーションディレクトリが見つかりません: {source_dir}")
        print("アノテーション画像を作成してから実行してください")
        return False
    
    # アノテーションファイル数の確認
    annotation_files = [f for f in os.listdir(source_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    if not annotation_files:
        print(f"エラー: アノテーション画像が見つかりません: {source_dir}")
        return False
    
    print(f"アノテーション画像数: {len(annotation_files)}")
    
    # ターゲットディレクトリ
    target_dir = 'data/yolo_dataset'
    
    # 既存のデータセットをバックアップ
    if os.path.exists(target_dir):
        backup_dir = f"{target_dir}_backup"
        if os.path.exists(backup_dir):
            print(f"既存のバックアップを削除: {backup_dir}")
            shutil.rmtree(backup_dir)
        print(f"既存のデータセットをバックアップ: {target_dir} -> {backup_dir}")
        shutil.move(target_dir, backup_dir)
    
    try:
        # データ変換実行
        print("\nデータ変換を開始...")
        result = detector.prepare_training_data(
            source_dir=source_dir,
            target_dir=target_dir,
            split_ratio=0.8  # 訓練80%、検証20%
        )
        
        if result:
            print("\n=== データ変換成功 ===")
            
            # 変換結果の確認
            check_converted_dataset(target_dir)
            
            # data.yamlの確認
            yaml_path = os.path.join(target_dir, 'data.yaml')
            if os.path.exists(yaml_path):
                print(f"\ndata.yaml の内容:")
                with open(yaml_path, 'r') as f:
                    print(f.read())
            
            return True
        else:
            print("\n=== データ変換失敗 ===")
            return False
            
    except Exception as e:
        print(f"\n変換中にエラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def check_converted_dataset(dataset_dir):
    """変換されたデータセットの検証"""
    print("\n=== データセット検証 ===")
    
    # ディレクトリ構造の確認
    required_dirs = [
        'images/train',
        'images/val',
        'labels/train',
        'labels/val'
    ]
    
    for dir_path in required_dirs:
        full_path = os.path.join(dataset_dir, dir_path)
        if os.path.exists(full_path):
            files = os.listdir(full_path)
            if 'images' in dir_path:
                files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            elif 'labels' in dir_path:
                files = [f for f in files if f.endswith('.txt')]
            print(f"✓ {dir_path}: {len(files)} ファイル")
        else:
            print(f"✗ {dir_path}: ディレクトリが存在しません")
    
    # 画像とラベルの対応確認
    train_images_dir = os.path.join(dataset_dir, 'images/train')
    train_labels_dir = os.path.join(dataset_dir, 'labels/train')
    
    if os.path.exists(train_images_dir) and os.path.exists(train_labels_dir):
        images = [os.path.splitext(f)[0] for f in os.listdir(train_images_dir) 
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        labels = [os.path.splitext(f)[0] for f in os.listdir(train_labels_dir) 
                 if f.endswith('.txt')]
        
        # 対応確認
        images_without_labels = set(images) - set(labels)
        labels_without_images = set(labels) - set(images)
        
        if images_without_labels:
            print(f"\n警告: ラベルがない画像: {len(images_without_labels)}個")
            for img in list(images_without_labels)[:5]:  # 最初の5個を表示
                print(f"  - {img}")
        
        if labels_without_images:
            print(f"\n警告: 画像がないラベル: {len(labels_without_images)}個")
            for lbl in list(labels_without_images)[:5]:  # 最初の5個を表示
                print(f"  - {lbl}")
        
        if not images_without_labels and not labels_without_images:
            print("\n✓ すべての画像とラベルが正しく対応しています")
    
    # サンプルラベルの内容確認
    if os.path.exists(train_labels_dir):
        label_files = [f for f in os.listdir(train_labels_dir) if f.endswith('.txt')]
        if label_files:
            sample_label = os.path.join(train_labels_dir, label_files[0])
            print(f"\nサンプルラベル ({label_files[0]}):")
            with open(sample_label, 'r') as f:
                content = f.read()
                if content:
                    print(content)
                    # ラベルフォーマットの検証
                    lines = content.strip().split('\n')
                    for i, line in enumerate(lines[:3]):  # 最初の3行を検証
                        parts = line.split()
                        if len(parts) == 5:
                            try:
                                class_id = int(parts[0])
                                x, y, w, h = map(float, parts[1:5])
                                if 0 <= x <= 1 and 0 <= y <= 1 and 0 <= w <= 1 and 0 <= h <= 1:
                                    print(f"  行{i+1}: ✓ 正しいフォーマット")
                                else:
                                    print(f"  行{i+1}: ✗ 座標値が範囲外")
                            except ValueError:
                                print(f"  行{i+1}: ✗ 数値変換エラー")
                        else:
                            print(f"  行{i+1}: ✗ フォーマットエラー（要素数: {len(parts)}）")
                else:
                    print("  (空のファイル)")

def create_empty_dataset_structure():
    """空のYOLOデータセット構造を作成"""
    print("\n=== 空のデータセット構造を作成 ===")
    
    dataset_dir = 'data/yolo_dataset'
    
    # 必要なディレクトリを作成
    dirs = [
        'images/train',
        'images/val',
        'labels/train',
        'labels/val'
    ]
    
    for dir_path in dirs:
        full_path = os.path.join(dataset_dir, dir_path)
        os.makedirs(full_path, exist_ok=True)
        print(f"✓ ディレクトリ作成: {full_path}")
    
    # data.yamlを作成
    yaml_content = f"""# YOLOv5 学習用設定ファイル
        path: {os.path.abspath(dataset_dir)}
        train: images/train
        val: images/val

        # クラス数
        nc: 1

        # クラス名
        names: ['papillae']
        """
    
    yaml_path = os.path.join(dataset_dir, 'data.yaml')
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
    print(f"✓ 設定ファイル作成: {yaml_path}")
    
    print("\n空のデータセット構造を作成しました。")
    print("次のステップ:")
    print("1. アノテーションツールで画像にアノテーションを作成")
    print("2. このスクリプトを再実行してデータを変換")

if __name__ == "__main__":
    # コマンドライン引数の処理
    if len(sys.argv) > 1 and sys.argv[1] == "--empty":
        # 空のデータセット構造のみ作成
        create_empty_dataset_structure()
    else:
        # 通常の変換処理
        success = convert_to_yolo_dataset()
        
        if not success:
            print("\n空のデータセット構造を作成しますか？")
            print("実行: python convert_to_yolo.py --empty")
            
        sys.exit(0 if success else 1)