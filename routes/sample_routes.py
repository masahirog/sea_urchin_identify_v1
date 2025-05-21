"""
ウニ生殖乳頭分析システム - サンプル分析ルート
サンプル画像の分析とアノテーション機能を提供する
"""

from flask import Blueprint, request, jsonify, render_template, send_from_directory, current_app
from werkzeug.utils import secure_filename
import os
import json
import base64
import traceback
import uuid

sample_bp = Blueprint('sample', __name__)
print("sample_routes.py が読み込まれました")


@sample_bp.route('/analyze-samples', methods=['GET'])
def analyze_samples_page():
    """サンプル分析ページを表示"""
    print("analyze_samples_page が呼び出されました")
    from app import app
    
    # サンプル画像の取得
    male_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'male')
    female_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'female')
    
    male_samples = [f for f in os.listdir(male_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(male_dir) else []
    female_samples = [f for f in os.listdir(female_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(female_dir) else []
    
    return render_template('analyze_samples.html', 
                          male_samples=male_samples,
                          female_samples=female_samples)


@sample_bp.route('/analyze-sample', methods=['POST'])
def analyze_sample():
    """
    サンプル画像を分析
    
    Request:
    - image_path: 分析するサンプル画像のパス
    
    Returns:
    - JSON: 分析結果
    """
    print("analyze_sample エンドポイントが呼び出されました")
    current_app.logger.info("analyze_sample エンドポイントが呼び出されました")
    
    from app import app
    from utils.image_analysis import analyze_basic_stats, analyze_edge_features, analyze_texture_features, detect_papillae, analyze_shape_features
    
    try:
        data = request.json
        current_app.logger.info(f"受信したリクエストデータ: {data}")
        
        if not data or 'image_path' not in data:
            return jsonify({"error": "画像パスが指定されていません"}), 400
        
        image_path = data['image_path']
        current_app.logger.info(f"分析対象画像パス: {image_path}")
        
        # パスの検証
        if '..' in image_path:
            current_app.logger.warning(f"不正なパスへのアクセス試行: {image_path}")
            return jsonify({"error": "不正なパスです"}), 400
        
        # 元のパスから相対パスを取得
        relative_path = image_path
        if image_path.startswith('samples/'):
            relative_path = image_path
        elif image_path.startswith('/sample/'):
            relative_path = image_path.lstrip('/sample/')
        
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
                        current_app.logger.debug(f"アノテーション見つかりました: {annotation_path}")
                except Exception as e:
                    current_app.logger.error(f"マッピング読み込みエラー: {str(e)}")
        
        # ★★★ ここを修正 ★★★
        # 画像パスの正しい処理
        full_image_path = None
        
        # パターン1: 'papillae/male/xxx.png' -> 'static/samples/papillae/male/xxx.png'
        if image_path.startswith('papillae/'):
            full_image_path = os.path.join('static', 'samples', image_path)
        # パターン2: 'samples/papillae/male/xxx.png' -> 'static/samples/papillae/male/xxx.png'  
        elif image_path.startswith('samples/'):
            full_image_path = os.path.join('static', image_path)
        # パターン3: 絶対パスの場合はそのまま
        elif os.path.isabs(image_path):
            full_image_path = image_path
        # パターン4: その他の場合は static/ を前に付ける
        else:
            full_image_path = os.path.join('static', image_path)
        
        current_app.logger.info(f"フルパス: {full_image_path}, 存在チェック: {os.path.exists(full_image_path)}")
            
        if not os.path.exists(full_image_path):
            return jsonify({"error": f"画像ファイルが見つかりません: {image_path} (変換先: {full_image_path})"}), 404
        
        # 通常の画像分析を実行
        basic_stats = analyze_basic_stats(full_image_path, app.config)
        edge_features = analyze_edge_features(full_image_path, app.config)
        texture_features = analyze_texture_features(full_image_path, app.config)
        detection_result = detect_papillae(full_image_path, app.config)
        
        # アノテーションがある場合は形状特性を計算
        shape_features = {}
        if annotation_path and os.path.exists(annotation_path):
            current_app.logger.debug(f"アノテーション画像を分析: {annotation_path}")
            shape_features = analyze_shape_features(annotation_path, app.config)
        
        # 結果を返す
        result = {
            'basic_stats': basic_stats,
            'detection_result': detection_result,
            'edge_features': edge_features,
            'texture_features': texture_features,
            'image_path': image_path
        }
        
        if annotation_path and os.path.exists(annotation_path):
            result['annotation_path'] = annotation_path.replace('static/', '')
            if shape_features:
                result['shape_features'] = shape_features

        current_app.logger.info("分析結果を返却します")
        return jsonify(result)
    
    except Exception as e:
        current_app.logger.error(f"サンプル分析エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'分析処理エラー: {str(e)}'}), 500

# デバッグ用: ルート一覧を表示
@sample_bp.route('/debug-routes', methods=['GET'])
def debug_routes():
    """デバッグ用: 登録されているルートを確認"""
    routes = []
    for rule in current_app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    return jsonify(routes)

@sample_bp.route('/upload-sample', methods=['POST'])
def upload_sample():
    """
    サンプル画像をアップロード
    
    Request:
    - image: アップロードするサンプル画像
    - gender: 性別カテゴリ ('male', 'female', または 'unknown')
    
    Returns:
    - JSON: アップロード結果
    """
    from app import app
    from utils.file_handlers import allowed_file, is_image_file
    
    if 'image' not in request.files:
        return jsonify({"error": "画像ファイルがありません"}), 400
        
    file = request.files['image']
    gender = request.form.get('gender', 'unknown')
    
    if file.filename == '':
        return jsonify({"error": "ファイルが選択されていません"}), 400
    
    if file and allowed_file(file.filename, app.config['ALLOWED_EXTENSIONS']) and is_image_file(file.filename):
        # 安全なファイル名に変換
        filename = secure_filename(file.filename)
        
        # 保存先ディレクトリ
        if gender in ['male', 'female']:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', gender)
        else:
            target_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae', 'unknown')
        
        # ディレクトリが存在しない場合は作成
        os.makedirs(target_dir, exist_ok=True)
        
        # 同名ファイルが既に存在する場合はユニークな名前に変更
        target_path = os.path.join(target_dir, filename)
        if os.path.exists(target_path):
            name, ext = os.path.splitext(filename)
            unique_suffix = uuid.uuid4().hex[:8]
            filename = f"{name}_{unique_suffix}{ext}"
            target_path = os.path.join(target_dir, filename)
        
        # ファイルを保存
        file.save(target_path)
        current_app.logger.info(f"サンプル画像をアップロード: {gender}/{filename}")
        
        # サンプルパス
        sample_path = os.path.join('papillae', gender, filename)
        
        return jsonify({
            "success": True, 
            "message": "サンプル画像をアップロードしました",
            "path": sample_path,
            "filename": filename
        })
    
    return jsonify({"error": "無効なファイル形式です"}), 400


@sample_bp.route('/<path:path>')
def get_sample(path):
    """
    サンプル画像ファイルを提供
    
    Parameters:
    - path: サンプル画像の相対パス
    
    Returns:
    - Response: 画像ファイル
    """
    from app import app
    
    # パスの検証
    if '..' in path or path.startswith('/'):
        current_app.logger.warning(f"不正なパスへのアクセス試行: {path}")
        return jsonify({"error": "不正なパスです"}), 400
    
    return send_from_directory(app.config['SAMPLES_FOLDER'], path)


@sample_bp.route('/save-annotation', methods=['POST'])
def save_annotation():
    """
    アノテーション画像を保存
    
    Request:
    - image_data: Base64エンコードされたアノテーション画像データ
    - original_path: 元のサンプル画像パス
    
    Returns:
    - JSON: 保存結果
    """
    try:
        current_app.logger.info("アノテーション保存リクエスト受信")
        data = request.json
        
        if not data or 'image_data' not in data or 'original_path' not in data:
            return jsonify({'error': '必要なデータが不足しています'}), 400
        
        # Base64データを取得
        image_data = data['image_data']
        original_path = data['original_path'].lstrip('/sample/')
        
        current_app.logger.debug(f"元画像パス: {original_path}")
        
        # パスの検証
        if '..' in original_path:
            current_app.logger.warning(f"不正なパスへのアクセス試行: {original_path}")
            return jsonify({"error": "不正なパスです"}), 400
        
        # 保存先ディレクトリ作成
        annotations_dir = os.path.join('static', 'annotations')
        os.makedirs(annotations_dir, exist_ok=True)
        
        # アノテーション画像のパス生成
        filename = os.path.basename(original_path)
        name, ext = os.path.splitext(filename)
        annotation_filename = f"{name}_annotation{ext}"
        
        # 同名ファイルが存在する場合はユニークな名前に変更
        annotation_path = os.path.join(annotations_dir, annotation_filename)
        if os.path.exists(annotation_path):
            unique_suffix = uuid.uuid4().hex[:8]
            annotation_filename = f"{name}_annotation_{unique_suffix}{ext}"
            annotation_path = os.path.join(annotations_dir, annotation_filename)
        
        current_app.logger.debug(f"アノテーション保存先: {annotation_path}")
        
        # Base64データを画像ファイルとして保存
        try:
            # ヘッダー部分を削除（例：'data:image/png;base64,'）
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Base64をデコードして画像ファイルとして保存
            with open(annotation_path, 'wb') as f:
                f.write(base64.b64decode(image_data))
            
            current_app.logger.info("アノテーション保存成功")
            
            # マッピング情報を更新
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
            
            return jsonify({
                'success': True, 
                'message': 'アノテーションを保存しました', 
                'path': annotation_path.replace('static/', '')
            })
        
        except Exception as e:
            current_app.logger.error(f"画像保存エラー: {str(e)}")
            traceback.print_exc()
            return jsonify({'error': f'画像保存エラー: {str(e)}'}), 500
    
    except Exception as e:
        current_app.logger.error(f"アノテーション保存エラー: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'アノテーション保存処理エラー: {str(e)}'}), 500


@sample_bp.route('/debug/mapping', methods=['GET'])
def debug_mapping():
    """
    アノテーションマッピング情報のデバッグ
    
    Returns:
    - JSON: マッピング情報診断結果
    """
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
            'entries': results,
            'count': len(mapping)
        })
    except Exception as e:
        current_app.logger.error(f"マッピングデバッグエラー: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'マッピング読み込みエラー: {str(e)}'})


@sample_bp.route('/debug-paths', methods=['GET'])
def debug_paths():
    """
    パス変換デバッグ用
    
    Returns:
    - JSON: サンプルパス変換テスト結果
    """
    # テスト用のパスサンプル
    test_paths = [
        "papillae/male/2__1.png",
        "illae/male/2__1.png",
        "/sample/papillae/male/2__1.png"
    ]
    
    # マッピングファイルの読み込み
    mapping_file = os.path.join('static', 'annotation_mapping.json')
    mapping = {}
    
    if os.path.exists(mapping_file):
        try:
            with open(mapping_file, 'r') as f:
                mapping = json.load(f)
        except:
            mapping = {"error": "ファイル読み込みエラー"}
    
    # analyze_sample 関数でのパス処理シミュレーション
    analysis_results = []
    for path in test_paths:
        relative_path = path.replace('samples/', '')
        if relative_path.startswith('/sample/'):
            relative_path = relative_path.lstrip('/sample/')
        
        has_annotation = relative_path in mapping
        analysis_results.append({
            "original": path,
            "processed": relative_path,
            "has_annotation": has_annotation,
            "annotation_path": mapping.get(relative_path, None)
        })
    
    return jsonify({
        "mapping": mapping,
        "analysis_results": analysis_results,
        "test_paths": test_paths
    })


@sample_bp.route('/list', methods=['GET'])
def list_samples():
    """
    サンプル画像一覧を取得
    
    Parameters:
    - gender: フィルタリングする性別 (オプション)
    
    Returns:
    - JSON: サンプル画像一覧
    """
    from app import app
    
    # オプションのフィルタリング
    gender = request.args.get('gender')
    
    # サンプルディレクトリ
    samples_base_dir = os.path.join(app.config['SAMPLES_FOLDER'], 'papillae')
    
    result = {
        'male': [],
        'female': [],
        'unknown': []
    }
    
    # 各性別フォルダを検索
    for category in ['male', 'female', 'unknown']:
        if gender and gender != category:
            continue
            
        category_dir = os.path.join(samples_base_dir, category)
        if not os.path.exists(category_dir):
            continue
            
        # 画像ファイルをリストアップ
        for filename in os.listdir(category_dir):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                # アノテーション情報を確認
                rel_path = f"papillae/{category}/{filename}"
                
                # アノテーション状態を確認
                has_annotation = False
                annotation_path = None
                
                mapping_file = os.path.join('static', 'annotation_mapping.json')
                if os.path.exists(mapping_file):
                    try:
                        with open(mapping_file, 'r') as f:
                            mapping = json.load(f)
                            if rel_path in mapping:
                                has_annotation = True
                                annotation_path = mapping[rel_path]
                    except Exception:
                        pass
                
                # 画像情報を追加
                sample_info = {
                    'filename': filename,
                    'path': rel_path,
                    'url': f"/sample/{rel_path}",
                    'has_annotation': has_annotation
                }
                
                if has_annotation:
                    sample_info['annotation_path'] = annotation_path
                
                result[category].append(sample_info)
    
    # 総数情報を追加
    result['counts'] = {
        'male': len(result['male']),
        'female': len(result['female']),
        'unknown': len(result['unknown']),
        'total': len(result['male']) + len(result['female']) + len(result['unknown'])
    }
    
    return jsonify(result)