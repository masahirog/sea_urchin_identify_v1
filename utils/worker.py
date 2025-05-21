from models.analyzer import UrchinPapillaeAnalyzer

def processing_worker(processing_queue, processing_status, app_config):
    while True:
        try:
            task = processing_queue.get()
            if task is None:
                break
                
            task_type = task["type"]
            task_id = task["id"]
            
            analyzer = UrchinPapillaeAnalyzer()
            
            if task_type == "process_video":
                analyzer.process_video(
                    task["video_path"],
                    app_config['EXTRACTED_FOLDER'],
                    task_id,
                    task.get("max_images", 10)
                )
            elif task_type == "train_model":
                analyzer.train_model(
                    task["dataset_dir"],
                    task_id
                )
            
            processing_queue.task_done()
            
        except Exception as e:
            print(f"処理ワーカーエラー: {str(e)}")
            if 'task_id' in locals():
                processing_status[task_id] = {"status": "error", "message": f"エラー: {str(e)}"}
            processing_queue.task_done()