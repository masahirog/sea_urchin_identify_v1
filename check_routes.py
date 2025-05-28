# routes/learning_fixed.py
# 既存のlearning.pyの最初の部分に追加

from flask import Blueprint, request, jsonify, render_template, current_app
import os
import json
import traceback

learning_bp = Blueprint('learning', __name__, url_prefix='/learning')

# シンプルなテストルート
@learning_bp.route('/test')
def test_route():
    """テスト用ルート"""
    return jsonify({"message": "Learning routes are working!"})

# クイック学習ルート（シンプル版）
@learning_bp.route('/quick-train', methods=['POST'])
def quick_train_simple():
    """RandomForestモデルの簡易学習"""
    try:
        from core.analyzer import UnifiedAnalyzer
        import uuid
        
        # メタデータ確認
        from config import TRAINING_IMAGES_DIR, METADATA_FILE
        
        metadata = {}
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        
        # 画像数カウント
        male_count = sum(1 for v in metadata.values() if v.get('gender') == 'male')
        female_count = sum(1 for v in metadata.values() if v.get('gender') == 'female')
        
        if male_count < 2 or female_count < 2:
            return jsonify({
                "error": f"学習データが不足しています。オス: {male_count}枚, メス: {female_count}枚"
            }), 400
        
        # 学習実行
        analyzer = UnifiedAnalyzer()
        task_id = str(uuid.uuid4())
        
        current_app.logger.info(f"クイック学習開始: オス{male_count}枚, メス{female_count}枚")
        
        success = analyzer.train_model(None, task_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "学習が完了しました",
                "male_count": male_count,
                "female_count": female_count
            })
        else:
            return jsonify({
                "error": "学習に失敗しました"
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"学習エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# 既存のルートもここに含める（重要）
# ... 既存のコード ...