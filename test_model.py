import os
import torch
from PIL import Image
import numpy as np
import matplotlib.pyplot as plt

def test_yolo_model():
    """YOLOv5モデルで生殖乳頭の検出をテスト"""
    print("YOLOv5モデルをテストします...")
    
    # 現在のディレクトリを保存
    original_dir = os.getcwd()
    
    try:
        # YOLOv5ディレクトリに移動
        os.chdir('yolov5')
        
        # モデルをロード
        model = torch.hub.load('.', 'custom', path='runs/train/exp3/weights/best.pt', source='local')
        
        # 検出の閾値を下げる（小さな値にしてより多くの検出を許可）
        model.conf = 0.1  # 信頼度閾値を10%に設定
        
        # テスト画像を指定
        test_dirs = [
            '../static/images/samples/papillae/male',
            '../static/images/samples/papillae/female'
        ]
        
        # 結果保存用ディレクトリ
        os.makedirs('../test_results', exist_ok=True)
        
        # 各ディレクトリからテスト画像を取得
        test_images = []
        for test_dir in test_dirs:
            if os.path.exists(test_dir):
                images = [os.path.join(test_dir, f) for f in os.listdir(test_dir) 
                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                test_images.extend(images[:3])  # 各ディレクトリから最大3枚
        
        # テスト画像がない場合
        if not test_images:
            print("テスト画像が見つかりません。")
            return
        
        print(f"{len(test_images)}枚のテスト画像を処理します...")
        
        # 各画像を処理
        for i, img_path in enumerate(test_images):
            print(f"\n画像 {i+1}/{len(test_images)}: {os.path.basename(img_path)}")
            
            # 推論実行
            results = model(img_path)
            
            # 検出情報を取得
            detections = results.pandas().xyxy[0]
            
            # 検出数を表示
            detection_count = len(detections)
            print(f"検出数: {detection_count}")
            
            if detection_count > 0:
                print("検出詳細:")
                for j, detection in detections.iterrows():
                    print(f"  検出 {j+1}: 信頼度 {detection['confidence']:.3f}, "
                          f"位置 [{detection['xmin']:.1f}, {detection['ymin']:.1f}, "
                          f"{detection['xmax']:.1f}, {detection['ymax']:.1f}]")
            
            # 検出結果の画像を保存
            img = results.render()[0]  # 検出ボックス付きの画像
            output_path = os.path.join('../test_results', f"result_{i+1}_{os.path.basename(img_path)}")
            
            # PILを使って保存
            Image.fromarray(img).save(output_path)
            print(f"結果を保存: {output_path}")
        
        print("\nテスト完了！結果画像は test_results ディレクトリにあります。")
    
    except Exception as e:
        print(f"エラーが発生しました: {e}")
    
    finally:
        # 元のディレクトリに戻る
        os.chdir(original_dir)

if __name__ == "__main__":
    test_yolo_model()