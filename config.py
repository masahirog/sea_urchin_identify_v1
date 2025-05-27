import os

# ベースディレクトリ
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 各種ディレクトリ（シンプル構造）
STATIC_DIR = os.path.join(BASE_DIR, 'static')
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# 学習データ用ディレクトリ（統一）
TRAINING_DATA_DIR = os.path.join(STATIC_DIR, 'training_data')
TRAINING_IMAGES_DIR = os.path.join(TRAINING_DATA_DIR, 'images')
TRAINING_LABELS_DIR = os.path.join(TRAINING_DATA_DIR, 'labels')

# 検出結果ディレクトリ
DETECTION_RESULTS_DIR = os.path.join(STATIC_DIR, 'detection_results')

# 評価結果ディレクトリ
STATIC_EVALUATION_DIR = os.path.join(STATIC_DIR, 'evaluation')
EVALUATION_DATA_DIR = os.path.join(DATA_DIR, 'evaluation')

# YOLOデータセット（自動生成）
YOLO_DATASET_DIR = os.path.join(DATA_DIR, 'yolo_dataset')

# メタデータ
METADATA_FILE = os.path.join(DATA_DIR, 'metadata.json')

# 古い設定（後方互換性のため一時的に残す）
STATIC_SAMPLES_DIR = os.path.join(STATIC_DIR, 'images/samples')
STATIC_IMAGES_DIR = os.path.join(STATIC_DIR, 'images')
STATIC_ANNOTATIONS_DIR = os.path.join(STATIC_DIR, 'images/annotations')
TRAINING_DATA_MALE = os.path.join(STATIC_SAMPLES_DIR, 'papillae/male')
TRAINING_DATA_FEMALE = os.path.join(STATIC_SAMPLES_DIR, 'papillae/female')

# その他の設定
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
DEBUG = True

def ensure_directories():
    """必要なディレクトリを作成"""
    directories = [
        UPLOAD_DIR,
        MODELS_DIR,
        os.path.join(MODELS_DIR, 'saved'),
        TRAINING_DATA_DIR,
        TRAINING_IMAGES_DIR,
        TRAINING_LABELS_DIR,
        DETECTION_RESULTS_DIR,
        STATIC_EVALUATION_DIR,
        EVALUATION_DATA_DIR,
        DATA_DIR,
        YOLO_DATASET_DIR,
        # 古いディレクトリ（移行期間中）
        STATIC_SAMPLES_DIR,
        STATIC_ANNOTATIONS_DIR,
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)