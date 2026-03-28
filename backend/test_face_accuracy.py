from __future__ import annotations

import numpy as np

from app import face_utils


class FakeFaceRecognition:
    def face_locations(self, frame, model="hog"):
        if frame.mean() < 20:
            return []
        height, width = frame.shape[:2]
        return [(40, min(width - 40, 260), min(height - 40, 260), 40)]

    def face_encodings(self, frame, known_face_locations=None):
        if frame.mean() < 20:
            return []
        return [np.array([0.1, 0.2, 0.3, 0.4], dtype=np.float64)]

    def face_distance(self, known_encodings, live_encoding):
        return np.linalg.norm(known_encodings - live_encoding, axis=1)

    def face_landmarks(self, frame, face_locations):
        return [{"left_eye": [(60, 60), (70, 60)], "right_eye": [(120, 60), (130, 60)]}]


class FakeFaceRecognitionFar(FakeFaceRecognition):
    def face_locations(self, frame, model="hog"):
        return [(20, 90, 90, 20)]


def run_test(name: str, passed: bool, details: str) -> None:
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {details}")


def main() -> None:
    original_face_recognition = face_utils.face_recognition
    try:
        face_utils.face_recognition = FakeFaceRecognition()

        dark_frame = np.full((300, 300, 3), 25, dtype=np.uint8)
        bright_frame = np.full((300, 300, 3), 240, dtype=np.uint8)
        good_frame = np.full((300, 300, 3), 120, dtype=np.uint8)

        processed_dark = face_utils.preprocess_frame(dark_frame)
        run_test(
            "preprocess_frame dark image",
            processed_dark.mean() > dark_frame.mean(),
            f"before={dark_frame.mean():.2f}, after={processed_dark.mean():.2f}",
        )

        processed_bright = face_utils.preprocess_frame(bright_frame)
        run_test(
            "preprocess_frame bright image",
            processed_bright.mean() < bright_frame.mean(),
            f"before={bright_frame.mean():.2f}, after={processed_bright.mean():.2f}",
        )

        known_faces = [
            {
                "student_id": 1,
                "name": "Test Student",
                "roll_number": "25106059",
                "encodings": [[0.1, 0.2, 0.3, 0.4]],
                "glasses_encodings": [[0.11, 0.21, 0.31, 0.41]],
            }
        ]
        good_match = face_utils.match_face(good_frame, known_faces)
        run_test(
            "match_face good lighting",
            good_match["matched"] and good_match["confidence_score"] > 80,
            f"matched={good_match['matched']}, confidence={good_match['confidence_score']}",
        )

        dark_match = face_utils.match_face(dark_frame, known_faces)
        run_test(
            "match_face dark photo",
            dark_match["reason"] == "too_dark",
            f"reason={dark_match['reason']}, message={dark_match['message']}",
        )

        face_utils.face_recognition = FakeFaceRecognitionFar()
        far_feedback = face_utils.get_face_scan_feedback(good_frame)
        run_test(
            "get_face_scan_feedback face too far",
            far_feedback["reason"] == "move_closer",
            f"reason={far_feedback['reason']}, message={far_feedback['message']}",
        )
    finally:
        face_utils.face_recognition = original_face_recognition


if __name__ == "__main__":
    main()
