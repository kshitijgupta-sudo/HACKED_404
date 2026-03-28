from __future__ import annotations

import math
import warnings
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

try:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="pkg_resources is deprecated as an API.*",
            category=UserWarning,
        )
        import face_recognition
except ImportError:  # pragma: no cover - optional dependency
    face_recognition = None


KNOWN_FACES_DIR = Path(__file__).resolve().parent.parent / "data" / "known_faces"
KNOWN_FACES_DIR.mkdir(parents=True, exist_ok=True)
MATCH_TOLERANCE = 0.45
MEDIUM_CONFIDENCE_DISTANCE = 0.55
DEFAULT_CLASSROOM_LAT = 31.3956
DEFAULT_CLASSROOM_LON = 75.5352
DEFAULT_GEOFENCE_RADIUS_METERS = 50
MIN_FACE_SIZE = 150


def face_dependencies_available() -> bool:
    return face_recognition is not None


def ensure_face_dependencies() -> None:
    if not face_dependencies_available():
        raise RuntimeError(
            "Face recognition dependencies are not installed. Install the `face_recognition` package to enable this feature."
        )


def io_from_bytes(image_bytes: bytes):
    from io import BytesIO

    return BytesIO(image_bytes)


def decode_image_bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Unable to decode the uploaded image.")
    return frame


def gamma_correction(frame: np.ndarray, gamma: float) -> np.ndarray:
    inverse_gamma = 1.0 / max(gamma, 0.01)
    table = np.array([((i / 255.0) ** inverse_gamma) * 255 for i in range(256)]).astype("uint8")
    return cv2.LUT(frame, table)


def detect_lighting_condition(frame: np.ndarray) -> str:
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(np.mean(gray_frame))
    if mean_brightness < 60:
        return "too_dark"
    if mean_brightness > 180:
        return "too_bright"
    return "good"


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray_frame)
    enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    blurred = cv2.GaussianBlur(enhanced_bgr, (3, 3), 0)

    mean_brightness = float(np.mean(gray_frame))
    if mean_brightness < 80:
        blurred = gamma_correction(blurred, 1.5)
    elif mean_brightness > 200:
        blurred = gamma_correction(blurred, 0.7)

    return blurred


def check_webcam_quality(frame: np.ndarray) -> dict[str, object]:
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray_frame, cv2.CV_64F).var())
    is_clear = sharpness >= 50
    return {
        "sharpness_score": round(sharpness, 2),
        "is_clear": is_clear,
        "message": "Webcam frame looks clear." if is_clear else "Webcam frame is blurry. Clean the lens or hold the camera steady.",
    }


def get_face_scan_feedback(frame: np.ndarray) -> dict[str, object]:
    ensure_face_dependencies()
    lighting = detect_lighting_condition(frame)
    processed = preprocess_frame(frame)
    rgb_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_frame, model="hog")

    if not face_locations:
        return {
            "face_found": False,
            "is_centered": False,
            "is_close_enough": False,
            "lighting": lighting,
            "message": "No face found. Look at the camera and hold still.",
            "ready_to_scan": False,
            "reason": "no_face",
        }

    top, right, bottom, left = face_locations[0]
    frame_height, frame_width = processed.shape[:2]
    face_center_x = (left + right) / 2
    face_center_y = (top + bottom) / 2
    is_centered = (
        frame_width * 0.2 <= face_center_x <= frame_width * 0.8
        and frame_height * 0.2 <= face_center_y <= frame_height * 0.8
    )
    is_close_enough = (right - left) >= MIN_FACE_SIZE and (bottom - top) >= MIN_FACE_SIZE

    if lighting == "too_dark":
        message = "Move to better lighting - it is too dark."
        reason = "too_dark"
    elif lighting == "too_bright":
        message = "Reduce backlight or turn away from bright windows."
        reason = "too_bright"
    elif not is_close_enough:
        message = "Move closer to the camera."
        reason = "move_closer"
    elif not is_centered:
        message = "Center your face in the frame."
        reason = "not_centered"
    else:
        message = "Ready!"
        reason = "ready"

    return {
        "face_found": True,
        "is_centered": is_centered,
        "is_close_enough": is_close_enough,
        "lighting": lighting,
        "message": message,
        "ready_to_scan": lighting == "good" and is_centered and is_close_enough,
        "reason": reason,
    }


