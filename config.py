import os
import json

# アプリケーション情報
APP_VERSION = '1.0.0'
APP_PORT = 8080
DEBUG = True

# ベースディレクトリ
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 各種ディレクトリ（シンプル構造）
STATIC_DIR = os.path.join(BASE_DIR, 'static')
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')

# 学習データ用ディレクトリ（統一）
TRAINING_DATA_DIR = os.path.join(STATIC_DIR, 'training_data')
TRAINING_IMAGES_DIR = os.path.join(TRAINING_DATA_DIR, 'images')
TRAINING_LABELS_DIR = os.path.join(TRAINING_DATA_DIR, 'labels')

# 検出結果ディレクトリ
DETECTION_RESULTS_DIR = os.path.join(STATIC_DIR, 'detection_results')

# YOLOデータセット（自動生成）
YOLO_DATASET_DIR = os.path.join(DATA_DIR, 'yolo_dataset')

# メタデータ
METADATA_FILE = os.path.join(DATA_DIR, 'metadata.json')

# ファイル設定
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
TEMP_FILES_MAX_AGE = 24  # 一時ファイル保持時間（時間）
CLEANUP_INTERVAL_HOURS = 6  # クリーンアップ間隔

# 学習設定のデフォルト値
DEFAULT_BATCH_SIZE = 16
DEFAULT_EPOCHS = 100
DEFAULT_LEARNING_RATE = 0.01
MIN_IMAGES_PER_CLASS = 2  # 最小画像数（クラスごと）

# YOLOv5設定
YOLO_MODEL_WEIGHTS = {
    'nano': 'yolov5n.pt',
    'small': 'yolov5s.pt',
    'medium': 'yolov5m.pt',
    'large': 'yolov5l.pt'
}
DEFAULT_YOLO_MODEL = 'small'
YOLO_IMG_SIZE = 640

# データセット分割比率
TRAIN_VAL_SPLIT_RATIO = 0.8  # 訓練データの比率

def ensure_directories():
    """必要なディレクトリを作成"""
    directories = [
        UPLOAD_DIR,
        TRAINING_DATA_DIR,
        TRAINING_IMAGES_DIR,
        TRAINING_LABELS_DIR,
        DETECTION_RESULTS_DIR,
        DATA_DIR,
        YOLO_DATASET_DIR,
        'logs'
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

def load_metadata():
    """メタデータを読み込む"""
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_metadata(metadata):
    """メタデータを保存する"""
    try:
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        return True
    except:
        return False

def get_latest_yolo_model():
    """最新のYOLOモデルパスを取得"""
    train_dir = os.path.join('yolov5', 'runs', 'train')
    if os.path.exists(train_dir):
        exp_dirs = sorted([d for d in os.listdir(train_dir) if d.startswith('exp')])
        if exp_dirs:
            latest_exp = exp_dirs[-1]
            best_path = os.path.join(train_dir, latest_exp, 'weights', 'best.pt')
            if os.path.exists(best_path):
                return best_path
    return None

# 初期化時にディレクトリを作成
ensure_directories()
