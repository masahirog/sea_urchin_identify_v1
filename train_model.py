from core.PapillaeDetector import PapillaeDetector

# モデルの訓練
detector = PapillaeDetector()
result = detector.train_detector(
    train_data_dir='data/yolo_dataset',
    epochs=100,
    batch_size=16,
    img_size=640
)

print(f"訓練結果: {result}")