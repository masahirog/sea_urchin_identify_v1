import os

# ベースディレクトリ
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==================== データディレクトリ（非公開）====================
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')              # 一時アップロード
EXTRACTED_DIR = os.path.join(DATA_DIR, 'extracted_frames')  # 抽出画像
DATASET_DIR = os.path.join(DATA_DIR, 'dataset')             # 学習データ
MODELS_DIR = os.path.join(DATA_DIR, 'models')               # モデル
EVALUATION_DATA_DIR = os.path.join(DATA_DIR, 'evaluations') # 評価JSON

# ==================== 静的ディレクトリ（公開）====================
STATIC_DIR = os.path.join(BASE_DIR, 'static')
STATIC_IMAGES_DIR = os.path.join(STATIC_DIR, 'images')
STATIC_SAMPLES_DIR = os.path.join(STATIC_IMAGES_DIR, 'samples')           # 恒久サンプル
STATIC_ANNOTATIONS_DIR = os.path.join(STATIC_IMAGES_DIR, 'annotations')   # アノテーション
STATIC_DETECTION_DIR = os.path.join(STATIC_IMAGES_DIR, 'detection_results') # 検出結果
STATIC_EVALUATION_DIR = os.path.join(STATIC_IMAGES_DIR, 'evaluations')    # 評価グラフ


# ==================== アプリケーション設定 ====================
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
SECRET_KEY = 'your-secret-key-here'
DEBUG = True

# 許可する拡張子
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}

# YOLOv5関連の設定
YOLO_DIR = 'yolov5'
YOLO_DATASET_DIR = 'data/yolo_dataset'
YOLO_IMAGES_DIR = os.path.join(YOLO_DATASET_DIR, 'images')
YOLO_LABELS_DIR = os.path.join(YOLO_DATASET_DIR, 'labels')
YOLO_TRAIN_IMAGES_DIR = os.path.join(YOLO_IMAGES_DIR, 'train')
YOLO_TRAIN_LABELS_DIR = os.path.join(YOLO_LABELS_DIR, 'train')
YOLO_VAL_IMAGES_DIR = os.path.join(YOLO_IMAGES_DIR, 'val')
YOLO_VAL_LABELS_DIR = os.path.join(YOLO_LABELS_DIR, 'val')

UPLOAD_FOLDER = 'data/uploads'
STATIC_FOLDER = 'static'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
STATIC_SAMPLES_DIR = os.path.join(STATIC_FOLDER, 'images/samples')

def ensure_directories():
    """必要なディレクトリを作成"""
    directories = [
        # データディレクトリ（非公開）
        DATA_DIR,
        UPLOAD_DIR,
        EXTRACTED_DIR,
        os.path.join(DATASET_DIR, 'male'),
        os.path.join(DATASET_DIR, 'female'),
        os.path.join(MODELS_DIR, 'saved'),
        EVALUATION_DATA_DIR,
        
        # 静的ディレクトリ（公開）
        STATIC_IMAGES_DIR,
        os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'male'),
        os.path.join(STATIC_SAMPLES_DIR, 'papillae', 'female'),
        STATIC_ANNOTATIONS_DIR,
        STATIC_DETECTION_DIR,
        STATIC_EVALUATION_DIR
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"ディレクトリ確認/作成: {directory}")

def get_relative_path(absolute_path, base_dir):
    """絶対パスから相対パスを取得"""
    try:
        return os.path.relpath(absolute_path, base_dir)
    except ValueError:
        return absolute_path

if __name__ == "__main__":
    print("ディレクトリ構造の統一を開始...")
    ensure_directories()
    migrate_legacy_directories()
    cleanup_legacy_paths()
    print("完了。関連ファイルの修正を行ってください。")