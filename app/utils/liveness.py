import cv2
import mediapipe as mp
import numpy as np

mp_face_mesh = mp.solutions.face_mesh

def check_liveness(frame) -> dict:
    """
    Check if face in frame is real (not a photo)
    Returns dict with is_live and confidence
    """
    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)
        
        if not results.multi_face_landmarks:
            return {"is_live": False, "confidence": 0.0, "reason": "No face detected"}
        
        landmarks = results.multi_face_landmarks[0].landmark
        
        # Check eye aspect ratio — real faces have natural eye movement
        left_eye = [landmarks[33], landmarks[160], landmarks[158], 
                   landmarks[133], landmarks[153], landmarks[144]]
        right_eye = [landmarks[362], landmarks[385], landmarks[387],
                    landmarks[263], landmarks[373], landmarks[380]]
        
        left_ear = _eye_aspect_ratio(left_eye)
        right_ear = _eye_aspect_ratio(right_eye)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Check face depth — flat photos have less 3D variation
        nose_tip = landmarks[1]
        left_cheek = landmarks[234]
        right_cheek = landmarks[454]
        
        depth_variation = abs(nose_tip.z - left_cheek.z) + abs(nose_tip.z - right_cheek.z)
        
        # Scoring
        is_live = avg_ear > 0.15 and depth_variation > 0.01
        confidence = min(1.0, (avg_ear * 2 + depth_variation * 10) / 3)
        
        return {
            "is_live": is_live,
            "confidence": round(confidence, 2),
            "reason": "Live face detected" if is_live else "Possible photo spoofing"
        }

def _eye_aspect_ratio(eye_landmarks) -> float:
    """Calculate eye aspect ratio for blink detection"""
    p2_p6 = abs(eye_landmarks[1].y - eye_landmarks[5].y)
    p3_p5 = abs(eye_landmarks[2].y - eye_landmarks[4].y)
    p1_p4 = abs(eye_landmarks[0].x - eye_landmarks[3].x)
    
    if p1_p4 == 0:
        return 0.0
    
    ear = (p2_p6 + p3_p5) / (2.0 * p1_p4)
    return ear