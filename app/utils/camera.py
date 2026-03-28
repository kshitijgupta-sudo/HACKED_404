import cv2
import numpy as np

def get_camera_frame(camera_index: int = 0):
    """
    Capture a single frame from camera
    Returns the frame or None if failed
    """
    cap = cv2.VideoCapture(camera_index)
    
    if not cap.isOpened():
        return None
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return None
        
    return frame

def start_camera_stream(camera_index: int = 0):
    """
    Start continuous camera stream for attendance
    Yields frames continuously
    """
    cap = cv2.VideoCapture(camera_index)
    
    if not cap.isOpened():
        raise Exception("Could not open camera")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            yield frame
    finally:
        cap.release()

def save_frame(frame, path: str):
    """Save a frame to disk"""
    cv2.imwrite(path, frame)
    return path

def frame_from_bytes(image_bytes: bytes):
    """
    Convert uploaded image bytes to frame
    Used when receiving image from mobile app
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return frame