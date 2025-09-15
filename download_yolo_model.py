"""
YOLOv5モデルのダウンロードスクリプト
"""
import torch
import os

def download_yolo_model():
    """YOLOv5sモデルをダウンロード"""
    print("YOLOv5sモデルをダウンロード中...")

    # YOLOv5ディレクトリに移動
    os.chdir('yolov5')

    # YOLOv5sモデルをダウンロード
    model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)

    # モデルを保存
    torch.save(model.state_dict(), 'yolov5s.pt')

    print("YOLOv5sモデルのダウンロード完了")
    print("保存先: yolov5/yolov5s.pt")

    # 元のディレクトリに戻る
    os.chdir('..')

    return True

if __name__ == "__main__":
    try:
        # 直接URLからダウンロード（より簡単な方法）
        import urllib.request

        model_url = "https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5s.pt"
        save_path = "yolov5/yolov5s.pt"

        print(f"YOLOv5sモデルをダウンロード中...")
        print(f"URL: {model_url}")

        urllib.request.urlretrieve(model_url, save_path)

        # ファイルサイズ確認
        file_size = os.path.getsize(save_path) / (1024 * 1024)  # MB
        print(f"ダウンロード完了: {save_path}")
        print(f"ファイルサイズ: {file_size:.1f} MB")

    except Exception as e:
        print(f"エラー: {e}")
        print("手動でダウンロードしてください: https://github.com/ultralytics/yolov5/releases")