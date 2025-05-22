"""
統一された画像ディレクトリ構造とconfig.py修正版

新しいディレクトリ構造:
/data/                     # 非公開データ（Gitignore対象）
├── uploads/              # 一時アップロード（24時間で自動削除）
├── extracted_frames/     # 動画から抽出した画像
├── dataset/              # 学習用データセット
│   ├── male/
│   └── female/
├── models/               # 学習済みモデル
└── evaluations/          # 評価結果JSON

/static/images/           # 公開画像（Web配信用）
├── samples/              # 恒久的なサンプル画像
│   └── papillae/
│       ├── male/
│       └── female/
├── annotations/          # アノテーション結果画像
├── detection_results/    # 検出結果画像
└── evaluations/          # 評価結果グラフ
"""

# config.py の統一修正版
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

# ==================== 旧ディレクトリ（削除対象）====================
# これらは削除する
LEGACY_SAMPLES_DIR = os.path.join(BASE_DIR, 'samples')        # 削除対象
LEGACY_UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')        # 削除対象  
LEGACY_STATIC_UPLOADS_DIR = os.path.join(STATIC_DIR, 'uploads') # 削除対象

# ==================== アプリケーション設定 ====================
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
SECRET_KEY = 'your-secret-key-here'
DEBUG = True

# 許可する拡張子
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}

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

def migrate_legacy_directories():
    """旧ディレクトリから新ディレクトリへのデータ移行"""
    import shutil
    
    # samplesディレクトリの移行
    if os.path.exists(LEGACY_SAMPLES_DIR):
        print(f"samplesディレクトリを移行中: {LEGACY_SAMPLES_DIR} -> {STATIC_SAMPLES_DIR}")
        
        # papillaeディレクトリの移行
        legacy_papillae = os.path.join(LEGACY_SAMPLES_DIR, 'papillae')
        if os.path.exists(legacy_papillae):
            new_papillae = os.path.join(STATIC_SAMPLES_DIR, 'papillae')
            
            # male/femaleディレクトリの移行
            for gender in ['male', 'female']:
                legacy_gender_dir = os.path.join(legacy_papillae, gender)
                new_gender_dir = os.path.join(new_papillae, gender)
                
                if os.path.exists(legacy_gender_dir):
                    os.makedirs(new_gender_dir, exist_ok=True)
                    
                    # ファイルを移行
                    for filename in os.listdir(legacy_gender_dir):
                        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                            legacy_file = os.path.join(legacy_gender_dir, filename)
                            new_file = os.path.join(new_gender_dir, filename)
                            
                            if not os.path.exists(new_file):
                                shutil.move(legacy_file, new_file)
                                print(f"移行: {filename}")
        
        # 移行完了後、旧ディレクトリを削除
        try:
            shutil.rmtree(LEGACY_SAMPLES_DIR)
            print(f"旧samplesディレクトリを削除: {LEGACY_SAMPLES_DIR}")
        except Exception as e:
            print(f"旧samplesディレクトリ削除エラー: {e}")
    
    # uploadsディレクトリの削除（一時ファイルなので移行不要）
    if os.path.exists(LEGACY_UPLOADS_DIR):
        try:
            shutil.rmtree(LEGACY_UPLOADS_DIR)
            print(f"旧uploadsディレクトリを削除: {LEGACY_UPLOADS_DIR}")
        except Exception as e:
            print(f"旧uploadsディレクトリ削除エラー: {e}")
    
    # static/uploadsディレクトリの削除
    if os.path.exists(LEGACY_STATIC_UPLOADS_DIR):
        try:
            shutil.rmtree(LEGACY_STATIC_UPLOADS_DIR)
            print(f"static/uploadsディレクトリを削除: {LEGACY_STATIC_UPLOADS_DIR}")
        except Exception as e:
            print(f"static/uploads削除エラー: {e}")

def cleanup_legacy_paths():
    """旧パス参照のクリーンアップ確認"""
    print("=== 旧パス参照の確認が必要なファイル ===")
    files_to_check = [
        "app.py",
        "routes/sample_routes.py", 
        "routes/image_routes.py",
        "templates/analyze_samples.html",
        "static/js/sample_analysis.js"
    ]
    
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"要確認: {file_path}")
            print("  - LEGACY_SAMPLES_DIR, LEGACY_UPLOADS_DIRの参照を削除")
            print("  - パス参照を新しい構造に変更")

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