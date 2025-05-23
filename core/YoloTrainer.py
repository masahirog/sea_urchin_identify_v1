import os
import subprocess
import json
import threading
import time
from datetime import datetime

class YoloTrainer:
    """YOLOv5モデルのトレーニングを管理するクラス"""
    
    def __init__(self, yolo_dir='yolov5', data_yaml='data/yolo_dataset/data.yaml'):
        """
        トレーナーの初期化
        
        Args:
            yolo_dir: YOLOv5のディレクトリパス
            data_yaml: データ設定ファイルのパス
        """
        self.yolo_dir = yolo_dir
        self.data_yaml = data_yaml
        self.training_process = None
        self.training_thread = None
        self.is_training = False
        self.start_time = None
        self.log_file = None
        self.current_epoch = 0
        self.total_epochs = 0
        self.metrics = {
            'box_loss': [],
            'obj_loss': [],
            'cls_loss': [],
            'precision': [],
            'recall': [],
            'mAP50': [],
            'mAP50-95': []
        }
    
    def start_training(self, weights='yolov5s.pt', batch_size=4, epochs=50, img_size=640,
                       device='', workers=4, name='exp', exist_ok=False):
        """
        トレーニングを開始する
        
        Args:
            weights: 初期ウェイトファイル
            batch_size: バッチサイズ
            epochs: エポック数
            img_size: 画像サイズ
            device: デバイス指定（GPUの場合は '0'、CPUの場合は ''）
            workers: データローダーのワーカー数
            name: 実験名
            exist_ok: 同名の実験が存在する場合に上書きするかどうか
            
        Returns:
            bool: トレーニングが開始されたかどうか
        """
        if self.is_training:
            return False
        
        # トレーニングの設定を保存
        self.training_config = {
            'weights': weights,
            'batch_size': batch_size,
            'epochs': epochs,
            'img_size': img_size,
            'device': device,
            'workers': workers,
            'name': name,
            'exist_ok': exist_ok
        }
        
        # トレーニングスレッドを開始
        self.training_thread = threading.Thread(
            target=self._run_training_process,
            args=(weights, batch_size, epochs, img_size, device, workers, name, exist_ok)
        )
        self.training_thread.daemon = True
        self.training_thread.start()
        
        return True
    
    def _run_training_process(self, weights, batch_size, epochs, img_size, device, workers, name, exist_ok):
        """トレーニングプロセスを実行する（内部メソッド）"""
        self.is_training = True
        self.start_time = datetime.now()
        self.total_epochs = epochs
        self.current_epoch = 0
        
        # ログファイルの設定
        log_dir = 'logs'
        os.makedirs(log_dir, exist_ok=True)
        self.log_file = os.path.join(log_dir, f'yolo_training_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        
        # コマンドラインの構築
        cmd = [
            'python', 'train.py',
            '--img', str(img_size),
            '--batch', str(batch_size),
            '--epochs', str(epochs),
            '--data', self.data_yaml,
            '--weights', weights,
            '--workers', str(workers),
            '--name', name
        ]
        
        if exist_ok:
            cmd.append('--exist-ok')
            
        if device:
            cmd.extend(['--device', device])
        
        # プロセスの実行
        try:
            with open(self.log_file, 'w') as log_file:
                self.training_process = subprocess.Popen(
                    cmd,
                    cwd=self.yolo_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    bufsize=1
                )
                
                # 出力の監視とメトリクスの更新
                for line in self.training_process.stdout:
                    log_file.write(line)
                    log_file.flush()
                    
                    # エポック情報の抽出
                    if 'Epoch' in line and 'GPU_mem' in line:
                        parts = line.strip().split()
                        if len(parts) > 1 and '/' in parts[0]:
                            current, total = parts[0].split('/')
                            try:
                                self.current_epoch = int(current)
                            except ValueError:
                                pass
                    
                    # メトリクス情報の抽出
                    if 'all' in line and 'instances' in line:
                        try:
                            parts = [p for p in line.strip().split() if p]
                            if len(parts) >= 7:
                                self.metrics['precision'].append(float(parts[-6]) if parts[-6] != 'p' else 0)
                                self.metrics['recall'].append(float(parts[-5]) if parts[-5] != 'r' else 0)
                                self.metrics['mAP50'].append(float(parts[-4]) if parts[-4] != 'map50' else 0)
                                self.metrics['mAP50-95'].append(float(parts[-3]) if parts[-3] != 'map' else 0)
                        except (ValueError, IndexError):
                            pass
                
                self.training_process.wait()
        
        except Exception as e:
            print(f"トレーニングエラー: {e}")
        
        finally:
            self.is_training = False
            self.training_process = None
    
    def stop_training(self):
        """トレーニングを停止する"""
        if self.is_training and self.training_process:
            self.training_process.terminate()
            self.is_training = False
            return True
        return False
    
    def get_training_status(self):
        """現在のトレーニング状況を取得する"""
        if not self.is_training and not self.start_time:
            return {
                'status': 'not_started',
                'message': 'トレーニングはまだ開始されていません'
            }
        
        # 経過時間の計算
        elapsed = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        hours, remainder = divmod(elapsed, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        status = {
            'status': 'running' if self.is_training else 'completed',
            'start_time': self.start_time.strftime('%Y-%m-%d %H:%M:%S') if self.start_time else None,
            'elapsed_time': f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}",
            'current_epoch': self.current_epoch,
            'total_epochs': self.total_epochs,
            'progress': (self.current_epoch / self.total_epochs) * 100 if self.total_epochs > 0 else 0,
            'metrics': self.metrics
        }
        
        # 最新の実験ディレクトリを取得
        if os.path.exists(os.path.join(self.yolo_dir, 'runs/train')):
            exp_dirs = sorted([d for d in os.listdir(os.path.join(self.yolo_dir, 'runs/train')) 
                              if d.startswith('exp')])
            if exp_dirs:
                latest_exp = exp_dirs[-1]
                exp_dir = os.path.join(self.yolo_dir, 'runs/train', latest_exp)
                
                # 結果画像のパスを追加
                status['result_images'] = {
                    'labels': f'/static/runs/train/{latest_exp}/labels.jpg' if os.path.exists(os.path.join(exp_dir, 'labels.jpg')) else None,
                    'train_batch': f'/static/runs/train/{latest_exp}/train_batch0.jpg' if os.path.exists(os.path.join(exp_dir, 'train_batch0.jpg')) else None,
                    'val_batch': f'/static/runs/train/{latest_exp}/val_batch0_pred.jpg' if os.path.exists(os.path.join(exp_dir, 'val_batch0_pred.jpg')) else None,
                    'results': f'/static/runs/train/{latest_exp}/results.png' if os.path.exists(os.path.join(exp_dir, 'results.png')) else None,
                    'confusion_matrix': f'/static/runs/train/{latest_exp}/confusion_matrix.png' if os.path.exists(os.path.join(exp_dir, 'confusion_matrix.png')) else None,
                    'PR_curve': f'/static/runs/train/{latest_exp}/PR_curve.png' if os.path.exists(os.path.join(exp_dir, 'PR_curve.png')) else None
                }
                
                # 結果ファイルの読み込み
                results_csv = os.path.join(exp_dir, 'results.csv')
                if os.path.exists(results_csv):
                    try:
                        with open(results_csv, 'r') as f:
                            lines = f.readlines()
                            if len(lines) > 1:
                                headers = [h.strip() for h in lines[0].split(',')]
                                values = [v.strip() for v in lines[-1].split(',')]
                                status['latest_results'] = dict(zip(headers, values))
                    except Exception as e:
                        print(f"結果ファイル読み込みエラー: {e}")
        
        return status