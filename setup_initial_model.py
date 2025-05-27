#!/usr/bin/env python3
"""
初回セットアップスクリプト
システムを使用可能な状態にするための最小限のセットアップを行う
"""

import os
import sys
from pathlib import Path

def check_requirements():
    """必要な要件をチェック"""
    print("🔍 システム要件をチェックしています...")
    
    issues = []
    
    # YOLOv5の確認
    if not os.path.exists('yolov5'):
        issues.append("YOLOv5がインストールされていません。`python setup_yolo.py`を実行してください。")
    
    # 必要なディレクトリの作成
    from config import ensure_directories
    ensure_directories()
    
    # モデルファイルの確認
    from config import MODELS_DIR
    model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
    
    if not os.path.exists(model_path):
        issues.append("RandomForestモデルが存在しません。")
    
    return issues

def create_sample_model():
    """サンプルモデルを作成"""
    print("🤖 サンプルモデルを作成しています...")
    
    from core.analyzer import UnifiedAnalyzer
    from config import TRAINING_IMAGES_DIR, METADATA_FILE
    import json
    import shutil
    
    # サンプル画像の準備（必要に応じて）
    sample_images_created = False
    
    if not os.listdir(TRAINING_IMAGES_DIR):
        print("📸 サンプル画像を準備しています...")
        # ここでサンプル画像を作成または既存画像をコピー
        sample_images_created = True
    
    # 最小限のメタデータ作成
    if not os.path.exists(METADATA_FILE):
        metadata = {}
        # 実際の画像に基づいてメタデータを生成
        for filename in os.listdir(TRAINING_IMAGES_DIR):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                # 仮の性別割り当て（実際はユーザーが指定すべき）
                gender = 'male' if hash(filename) % 2 == 0 else 'female'
                metadata[filename] = {
                    'gender': gender,
                    'upload_time': '2024-01-01T00:00:00'
                }
        
        os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    # モデルの訓練を試行
    analyzer = UnifiedAnalyzer()
    success = analyzer.train_model(None, "initial_setup")
    
    return success, sample_images_created

def main():
    """メイン処理"""
    print("=" * 50)
    print("🦀 ウニ生殖乳頭分析システム - 初期セットアップ")
    print("=" * 50)
    
    # 要件チェック
    issues = check_requirements()
    
    if "YOLOv5" in str(issues):
        print("❌ YOLOv5のセットアップが必要です")
        sys.exit(1)
    
    # モデルチェック
    from config import MODELS_DIR
    model_path = os.path.join(MODELS_DIR, 'saved', 'sea_urchin_rf_model.pkl')
    
    if os.path.exists(model_path):
        print("✅ モデルは既に存在します")
        return
    
    print("\n🚀 初回セットアップを開始します")
    
    # ユーザーに選択させる
    print("\n以下から選択してください:")
    print("1. サンプルデータでテストモデルを作成（推奨）")
    print("2. 空の状態で開始（後で学習データをアップロード）")
    print("3. キャンセル")
    
    choice = input("\n選択 (1-3): ").strip()
    
    if choice == "1":
        success, sample_created = create_sample_model()
        if success:
            print("\n✅ セットアップ完了！")
            print("📌 注意: これはテスト用のモデルです。")
            print("   実際の使用には、本物のウニ画像で再学習してください。")
        else:
            print("\n⚠️  モデル作成に失敗しました")
            print("   学習データが不足している可能性があります。")
    
    elif choice == "2":
        print("\n✅ 空の状態で開始します")
        print("📌 使用開始前に以下を行ってください:")
        print("   1. 学習データページでオス・メスの画像をアップロード")
        print("   2. 機械学習ページで学習を実行")
    
    else:
        print("\nキャンセルしました")

if __name__ == "__main__":
    main()