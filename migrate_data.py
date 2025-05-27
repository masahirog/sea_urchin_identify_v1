#!/usr/bin/env python
"""
データ構造の移行スクリプト
古い構造から新しいシンプルな構造へデータを移行
"""

import os
import shutil
import json
from datetime import datetime

def migrate_to_simple_structure():
    """データを新しい構造に移行"""
    
    print("=== データ移行開始 ===")
    
    # 1. バックアップディレクトリを作成
    backup_dir = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(backup_dir, exist_ok=True)
    print(f"バックアップディレクトリ: {backup_dir}")
    
    # 2. 新しいディレクトリ構造を作成
    os.makedirs('static/training_data/images', exist_ok=True)
    os.makedirs('static/training_data/labels', exist_ok=True)
    os.makedirs('static/detection_results', exist_ok=True)
    os.makedirs('static/evaluation', exist_ok=True)
    os.makedirs('data', exist_ok=True)
    
    # 3. アノテーション済み画像とラベルを移行
    old_annotation_images = 'static/images/annotations/images'
    old_annotation_labels = 'static/images/annotations/labels'
    new_images = 'static/training_data/images'
    new_labels = 'static/training_data/labels'
    
    moved_count = 0
    
    # 画像の移行
    if os.path.exists(old_annotation_images):
        print(f"\n画像を移行中: {old_annotation_images} → {new_images}")
        for filename in os.listdir(old_annotation_images):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                src = os.path.join(old_annotation_images, filename)
                dst = os.path.join(new_images, filename)
                
                # バックアップ
                backup_dst = os.path.join(backup_dir, 'images', filename)
                os.makedirs(os.path.dirname(backup_dst), exist_ok=True)
                shutil.copy2(src, backup_dst)
                
                # 移動
                shutil.move(src, dst)
                moved_count += 1
                print(f"  移動: {filename}")
    
    # ラベルの移行
    if os.path.exists(old_annotation_labels):
        print(f"\nラベルを移行中: {old_annotation_labels} → {new_labels}")
        for filename in os.listdir(old_annotation_labels):
            if filename.endswith('.txt'):
                src = os.path.join(old_annotation_labels, filename)
                dst = os.path.join(new_labels, filename)
                
                # バックアップ
                backup_dst = os.path.join(backup_dir, 'labels', filename)
                os.makedirs(os.path.dirname(backup_dst), exist_ok=True)
                shutil.copy2(src, backup_dst)
                
                # 移動
                shutil.move(src, dst)
                print(f"  移動: {filename}")
    
    # 4. メタデータの移行
    old_metadata = 'data/annotation_metadata.json'
    new_metadata = 'data/metadata.json'
    
    if os.path.exists(old_metadata):
        print(f"\nメタデータを移行中: {old_metadata} → {new_metadata}")
        shutil.copy2(old_metadata, os.path.join(backup_dir, 'annotation_metadata.json'))
        shutil.move(old_metadata, new_metadata)
    
    # 5. サンプル画像も統合（オプション）
    sample_dirs = [
        'static/images/samples/papillae/male',
        'static/images/samples/papillae/female',
        'static/images/samples/papillae'
    ]
    
    for sample_dir in sample_dirs:
        if os.path.exists(sample_dir):
            print(f"\nサンプル画像を統合: {sample_dir}")
            for filename in os.listdir(sample_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    src = os.path.join(sample_dir, filename)
                    dst = os.path.join(new_images, filename)
                    
                    # 重複チェック
                    if os.path.exists(dst):
                        base, ext = os.path.splitext(filename)
                        dst = os.path.join(new_images, f"{base}_sample{ext}")
                    
                    shutil.copy2(src, dst)
                    print(f"  コピー: {filename}")
    
    print(f"\n=== 移行完了 ===")
    print(f"移動した画像数: {moved_count}")
    print(f"バックアップ場所: {backup_dir}")
    
    # 6. 移行レポートを作成
    report = {
        'migration_date': datetime.now().isoformat(),
        'moved_images': moved_count,
        'backup_location': backup_dir,
        'old_structure': {
            'annotation_images': old_annotation_images,
            'annotation_labels': old_annotation_labels
        },
        'new_structure': {
            'training_images': new_images,
            'training_labels': new_labels
        }
    }
    
    with open('migration_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n移行レポートを migration_report.json に保存しました")

if __name__ == '__main__':
    response = input("データ移行を実行しますか？ (yes/no): ")
    if response.lower() == 'yes':
        migrate_to_simple_structure()
    else:
        print("移行をキャンセルしました")