from core.PapillaeDetector import PapillaeDetector

# データ変換を実行
detector = PapillaeDetector()
result = detector.prepare_training_data(
    source_dir='static/images/annotations',
    target_dir='data/yolo_dataset',
    split_ratio=0.8  # 訓練80%、検証20%
)

print(f"データ変換結果: {result}")
