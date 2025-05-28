# routes/training.py

from flask import Blueprint, render_template

training_bp = Blueprint('training', __name__, url_prefix='/training')

@training_bp.route('/')
def training_page():
    """学習実行ページ（簡略版）"""
    return render_template('training_simple.html')

@training_bp.route('/advanced')
def advanced_training_page():
    """詳細学習実行ページ（YOLO）"""
    return render_template('training_execution.html')