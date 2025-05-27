"""
utilsからapp_utilsへのインポート修正スクリプト
"""

import os
import re

def fix_imports_in_file(filepath):
    """ファイル内のインポート文を修正"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # インポート文を置換
    original_content = content
    content = re.sub(r'from utils\.', 'from app_utils.', content)
    content = re.sub(r'import utils\.', 'import app_utils.', content)
    
    # 変更があった場合のみ書き込み
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ 修正: {filepath}")
        return True
    return False

def main():
    """メイン処理"""
    modified_count = 0
    
    # 修正対象のディレクトリ
    target_dirs = ['.', 'routes', 'core', 'app_utils', 'templates', 'static']
    
    for target_dir in target_dirs:
        if not os.path.exists(target_dir):
            continue
            
        for root, dirs, files in os.walk(target_dir):
            # .gitやvenvなどは除外
            if any(skip in root for skip in ['.git', 'venv', '__pycache__', 'yolov5']):
                continue
                
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)
                    if fix_imports_in_file(filepath):
                        modified_count += 1
    
    print(f"\n完了: {modified_count}個のファイルを修正しました")

if __name__ == "__main__":
    main()