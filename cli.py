import cv2
import numpy as np
import os
import time
import uuid
from datetime import datetime
from skimage.metrics import structural_similarity as ssim
import base64
import joblib

# モデルインポート
from models.analyzer import UrchinPapillaeAnalyzer

# グローバル変数
processing_queue = Queue()
processing_results = {}
processing_status = {}

# ディレクトリ構造
UPLOAD_FOLDER = 'uploads'
EXTRACTED_FOLDER = 'extracted_images'
DATASET_FOLDER = 'dataset'
MODEL_FOLDER = 'models/saved'

# 必要なディレクトリの作成
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXTRACTED_FOLDER, exist_ok=True)
os.makedirs(os.path.join(DATASET_FOLDER, 'male'), exist_ok=True)
os.makedirs(os.path.join(DATASET_FOLDER, 'female'), exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

# ステップ1: 動画を処理してウニの生殖乳頭画像を抽出する
def extract_images_from_video(video_path, output_dir, max_images=10):
    """動画からウニの生殖乳頭画像を抽出する"""
    analyzer = UrchinPapillaeAnalyzer()
    task_id = str(uuid.uuid4())
    extracted_images = analyzer.process_video(video_path, output_dir, task_id, max_images)
    return extracted_images

# ステップ2: ウニの性別を判別する
def classify_sea_urchin_gender(image_path):
    """ウニの画像から性別を判別する"""
    analyzer = UrchinPapillaeAnalyzer()
    result = analyzer.classify_image(image_path)
    return result

# ステップ3: モデルを訓練する
def train_model(dataset_dir):
    """分類モデルを訓練する"""
    analyzer = UrchinPapillaeAnalyzer()
    task_id = str(uuid.uuid4())
    result = analyzer.train_model(dataset_dir, task_id)
    return result

# メイン関数
def main():
    print("ウニ生殖乳頭分析システム")
    print("1. 動画から画像を抽出")
    print("2. ウニの性別を判別")
    print("3. モデルを訓練")
    print("4. 終了")
    
    choice = input("選択してください (1-4): ")
    
    if choice == '1':
        video_path = input("動画ファイルのパス: ")
        max_images = int(input("抽出する最大画像数: "))
        print("処理を開始します...")
        extracted_images = extract_images_from_video(video_path, EXTRACTED_FOLDER, max_images)
        print(f"{len(extracted_images)}枚の画像を抽出しました")
    
    elif choice == '2':
        image_path = input("画像ファイルのパス: ")
        print("分析中...")
        result = classify_sea_urchin_gender(image_path)
        
        if "error" in result:
            print(f"エラー: {result['error']}")
        else:
            gender = "メス" if result["gender"] == "female" else "オス"
            confidence = result["confidence"] * 100
            print(f"判別結果: {gender} (信頼度: {confidence:.1f}%)")
    
    elif choice == '3':
        print("モデル訓練を開始します...")
        result = train_model(DATASET_FOLDER)
        if result:
            print("モデルの訓練が完了しました")
        else:
            print("モデルの訓練に失敗しました")
    
    elif choice == '4':
        print("終了します")
        return
    
    else:
        print("無効な選択です")
    
    # 再帰的に続ける
    print()
    main()

if __name__ == "__main__":
    main()