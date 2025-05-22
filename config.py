"""
アプリケーション設定定数
"""
import os

# ベースディレクトリ
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# データディレクトリ（非公開）
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
EXTRACTED_DIR = os.path.join(DATA_DIR, 'extracted_frames')
DATASET_DIR = os.path.join(DATA_DIR, 'dataset')
MODELS_DIR = os.path.join(DATA_DIR, 'models')

# 静的ファイルディレクトリ（公開）
STATIC_DIR = os.path.join(BASE_DIR, 'static')
STATIC_IMAGES_DIR = os.path.join(STATIC_DIR, 'images')
STATIC_SAMPLES_DIR = os.path.join(STATIC_IMAGES_DIR, 'samples')
STATIC_ANNOTATIONS_DIR = os.path.join(STATIC_IMAGES_DIR, 'annotations')
STATIC_DETECTION_DIR = os.path.join(STATIC_IMAGES_DIR, 'detection_results')
STATIC_EVALUATION_DIR = os.path.join(STATIC_IMAGES_DIR, 'evaluations')

# ログディレクトリ
LOGS_DIR = os.path.join(BASE_DIR, 'logs')

# 旧ディレクトリ（移行用）
LEGACY_SAMPLES_DIR = os.path.join(BASE_DIR, 'samples')
LEGACY_UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
LEGACY_STATIC_UPLOADS_DIR = os.path.join(STATIC_DIR, 'uploads')
LEGACY_ANNOTATIONS_DIR = os.path.join(STATIC_DIR, 'annotations')
LEGACY_MODELS_DIR = os.path.join(BASE_DIR, 'models')

# アプリケーション設定
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
SECRET_KEY = 'your-secret-key-here'
DEBUG = True

# 許可する拡張子
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}

def ensure_directories():
    """必要なディレクトリを作成"""
    directories = [
        DATA_DIR,
        UPLOAD_DIR,
        EXTRACTED_DIR,
        os.path.join(DATASET_DIR, 'male'),
        os.path.join(DATASET_DIR, 'female'),
        os.path.join(MODELS_DIR, 'saved'),
        STATIC_IMAGES_DIR,
        STATIC_SAMPLES_DIR,
        STATIC_ANNOTATIONS_DIR,
        STATIC_DETECTION_DIR,
        STATIC_EVALUATION_DIR,
        LOGS_DIR
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

def get_relative_path(absolute_path, base_dir):
    """絶対パスから相対パスを取得"""
    try:
        return os.path.relpath(absolute_path, base_dir)
    except ValueError:
        return absolute_path