def extract_face_encoding(frame: np.ndarray) -> list[float] | None:
    ensure_face_dependencies()
    processed = preprocess_frame(frame)
    rgb_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb_frame)
    if not encodings:
        return None
    return encodings[0].tolist()


def extract_all_face_encodings(frame: np.ndarray) -> list[list[float]]:
    ensure_face_dependencies()
    processed = preprocess_frame(frame)
    rgb_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb_frame)
    return [encoding.tolist() for encoding in encodings]


def encode_face_from_bytes(image_bytes: bytes) -> list[float]:
    frame = decode_image_bytes_to_bgr(image_bytes)
    encoding = extract_face_encoding(frame)
    if encoding is None:
        raise ValueError("No face detected in the uploaded image.")
    return encoding


def register_face(student_id: str, images: list[dict[str, object]]) -> dict[str, object]:
    ensure_face_dependencies()
    valid_encodings: list[np.ndarray] = []
    regular_encodings: list[list[float]] = []
    glasses_encodings: list[list[float]] = []
    photos_skipped = 0
    warnings_list: list[str] = []

    for index, image_item in enumerate(images):
        frame = image_item.get("frame")
        if not isinstance(frame, np.ndarray):
            photos_skipped += 1
            warnings_list.append(f"Image {index + 1} is invalid and was skipped.")
            continue

        encodings = extract_all_face_encodings(frame)
        if not encodings:
            photos_skipped += 1
            warnings_list.append(f"Image {index + 1} had no detectable face.")
            continue

        encoding = encodings[0]
        valid_encodings.append(np.array(encoding, dtype=np.float64))
        if bool(image_item.get("with_glasses")):
            glasses_encodings.append(encoding)
        else:
            regular_encodings.append(encoding)

    if len(valid_encodings) < 3:
        raise ValueError("Need at least 3 clear photos")

    final_encoding = np.mean(valid_encodings, axis=0)
    return {
        "success": True,
        "student_id": student_id,
        "photos_used": len(valid_encodings),
        "photos_skipped": photos_skipped,
        "encoding_count": len(valid_encodings),
        "face_encoding": final_encoding.tolist(),
        "face_encodings": regular_encodings,
        "glasses_face_encodings": glasses_encodings,
        "warnings": warnings_list,
    }


def save_registered_face_image(roll_number: str, image_bytes: bytes) -> str:
    file_path = KNOWN_FACES_DIR / f"{roll_number}.jpg"
    file_path.write_bytes(image_bytes)
    return str(file_path)


