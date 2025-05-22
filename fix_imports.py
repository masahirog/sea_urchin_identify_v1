#!/usr/bin/env python3
"""
import文自動修正スクリプト
フェーズ2統合により変更された import文を自動修正
"""

import re
from pathlib import Path

class ImportFixer:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.base_dir = Path.cwd()
        self.fixes_applied = 0
        
        # 修正ルール定義
        self.import_fixes = [
            # models/analyzer.py → core/analyzer.py
            {
                'old_pattern': r'from models\.analyzer import UrchinPapillaeAnalyzer',
                'new_import': 'from core.analyzer import UnifiedAnalyzer as UrchinPapillaeAnalyzer',
                'description': 'models.analyzer → core.analyzer (統合アナライザー)'
            },
            {
                'old_pattern': r'from models\.analyzer import PapillaeAnalyzer',
                'new_import': 'from core.analyzer import UnifiedAnalyzer as PapillaeAnalyzer',
                'description': 'models.analyzer → core.analyzer (PapillaeAnalyzer)'
            },
            
            # utils/image_analysis.py → core/processor.py (detect_papillae)
            {
                'old_pattern': r'from utils\.image_analysis import detect_papillae',
                'new_import': 'from core.processor import UnifiedProcessor\n# detect_papillae は UnifiedProcessor().detect_papillae() に変更が必要',
                'description': 'utils.image_analysis.detect_papillae → core.processor (要手動修正)'
            },
            
            # utils/image_analysis.py → core/processor.py (analyze_shape_features)
            {
                'old_pattern': r'from utils\.image_analysis import analyze_shape_features',
                'new_import': 'from core.processor import UnifiedProcessor\n# analyze_shape_features は UnifiedProcessor().analyze_shape_features() に変更が必要',
                'description': 'utils.image_analysis.analyze_shape_features → core.processor (要手動修正)'
            }
        ]

    def run(self):
        """修正処理のメイン実行"""
        print(f"🔧 import文自動修正{'（ドライラン）' if self.dry_run else ''}を開始")
        print()
        
        # 修正対象ファイルを特定
        target_files = [
            'cli.py',
            'utils/worker.py', 
            'routes/image_routes.py',
            'models/analyzer.py'  # 自分自身の参照もチェック
        ]
        
        for file_path in target_files:
            self._fix_file_imports(file_path)
        
        print()
        if self.dry_run:
            print(f"✅ ドライラン完了。{self.fixes_applied}件の修正候補が見つかりました。")
            print("実際に修正するには --fix オプションを使用してください。")
        else:
            print(f"✅ import文修正完了。{self.fixes_applied}件を修正しました。")

    def _fix_file_imports(self, file_path):
        """指定ファイルのimport文を修正"""
        full_path = self.base_dir / file_path
        
        if not full_path.exists():
            print(f"⚠️  {file_path} が見つかりません")
            return
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            file_fixes = 0
            
            print(f"🔍 {file_path} をチェック中...")
            
            # 各修正ルールを適用
            for fix_rule in self.import_fixes:
                pattern = fix_rule['old_pattern']
                replacement = fix_rule['new_import']
                description = fix_rule['description']
                
                matches = re.findall(pattern, content, re.MULTILINE)
                if matches:
                    print(f"  📝 {description}")
                    print(f"     置換: {len(matches)}箇所")
                    
                    if not self.dry_run:
                        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
                    
                    file_fixes += len(matches)
                    self.fixes_applied += len(matches)
            
            # ファイルに書き戻し
            if file_fixes > 0 and not self.dry_run:
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"  ✅ {file_fixes}件の修正を適用しました")
            elif file_fixes > 0:
                print(f"  📋 {file_fixes}件の修正候補があります")
            else:
                print(f"  ✨ 修正不要です")
                
        except Exception as e:
            print(f"  ❌ エラー: {e}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="import文自動修正")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', 
                      help='修正候補を表示するが実際には修正しない')
    group.add_argument('--fix', action='store_true', 
                      help='実際にimport文を修正する')
    
    args = parser.parse_args()
    
    fixer = ImportFixer(dry_run=args.dry_run)
    fixer.run()

if __name__ == "__main__":
    main()