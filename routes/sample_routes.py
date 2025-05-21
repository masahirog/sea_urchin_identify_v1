from flask import Blueprint, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import os
import json
import base64
import traceback

sample_bp = Blueprint('sample', __name__)

@sample_bp.route('/sample/analyze-samples', methods=['GET'])
def analyze_samples_page():
    """サンプル分析ページを表示"""
    from app import app
    
    male_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'male')
    female_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'female')
    
    male_samples = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
    female_samples = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
    
    return render_template('analyze_samples.html', 
                          male_samples=male_samples,
                          female_samples=female_samples)


@sample_bp.route('/sample/analyze-sample', methods=['POST'])
def analyze_sample():
    from app import app
    from utils.image_analysis import analyze_basic_stats, analyze_edge_features, analyze_texture_features, detect_papillae, analyze_shape_features
    
    try:
        data = request.json
        image_path = data['image_path']
        
        # 元のパスから相対パスを取得
        relative_path = image_path.replace('samples/', '')
        
        # アノテーションマッピング情報を取得
        annotation_path = None
        mapping_file = os.path.join('static', 'annotation_mapping.json')
        
        if os.path.exists(mapping_file):
            with open(mapping_file, 'r') as f:
                try:
                    mapping = json.load(f)
                    # 該当のサンプルにアノテーションがあるか確認
                    if relative_path in mapping:
                        annotation_path = os.path.join('static', mapping[relative_path])
                        print(f"アノテーション見つかりました: {annotation_path}")
                except Exception as e:
                    print(f"マッピング読み込みエラー: {str(e)}")
        
        # 通常の画像分析を実行
        basic_stats = analyze_basic_stats(image_path, app.config)
        edge_features = analyze_edge_features(image_path, app.config)
        texture_features = analyze_texture_features(image_path, app.config)
        detection_result = detect_papillae(image_path, app.config)
        
        # アノテーションがある場合は形状特性を計算
        shape_features = {}
        if annotation_path and os.path.exists(annotation_path):
            print(f"アノテーション画像を分析: {annotation_path}")
            shape_features = analyze_shape_features(annotation_path, app.config)
        
        # 結果を返す
        result = {
            'basic_stats': basic_stats,
            'detection_result': detection_result,
            'edge_features': edge_features,
            'texture_features': texture_features
        }
        
        # アノテーション情報があれば追加
        if shape_features:
            result['shape_features'] = shape_features
        
        return jsonify(result)
    
    except Exception as e:
        print(f"分析エラー: {str(e)}")
        traceback.print_exc()  # スタックトレースを出力
        return jsonify({'error': f'分析処理エラー: {str(e)}'}), 500

@sample_bp.route('/upload-sample', methods=['POST'])
def upload_sample():
    from app import app
    from utils.file_handlers import allowed_file, is_image_file
    
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    gender = request.form.get('gender', 'unknown')
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
        filename = secure_filename(file.filename)
        
        # 保存先ディレクトリ
        if gender in ['male', 'female']:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', gender)
        else:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'unknown')
            
        os.makedirs(target_dir, exist_ok=True)
        
        # 保存先パス
        target_path = os.path.join(target_dir, filename)
        file.save(target_path)
        
        return jsonify({
            "success": True, 
            "message": "サンプル画像をアップロードしました",
            "path": target_path
        })
    
    return jsonify({"error": "無効なファイル形式です"}), 400

@sample_bp.route('/<path:path>')
def get_sample(path):
    from app import app
    return send_from_directory(app.config['SAMPLES_FOLDER'], path)

@sample_bp.route('/save-annotation', methods=['POST'])
def save_annotation():
    try:
        print("アノテーション保存リクエスト受信")
        data = request.json
        
        if not data or 'image_data' not in data or 'original_path' not in data:
            print("リクエストデータ不正")
            return jsonify({'error': '必要なデータが不足しています'}), 400
        
        # Base64データを取得
        image_data = data['image_data']
        original_path = data['original_path'].lstrip('/sample/')
        
        print(f"元画像パス: {original_path}")
        
        # 保存先ディレクトリ作成
        base_dir = os.path.join('static', 'samples')
        annotations_dir = os.path.join('static', 'annotations')
        os.makedirs(annotations_dir, exist_ok=True)
        
        # 元画像のフルパス
        original_full_path = os.path.join(base_dir, original_path)
        
        # アノテーション画像のパス生成
        filename = os.path.basename(original_path)
        name, ext = os.path.splitext(filename)
        annotation_filename = f"{name}_annotation{ext}"
        annotation_path = os.path.join(annotations_dir, annotation_filename)
        
        print(f"アノテーション保存先: {annotation_path}")
        
        # Base64データを画像ファイルとして保存
        try:
            # ヘッダー部分を削除（例：'data:image/png;base64,'）
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Base64をデコードして画像ファイルとして保存
            with open(annotation_path, 'wb') as f:
                f.write(base64.b64decode(image_data))
            
            print("アノテーション保存成功")
            
            # データベースや設定ファイルなどにマッピング情報を保存
            # 例: annotation_mapping.json に元画像とアノテーション画像の対応関係を記録
            mapping_file = os.path.join('static', 'annotation_mapping.json')
            mapping = {}
            
            if os.path.exists(mapping_file):
                with open(mapping_file, 'r') as f:
                    try:
                        mapping = json.load(f)
                    except json.JSONDecodeError:
                        mapping = {}
            
            # マッピングを更新
            mapping[original_path] = os.path.join('annotations', annotation_filename)
            
            with open(mapping_file, 'w') as f:
                json.dump(mapping, f, indent=2)
            
            return jsonify({'success': True, 'message': 'アノテーションを保存しました', 'path': annotation_path})
        
        except Exception as e:
            print(f"画像保存エラー: {str(e)}")
            traceback.print_exc()  # スタックトレースを出力
            return jsonify({'error': f'画像保存エラー: {str(e)}'}), 500
    
    except Exception as e:
        print(f"アノテーション保存エラー: {str(e)}")
        traceback.print_exc()  # スタックトレースを出力
        return jsonify({'error': f'アノテーション保存処理エラー: {str(e)}'}), 500

@sample_bp.route('/debug/mapping', methods=['GET'])
def debug_mapping():
    """アノテーションマッピング情報のデバッグ"""
    mapping_file = os.path.join('static', 'annotation_mapping.json')
    
    if not os.path.exists(mapping_file):
        return jsonify({'error': 'マッピングファイルが存在しません'})
    
    try:
        with open(mapping_file, 'r') as f:
            mapping = json.load(f)
        
        # マッピングに登録されている各アノテーションの存在確認
        results = []
        for original_path, annotation_path in mapping.items():
            full_annotation_path = os.path.join('static', annotation_path)
            results.append({
                'original_path': original_path,
                'annotation_path': annotation_path,
                'exists': os.path.exists(full_annotation_path)
            })
        
        return jsonify({
            'mapping_file': mapping_file,
            'entries': results
        })
    except Exception as e:
        traceback.print_exc()  # スタックトレースを出力
        return jsonify({'error': f'マッピング読み込みエラー: {str(e)}'})