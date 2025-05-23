# annotation_tool.py
import cv2
import os
import json
import numpy as np

# 設定
SAMPLES_DIR = 'static/images/samples/papillae'
ANNOTATIONS_DIR = 'static/images/annotations'
MAPPING_FILE = 'static/annotation_mapping.json'

# ディレクトリ確認
os.makedirs(ANNOTATIONS_DIR, exist_ok=True)

# マッピング読み込み
if os.path.exists(MAPPING_FILE):
    with open(MAPPING_FILE, 'r') as f:
        mapping = json.load(f)
else:
    mapping = {}

def annotate_images():
    # 画像一覧取得
    male_images = [f for f in os.listdir(os.path.join(SAMPLES_DIR, 'male')) 
                  if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    female_images = [f for f in os.listdir(os.path.join(SAMPLES_DIR, 'female')) 
                    if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    all_images = []
    for img in male_images:
        all_images.append(('male', img))
    for img in female_images:
        all_images.append(('female', img))
    
    # 画像がなければ終了
    if not all_images:
        print("アノテーションする画像がありません")
        return
    
    print(f"合計 {len(all_images)} 枚の画像があります")
    
    # 画像ループ
    for i, (gender, img_name) in enumerate(all_images):
        # すでにアノテーション済みならスキップ
        rel_path = f"papillae/{gender}/{img_name}"
        if rel_path in mapping:
            print(f"スキップ: {rel_path} (すでにアノテーション済み)")
            continue
        
        # 画像読み込み
        img_path = os.path.join(SAMPLES_DIR, gender, img_name)
        img = cv2.imread(img_path)
        if img is None:
            print(f"画像読み込み失敗: {img_path}")
            continue
        
        # 描画用のコピー
        draw_img = img.copy()
        
        # 赤色の描画
        annotations = []
        drawing = False
        start_x, start_y = -1, -1
        
        def mouse_callback(event, x, y, flags, param):
            nonlocal drawing, start_x, start_y, draw_img
            
            if event == cv2.EVENT_LBUTTONDOWN:
                # 描画開始
                drawing = True
                start_x, start_y = x, y
                
            elif event == cv2.EVENT_MOUSEMOVE:
                # 描画中
                if drawing:
                    temp_img = draw_img.copy()
                    cv2.rectangle(temp_img, (start_x, start_y), (x, y), (0, 0, 255), 2)
                    cv2.imshow('Annotation', temp_img)
                    
            elif event == cv2.EVENT_LBUTTONUP:
                # 描画終了
                drawing = False
                if start_x != x and start_y != y:  # 有効な矩形
                    cv2.rectangle(draw_img, (start_x, start_y), (x, y), (0, 0, 255), 2)
                    # 左上と右下の座標を保存
                    x1, y1 = min(start_x, x), min(start_y, y)
                    x2, y2 = max(start_x, x), max(start_y, y)
                    annotations.append([x1, y1, x2, y2])
        
        # ウィンドウ設定
        cv2.namedWindow('Annotation', cv2.WINDOW_NORMAL)
        cv2.setMouseCallback('Annotation', mouse_callback)
        
        print(f"\n画像 {i+1}/{len(all_images)}: {rel_path}")
        print("操作方法:")
        print("  - ドラッグ: 生殖乳頭を矩形で囲む")
        print("  - r: リセット")
        print("  - s: 保存して次へ")
        print("  - q: 終了")
        
        while True:
            cv2.imshow('Annotation', draw_img)
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('r'):  # リセット
                draw_img = img.copy()
                annotations = []
                
            elif key == ord('s'):  # 保存
                if not annotations:
                    print("警告: アノテーションがありません")
                    continue
                
                # アノテーション画像の保存
                annotation_img = np.zeros_like(img)
                for x1, y1, x2, y2 in annotations:
                    cv2.rectangle(annotation_img, (x1, y1), (x2, y2), (0, 0, 255), -1)
                
                # ファイル名作成
                basename, ext = os.path.splitext(img_name)
                anno_name = f"{basename}_annotation{ext}"
                anno_path = os.path.join(ANNOTATIONS_DIR, anno_name)
                
                # 保存
                cv2.imwrite(anno_path, annotation_img)
                
                # マッピング更新
                mapping[rel_path] = f"images/annotations/{anno_name}"
                
                # マッピングファイル保存
                with open(MAPPING_FILE, 'w') as f:
                    json.dump(mapping, f, indent=2)
                
                print(f"保存完了: {anno_name}")
                break
                
            elif key == ord('q'):  # 終了
                print("アノテーション作業を終了します")
                cv2.destroyAllWindows()
                return
    
    print("すべての画像のアノテーションが完了しました")
    cv2.destroyAllWindows()

if __name__ == '__main__':
    annotate_images()