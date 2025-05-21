"""
ウニ生殖乳頭分析システム - ファイル処理ユーティリティ
ファイル拡張子の検証や種類判別などの機能を提供する
"""

def allowed_file(filename, allowed_extensions):
    """
    ファイル名の拡張子が許可されているかを検証する

    Parameters:
    - filename: 検証するファイル名
    - allowed_extensions: 許可する拡張子のセット {'jpg', 'png', ...}

    Returns:
    - bool: 拡張子が許可されているかどうか
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def get_file_extension(filename):
    """
    ファイル名から拡張子を取得する
    
    Parameters:
    - filename: 対象のファイル名
    
    Returns:
    - str: 小文字の拡張子（例: 'jpg'）、拡張子がない場合は空文字列
    """
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''


def is_video_file(filename):
    """
    ファイルが動画ファイルかどうかを判定する
    
    Parameters:
    - filename: 対象のファイル名
    
    Returns:
    - bool: 動画ファイルかどうか
    """
    ext = get_file_extension(filename)
    return ext in {'mp4', 'avi', 'mov', 'mkv'}


def is_image_file(filename):
    """
    ファイルが画像ファイルかどうかを判定する
    
    Parameters:
    - filename: 対象のファイル名
    
    Returns:
    - bool: 画像ファイルかどうか
    """
    ext = get_file_extension(filename)
    return ext in {'jpg', 'jpeg', 'png'}


def get_safe_filename(filename):
    """
    安全なファイル名に変換する（スペースや特殊文字を除去）
    
    Parameters:
    - filename: 元のファイル名
    
    Returns:
    - str: 安全なファイル名
    """
    # ASCII以外の文字をアンダースコアに置換
    import re
    safe_name = re.sub(r'[^\w\.\-]', '_', filename)
    
    # 複数のアンダースコアを一つにまとめる
    safe_name = re.sub(r'_+', '_', safe_name)
    
    return safe_name