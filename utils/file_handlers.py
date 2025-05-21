def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_file_extension(filename):
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

def is_video_file(filename):
    ext = get_file_extension(filename)
    return ext in {'mp4', 'avi', 'mov', 'mkv'}

def is_image_file(filename):
    ext = get_file_extension(filename)
    return ext in {'jpg', 'jpeg', 'png'}