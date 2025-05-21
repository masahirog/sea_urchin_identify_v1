#!/usr/bin/env python
"""
ウニ生殖乳頭分析システム - コマンドラインインターフェース
画像処理・分析機能をCLIで提供
"""

import cv2
import numpy as np
import os
import time
import uuid
from datetime import datetime
from queue import Queue
import joblib
import argparse
import sys

# モデルインポート
from models.analyzer import UrchinPapillaeAnalyzer

# ディレクトリ構造
UPLOAD_FOLDER = 'uploads'
EXTRACTED_FOLDER = 'extracted_images'
DATASET_FOLDER = 'dataset'
MODEL_FOLDER = 'models/saved'

# 必要なディレクトリの作成
for directory in [
    UPLOAD_FOLDER, 
    EXTRACTED_FOLDER,
    os.path.join(DATASET_FOLDER, 'male'),
    os.path.join(DATASET_FOLDER, 'female'),
    MODEL_FOLDER
]:
    os.makedirs(directory, exist_ok=True)


# ステップ1: 動画を処理してウニの生殖乳頭画像を抽出する
def extract_images_from_video(video_path, output_dir, max_images=10):
    """動画からウニの生殖乳頭画像を抽出する"""
    if not os.path.exists(video_path):
        print(f"エラー: ビデオファイル '{video_path}' が見つかりません")
        return []
        
    analyzer = UrchinPapillaeAnalyzer()
    task_id = str(uuid.uuid4())
    print(f"処理ID: {task_id}")
    extracted_images = analyzer.process_video(video_path, output_dir, task_id, max_images)
    return extracted_images


# ステップ2: ウニの性別を判別する
def classify_sea_urchin_gender(image_path):
    """ウニの画像から性別を判別する"""
    if not os.path.exists(image_path):
        print(f"エラー: 画像ファイル '{image_path}' が見つかりません")
        return {"error": f"画像ファイルが見つかりません: {image_path}"}
        
    analyzer = UrchinPapillaeAnalyzer()
    result = analyzer.classify_image(image_path)
    return result


# ステップ3: モデルを訓練する
def train_model(dataset_dir):
    """分類モデルを訓練する"""
    if not os.path.exists(dataset_dir):
        print(f"エラー: データセットディレクトリ '{dataset_dir}' が見つかりません")
        return False
        
    analyzer = UrchinPapillaeAnalyzer()
    task_id = str(uuid.uuid4())
    result = analyzer.train_model(dataset_dir, task_id)
    return result


# メイン関数
def main():
    parser = argparse.ArgumentParser(description="ウニ生殖乳頭分析システム")
    subparsers = parser.add_subparsers(dest="command", help="実行するコマンド")
    
    # 動画から画像を抽出するコマンド
    extract_parser = subparsers.add_parser("extract", help="動画から画像を抽出")
    extract_parser.add_argument("video_path", help="動画ファイルのパス")
    extract_parser.add_argument("--max-images", type=int, default=10, help="抽出する最大画像数")
    extract_parser.add_argument("--output-dir", default=EXTRACTED_FOLDER, help="出力ディレクトリ")
    
    # ウニの性別を判別するコマンド
    classify_parser = subparsers.add_parser("classify", help="ウニの性別を判別")
    classify_parser.add_argument("image_path", help="画像ファイルのパス")
    
    # モデルを訓練するコマンド
    train_parser = subparsers.add_parser("train", help="モデルを訓練")
    train_parser.add_argument("--dataset-dir", default=DATASET_FOLDER, help="データセットディレクトリ")
    
    # 引数のパース
    args = parser.parse_args()
    
    if args.command == "extract":
        print(f"動画 '{args.video_path}' から画像を抽出します（最大 {args.max_images} 枚）")
        images = extract_images_from_video(args.video_path, args.output_dir, args.max_images)
        print(f"{len(images)} 枚の画像を抽出しました")
        for img in images:
            print(f"  - {img}")
    
    elif args.command == "classify":
        print(f"画像 '{args.image_path}' を分析中...")
        result = classify_sea_urchin_gender(args.image_path)
        
        if "error" in result:
            print(f"エラー: {result['error']}")
        else:
            gender = "メス" if result["gender"] == "female" else "オス"
            confidence = result["confidence"] * 100
            print(f"判別結果: {gender} (信頼度: {confidence:.1f}%)")
    
    elif args.command == "train":
        print(f"データセット '{args.dataset_dir}' を使用してモデルを訓練します")
        success = train_model(args.dataset_dir)
        if success:
            print("モデルの訓練が完了しました")
        else:
            print("モデルの訓練に失敗しました")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()