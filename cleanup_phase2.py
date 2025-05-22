#!/usr/bin/env python3
"""
ウニ生殖乳頭分析システム - 安全なファイル削除スクリプト
フェーズ2統合完了後の不要ファイル削除

使用法:
python cleanup_phase2.py --dry-run  # 削除対象確認（実際には削除しない）
python cleanup_phase2.py --delete   # 実際に削除実行
"""

import os
import shutil
import argparse
from pathlib import Path
import ast
import re

class SafeFileDeleter:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.base_dir = Path.cwd()
        
        # 削除対象ファイル（フェーズ2統合により不要になったもの）
        self.files_to_delete = [
            "utils/image_processing.py",  # → core/processor.py に統合
            "utils/model_evaluation.py", # → core/evaluator.py に統合
        ]
        
        # 要確認ファイル（参照がある可能性）
        self.files_to_check = [
            "utils/image_analysis.py",   # 部分的に統合、残り要確認
            "models/analyzer.py",        # → core/analyzer.py に統合、import要更新
        ]
        
        # 検索対象ファイル（import文や参照をチェック）
        self.search_extensions = ['.py']
        self.exclude_dirs = {'.git', '__pycache__', '.pytest_cache', 'venv', 'env'}

    def run(self):
        """削除処理のメイン実行"""
        print(f"🔍 フェーズ2統合後のファイル削除{'（ドライラン）' if self.dry_run else ''}を開始")
        print(f"📂 作業ディレクトリ: {self.base_dir}")
        print()
        
        # ステップ1: 即座に削除可能なファイル
        self._delete_safe_files()
        
        # ステップ2: 要確認ファイルの参照チェック
        self._check_file_references()
        
        print()
        if self.dry_run:
            print("✅ ドライラン完了。実際に削除するには --delete オプションを使用してください。")
        else:
            print("✅ ファイル削除完了。")
    
    def _delete_safe_files(self):
        """安全に削除可能なファイルの削除"""
        print("📋 即座に削除可能なファイル:")
        
        for file_path in self.files_to_delete:
            full_path = self.base_dir / file_path
            
            if full_path.exists():
                print(f"  🗑️  {file_path}")
                if not self.dry_run:
                    full_path.unlink()
                    print(f"      ✅ 削除完了")
            else:
                print(f"  ⚠️  {file_path} （ファイルが見つかりません）")
    
    def _check_file_references(self):
        """要確認ファイルの参照チェック"""
        print("\n📋 要確認ファイル（参照チェック）:")
        
        for file_path in self.files_to_check:
            print(f"\n🔍 {file_path} の参照チェック:")
            
            full_path = self.base_dir / file_path
            if not full_path.exists():
                print(f"  ⚠️  ファイルが見つかりません")
                continue
            
            references = self._find_references(file_path)
            
            if references:
                print(f"  ❌ 参照が見つかりました（削除前に修正が必要）:")
                for ref_file, lines in references.items():
                    print(f"    📄 {ref_file}:")
                    for line_num, line_content in lines:
                        print(f"      L{line_num}: {line_content.strip()}")
            else:
                print(f"  ✅ 参照が見つかりませんでした（削除可能）")
                if not self.dry_run:
                    full_path.unlink()
                    print(f"  🗑️  削除完了")
    
    def _find_references(self, target_file):
        """指定ファイルへの参照を検索"""
        references = {}
        
        # ファイル名（拡張子なし）を取得
        file_stem = Path(target_file).stem
        module_path = target_file.replace('/', '.').replace('.py', '')
        
        # パターン定義
        patterns = [
            rf'from\s+{re.escape(module_path)}\s+import',  # from utils.image_processing import
            rf'import\s+{re.escape(module_path)}',          # import utils.image_processing
            rf'from\s+.*{re.escape(file_stem)}\s+import',   # from xxx.image_processing import
            rf'{re.escape(file_stem)}\.',                   # image_processing.function()
        ]
        
        # 全Pythonファイルを検索
        for py_file in self._get_python_files():
            if py_file.name == Path(target_file).name:
                continue  # 自分自身はスキップ
                
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                file_references = []
                for line_num, line in enumerate(lines, 1):
                    for pattern in patterns:
                        if re.search(pattern, line):
                            file_references.append((line_num, line))
                            break
                
                if file_references:
                    rel_path = py_file.relative_to(self.base_dir)
                    references[str(rel_path)] = file_references
                    
            except Exception as e:
                print(f"    ⚠️  {py_file} 読み込みエラー: {e}")
        
        return references
    
    def _get_python_files(self):
        """Pythonファイル一覧を取得"""
        python_files = []
        
        for root, dirs, files in os.walk(self.base_dir):
            # 除外ディレクトリをスキップ
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for file in files:
                if file.endswith('.py'):
                    python_files.append(Path(root) / file)
        
        return python_files

def main():
    parser = argparse.ArgumentParser(description="フェーズ2統合後の安全なファイル削除")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', 
                      help='削除対象を表示するが実際には削除しない（安全確認用）')
    group.add_argument('--delete', action='store_true', 
                      help='実際にファイルを削除する')
    
    args = parser.parse_args()
    
    # 削除実行
    deleter = SafeFileDeleter(dry_run=args.dry_run)
    deleter.run()

if __name__ == "__main__":
    main()