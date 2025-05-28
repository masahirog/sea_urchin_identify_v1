#!/usr/bin/env python3
"""
アノテーションラベルから画像の性別を自動判定
YOLOラベルファイルのクラスIDを基に性別を設定
"""

import os
import json
from datetime import datetime
from collections import Counter

def auto_set_gender_from_labels():
    print("アノテーションラベルから性別を自動判定します...")
    
    # ディレクトリ設定
    images_dir = "static/training_data/images"
    labels_dir = "static/training_data/labels"
    metadata_file = "data/metadata.json"
    
    # 画像ファイルを取得
    images = [f for f in os.listdir(images_dir) 
             if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    print(f"検出された画像: {len(images)}枚")
    
    # メタデータを作成
    metadata = {}
    stats = {"male": 0, "female": 0, "unknown": 0, "mixed": 0}
    
    for filename in images:
        base_name = os.path.splitext(filename)[0]
        label_file = os.path.join(labels_dir, f"{base_name}.txt")
        
        if os.path.exists(label_file):
            # ラベルファイルを読み込み
            with open(label_file, 'r') as f:
                lines = f.readlines()
            
            # クラスIDを収集
            class_ids = []
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 5:
                    class_ids.append(int(parts[0]))
            
            # 最も多いクラスIDで性別を判定
            if class_ids:
                class_counts = Counter(class_ids)
                most_common_class = class_counts.most_common(1)[0][0]
                
                # クラスIDに基づいて性別を設定
                # 0: male_papillae, 1: female_papillae, 2: madreporite
                if most_common_class == 0:
                    gender = "male"
                    stats["male"] += 1
                elif most_common_class == 1:
                    gender = "female"
                    stats["female"] += 1
                else:
                    # 複数のクラスが混在している場合
                    if 0 in class_ids and 1 in class_ids:
                        # オスとメスが混在 -> より多い方を採用
                        if class_counts[0] > class_counts[1]:
                            gender = "male"
                            stats["mixed"] += 1
                        else:
                            gender = "female"
                            stats["mixed"] += 1
                    elif 0 in class_ids:
                        gender = "male"
                        stats["male"] += 1
                    elif 1 in class_ids:
                        gender = "female"
                        stats["female"] += 1
                    else:
                        gender = "unknown"
                        stats["unknown"] += 1
            else:
                gender = "unknown"
                stats["unknown"] += 1
        else:
            # ラベルファイルがない場合
            gender = "unknown"
            stats["unknown"] += 1
        
        metadata[filename] = {
            "gender": gender,
            "upload_time": datetime.now().isoformat(),
            "original_name": filename,
            "auto_detected": True,
            "label_file": os.path.exists(label_file)
        }
    
    # メタデータを保存
    os.makedirs(os.path.dirname(metadata_file), exist_ok=True)
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # 結果表示
    print(f"\n性別自動判定完了:")
    print(f"  オス: {stats['male']}枚")
    print(f"  メス: {stats['female']}枚")
    if stats['mixed'] > 0:
        print(f"  混在（最多数で判定）: {stats['mixed']}枚")
    if stats['unknown'] > 0:
        print(f"  不明: {stats['unknown']}枚")
    print(f"  合計: {len(metadata)}枚")
    
    if stats['unknown'] > 0:
        print("\n⚠️  性別が判定できない画像があります。")
        print("   これらの画像にはアノテーションがないか、")
        print("   madreporite（クラス2）のみがアノテーションされています。")

if __name__ == "__main__":
    auto_set_gender_from_labels()