def perform_basic_liveness_check(frame: np.ndarray) -> dict[str, object]:
    ensure_face_dependencies()
    processed = preprocess_frame(frame)
    rgb_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_frame, model="hog")
    if not face_locations:
        return {"passed": False, "reason": "no_face", "message": "No face found for liveness validation."}

    landmarks = face_recognition.face_landmarks(rgb_frame, face_locations)
    if not landmarks:
        return {"passed": False, "reason": "liveness_failed", "message": "Face landmarks were unclear. Please look directly at the camera."}

    top, right, bottom, left = face_locations[0]
    face_roi = processed[top:bottom, left:right]
    if face_roi.size == 0:
        return {"passed": False, "reason": "liveness_failed", "message": "Face crop was invalid. Try again."}

    texture_score = float(cv2.Laplacian(cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
    if texture_score < 12:
        return {
            "passed": False,
            "reason": "liveness_failed",
            "message": "Liveness check failed. Blink or slightly move before scanning again.",
        }

    return {"passed": True, "reason": "liveness_passed", "message": "Liveness check passed."}


def match_face(frame: np.ndarray, known_faces: list[dict[str, object]]) -> dict[str, object]:
    ensure_face_dependencies()
    lighting = detect_lighting_condition(frame)
    if lighting == "too_dark":
        return {
            "matched": False,
            "student_id": None,
            "student_name": None,
            "roll_number": None,
            "confidence_score": 0.0,
            "distance": None,
            "reason": "too_dark",
            "message": "Please move to better lighting.",
            "lighting": lighting,
            "matched_with_glasses_profile": False,
        }

    processed = preprocess_frame(frame)
    rgb_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb_frame)
    if not encodings:
        return {
            "matched": False,
            "student_id": None,
            "student_name": None,
            "roll_number": None,
            "confidence_score": 0.0,
            "distance": None,
            "reason": "no_face",
            "message": "No face detected.",
            "lighting": lighting,
            "matched_with_glasses_profile": False,
        }

    if not known_faces:
        return {
            "matched": False,
            "student_id": None,
            "student_name": None,
            "roll_number": None,
            "confidence_score": 0.0,
            "distance": None,
            "reason": "no_profiles",
            "message": "No registered student face profiles were found.",
            "lighting": lighting,
            "matched_with_glasses_profile": False,
        }

    candidate_encoding = encodings[0]
    flattened_profiles: list[dict[str, object]] = []
    for student in known_faces:
        for encoding in student.get("encodings", []):
            flattened_profiles.append(
                {
                    "student_id": student.get("student_id"),
                    "student_name": student.get("name"),
                    "roll_number": student.get("roll_number"),
                    "encoding": np.array(encoding, dtype=np.float64),
                    "with_glasses": False,
                }
            )
        for encoding in student.get("glasses_encodings", []):
            flattened_profiles.append(
                {
                    "student_id": student.get("student_id"),
                    "student_name": student.get("name"),
                    "roll_number": student.get("roll_number"),
                    "encoding": np.array(encoding, dtype=np.float64),
                    "with_glasses": True,
                }
            )

    if not flattened_profiles:
        return {
            "matched": False,
            "student_id": None,
            "student_name": None,
            "roll_number": None,
            "confidence_score": 0.0,
            "distance": None,
            "reason": "no_profiles",
            "message": "No valid stored face encodings were found.",
            "lighting": lighting,
            "matched_with_glasses_profile": False,
        }

    known_encodings = np.array([profile["encoding"] for profile in flattened_profiles], dtype=np.float64)
    distances = face_recognition.face_distance(known_encodings, candidate_encoding)
    best_match_index = int(np.argmin(distances))
    best_distance = float(distances[best_match_index])
    confidence_score = round(max(0.0, (1 - best_distance) * 100), 2)
    best_profile = flattened_profiles[best_match_index]

    if best_distance < MATCH_TOLERANCE:
        return {
            "matched": True,
            "student_id": best_profile["student_id"],
            "student_name": best_profile["student_name"],
            "roll_number": best_profile["roll_number"],
            "confidence_score": confidence_score,
            "distance": round(best_distance, 4),
            "reason": "matched",
            "message": "Face matched successfully.",
            "lighting": lighting,
            "matched_with_glasses_profile": bool(best_profile["with_glasses"]),
        }

    if best_distance <= MEDIUM_CONFIDENCE_DISTANCE:
        return {
            "matched": False,
            "student_id": best_profile["student_id"],
            "student_name": best_profile["student_name"],
            "roll_number": best_profile["roll_number"],
            "confidence_score": confidence_score,
            "distance": round(best_distance, 4),
            "reason": "medium_confidence",
            "message": "Face is close to a match. Move closer and look directly at the camera.",
            "lighting": lighting,
            "matched_with_glasses_profile": bool(best_profile["with_glasses"]),
        }

    return {
        "matched": False,
        "student_id": None,
        "student_name": None,
        "roll_number": None,
        "confidence_score": confidence_score,
        "distance": round(best_distance, 4),
        "reason": "low_confidence",
        "message": "Face match confidence is too low.",
        "lighting": lighting,
        "matched_with_glasses_profile": False,
    }


def get_distance_meters(
    latitude: float,
    longitude: float,
    classroom_latitude: float = DEFAULT_CLASSROOM_LAT,
    classroom_longitude: float = DEFAULT_CLASSROOM_LON,
) -> float:
    earth_radius = 6371000
    lat1 = math.radians(classroom_latitude)
    lon1 = math.radians(classroom_longitude)
    lat2 = math.radians(latitude)
    lon2 = math.radians(longitude)
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius * c


def is_within_geofence(
    latitude: float,
    longitude: float,
    classroom_latitude: float = DEFAULT_CLASSROOM_LAT,
    classroom_longitude: float = DEFAULT_CLASSROOM_LON,
    radius_meters: float = DEFAULT_GEOFENCE_RADIUS_METERS,
) -> bool:
    return get_distance_meters(latitude, longitude, classroom_latitude, classroom_longitude) <= radius_meters


def iso_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")
