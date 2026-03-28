from __future__ import annotations

import csv
import io
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .database import get_connection, init_db
from .face_utils import (
    check_webcam_quality,
    decode_image_bytes_to_bgr,
    face_dependencies_available,
    get_distance_meters,
    get_face_scan_feedback,
    is_within_geofence,
    match_face,
    perform_basic_liveness_check,
    register_face,
    save_registered_face_image,
)
from .parser import extract_timetable_entries


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Smart Academic Management System API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCAN_ATTEMPTS: dict[str, dict[str, object]] = {}
ATTEMPT_WINDOW = timedelta(minutes=10)
MAX_SCAN_ATTEMPTS = 3


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/timetable")
def list_timetable() -> dict[str, list[dict[str, str | int]]]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT id, subject_name, time, room_number, source_file, created_at
            FROM timetable
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    finally:
        connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "subject_name": row["subject_name"],
                "time": row["time"],
                "room_number": row["room_number"],
                "source_file": row["source_file"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@app.post("/api/timetable/upload")
async def upload_timetable(file: UploadFile = File(...)) -> dict[str, object]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a valid PDF file.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        parse_result = extract_timetable_entries(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read PDF: {exc}") from exc

    entries = parse_result.entries
    if not entries:
        note_summary = " ".join(parse_result.notes)
        raise HTTPException(
            status_code=422,
            detail=f"No timetable entries were detected. {note_summary}",
        )

    connection = get_connection()
    try:
        connection.executemany(
            """
            INSERT INTO timetable (subject_name, time, room_number, source_file)
            VALUES (:subject_name, :time, :room_number, :source_file)
            """,
            [{**entry, "source_file": file.filename} for entry in entries],
        )
        connection.commit()
    finally:
        connection.close()

    return {
        "message": "Timetable parsed successfully.",
        "items": entries,
        "parser_method": parse_result.parser_method,
        "notes": parse_result.notes,
    }


@app.delete("/api/timetable")
def clear_timetable() -> dict[str, str]:
    connection = get_connection()
    try:
        connection.execute("DELETE FROM timetable")
        connection.commit()
    finally:
        connection.close()

    return {"message": "Timetable cleared successfully."}


class SubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class TopicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class TopicStatusUpdate(BaseModel):
    is_completed: bool


class FaceStudentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    roll_number: str = Field(min_length=2, max_length=40)
    department: str = Field(min_length=2, max_length=100)


class FaceGeofenceUpdate(BaseModel):
    class_name: str = Field(min_length=2, max_length=100)
    latitude: float
    longitude: float
    radius_meters: float = Field(gt=0, le=1000)


class StudentFacePayload(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    roll_number: str = Field(min_length=2, max_length=40)
    section: str = Field(min_length=1, max_length=50)
    career_goal: str = Field(min_length=2, max_length=100)
    weak_subjects: list[str] = Field(default_factory=list)
    strong_subjects: list[str] = Field(default_factory=list)
    interests: str = Field(default="")


@app.get("/api/curriculum")
def list_curriculum() -> dict[str, list[dict[str, object]]]:
    connection = get_connection()
    try:
        subject_rows = connection.execute(
            """
            SELECT id, name, created_at
            FROM subjects
            ORDER BY name COLLATE NOCASE ASC
            """
        ).fetchall()
        topic_rows = connection.execute(
            """
            SELECT id, subject_id, name, is_completed, created_at
            FROM topics
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    finally:
        connection.close()

    topics_by_subject: dict[int, list[dict[str, object]]] = {}
    for row in topic_rows:
        topics_by_subject.setdefault(row["subject_id"], []).append(
            {
                "id": row["id"],
                "subject_id": row["subject_id"],
                "name": row["name"],
                "is_completed": bool(row["is_completed"]),
                "created_at": row["created_at"],
            }
        )

    subjects: list[dict[str, object]] = []
    for row in subject_rows:
        topics = topics_by_subject.get(row["id"], [])
        completed_topics = sum(1 for topic in topics if topic["is_completed"])
        total_topics = len(topics)
        progress_percentage = round((completed_topics / total_topics) * 100, 1) if total_topics else 0.0
        subjects.append(
            {
                "id": row["id"],
                "name": row["name"],
                "created_at": row["created_at"],
                "topics": topics,
                "completed_topics": completed_topics,
                "total_topics": total_topics,
                "progress_percentage": progress_percentage,
            }
        )

    return {"items": subjects}


@app.get("/api/curriculum/progress")
def curriculum_progress() -> dict[str, object]:
    curriculum_response = list_curriculum()
    subjects = curriculum_response["items"]
    weak_subjects = [
        subject
        for subject in subjects
        if subject["total_topics"] > 0 and float(subject["progress_percentage"]) < 60
    ]

    suggestions = []
    for subject in weak_subjects:
        subject_name = str(subject["name"])
        percentage = int(round(float(subject["progress_percentage"])))
        suggestions.append(
            f"Focus more on {subject_name} to move beyond {percentage}% completion."
        )

    return {
        "subjects": subjects,
        "weak_subjects": weak_subjects,
        "suggestions": suggestions,
    }


@app.post("/api/curriculum/subjects")
def create_subject(payload: SubjectCreate) -> dict[str, object]:
    subject_name = payload.name.strip()
    if len(subject_name) < 2:
        raise HTTPException(status_code=400, detail="Subject name must be at least 2 characters.")

    connection = get_connection()
    try:
        existing_subject = connection.execute(
            "SELECT id FROM subjects WHERE lower(name) = lower(?)",
            (subject_name,),
        ).fetchone()
        if existing_subject:
            raise HTTPException(status_code=409, detail="Subject already exists.")

        cursor = connection.execute(
            "INSERT INTO subjects (name) VALUES (?)",
            (subject_name,),
        )
        connection.commit()
        subject_id = cursor.lastrowid
        subject_row = connection.execute(
            "SELECT id, name, created_at FROM subjects WHERE id = ?",
            (subject_id,),
        ).fetchone()
    finally:
        connection.close()

    return {
        "message": "Subject created successfully.",
        "item": {
            "id": subject_row["id"],
            "name": subject_row["name"],
            "created_at": subject_row["created_at"],
            "topics": [],
            "completed_topics": 0,
            "total_topics": 0,
            "progress_percentage": 0.0,
        },
    }


@app.post("/api/curriculum/subjects/{subject_id}/topics")
def create_topic(subject_id: int, payload: TopicCreate) -> dict[str, object]:
    topic_name = payload.name.strip()
    if len(topic_name) < 2:
        raise HTTPException(status_code=400, detail="Topic name must be at least 2 characters.")

    connection = get_connection()
    try:
        subject = connection.execute(
            "SELECT id FROM subjects WHERE id = ?",
            (subject_id,),
        ).fetchone()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found.")

        cursor = connection.execute(
            "INSERT INTO topics (subject_id, name) VALUES (?, ?)",
            (subject_id, topic_name),
        )
        connection.commit()
        topic_id = cursor.lastrowid
        topic_row = connection.execute(
            """
            SELECT id, subject_id, name, is_completed, created_at
            FROM topics
            WHERE id = ?
            """,
            (topic_id,),
        ).fetchone()
    finally:
        connection.close()

    return {
        "message": "Topic created successfully.",
        "item": {
            "id": topic_row["id"],
            "subject_id": topic_row["subject_id"],
            "name": topic_row["name"],
            "is_completed": bool(topic_row["is_completed"]),
            "created_at": topic_row["created_at"],
        },
    }


@app.patch("/api/curriculum/topics/{topic_id}")
def update_topic_status(topic_id: int, payload: TopicStatusUpdate) -> dict[str, object]:
    connection = get_connection()
    try:
        topic = connection.execute(
            "SELECT id FROM topics WHERE id = ?",
            (topic_id,),
        ).fetchone()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")

        connection.execute(
            "UPDATE topics SET is_completed = ? WHERE id = ?",
            (1 if payload.is_completed else 0, topic_id),
        )
        connection.commit()
        topic_row = connection.execute(
            """
            SELECT id, subject_id, name, is_completed, created_at
            FROM topics
            WHERE id = ?
            """,
            (topic_id,),
        ).fetchone()
    finally:
        connection.close()

    return {
        "message": "Topic status updated successfully.",
        "item": {
            "id": topic_row["id"],
            "subject_id": topic_row["subject_id"],
            "name": topic_row["name"],
            "is_completed": bool(topic_row["is_completed"]),
            "created_at": topic_row["created_at"],
        },
    }


@app.get("/api/dashboard")
def teacher_dashboard() -> dict[str, object]:
    connection = get_connection()
    try:
        attendance_rows = connection.execute(
            """
            SELECT id, attendance_date, student_name, subject_name, status
            FROM attendance_records
            ORDER BY attendance_date DESC, id DESC
            LIMIT 50
            """
        ).fetchall()
        absent_rows = connection.execute(
            """
            SELECT student_name, subject_name, attendance_date
            FROM attendance_records
            WHERE status = 'Absent'
            ORDER BY attendance_date DESC, student_name ASC
            LIMIT 12
            """
        ).fetchall()
        chart_rows = connection.execute(
            """
            SELECT
                attendance_date,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count,
                COUNT(*) AS total_count
            FROM attendance_records
            GROUP BY attendance_date
            ORDER BY attendance_date DESC
            LIMIT 7
            """
        ).fetchall()
        face_unverified_rows = connection.execute(
            """
            SELECT id, student_name, roll_number, reason, distance_meters, created_at
            FROM face_attendance_logs
            WHERE status = 'unverified'
            ORDER BY created_at DESC, id DESC
            LIMIT 10
            """
        ).fetchall()
        failed_attempt_rows = connection.execute(
            """
            SELECT id, ip_address, student_name, roll_number, reason, attempt_count, created_at
            FROM failed_attempts
            ORDER BY created_at DESC, id DESC
            LIMIT 10
            """
        ).fetchall()
    finally:
        connection.close()

    curriculum_data = curriculum_progress()

    attendance_items = [
        {
            "id": row["id"],
            "attendance_date": row["attendance_date"],
            "student_name": row["student_name"],
            "subject_name": row["subject_name"],
            "status": row["status"],
        }
        for row in attendance_rows
    ]

    absent_students = [
        {
            "student_name": row["student_name"],
            "subject_name": row["subject_name"],
            "attendance_date": row["attendance_date"],
        }
        for row in absent_rows
    ]

    attendance_chart = [
        {
            "date": row["attendance_date"],
            "present_count": row["present_count"],
            "total_count": row["total_count"],
            "attendance_percentage": round((row["present_count"] / row["total_count"]) * 100, 1)
            if row["total_count"]
            else 0.0,
        }
        for row in reversed(chart_rows)
    ]

    curriculum_chart = [
        {
            "subject_name": subject["name"],
            "progress_percentage": subject["progress_percentage"],
            "completed_topics": subject["completed_topics"],
            "total_topics": subject["total_topics"],
        }
        for subject in curriculum_data["subjects"]
    ]

    today_value = date.today().isoformat()
    todays_records = [item for item in attendance_items if item["attendance_date"] == today_value]
    present_today = sum(1 for item in todays_records if item["status"] == "Present")
    face_unverified_items = [
        {
            "id": row["id"],
            "student_name": row["student_name"],
            "roll_number": row["roll_number"],
            "reason": row["reason"],
            "distance_meters": row["distance_meters"],
            "created_at": row["created_at"],
        }
        for row in face_unverified_rows
    ]
    failed_scan_alerts = [
        {
            "id": row["id"],
            "ip_address": row["ip_address"],
            "student_name": row["student_name"],
            "roll_number": row["roll_number"],
            "reason": row["reason"],
            "attempt_count": row["attempt_count"],
            "created_at": row["created_at"],
        }
        for row in failed_attempt_rows
    ]

    return {
        "attendance_records": attendance_items,
        "absent_students": absent_students,
        "face_unverified_items": face_unverified_items,
        "failed_scan_alerts": failed_scan_alerts,
        "attendance_chart": attendance_chart,
        "curriculum_chart": curriculum_chart,
        "summary": {
            "records_today": len(todays_records),
            "present_today": present_today,
            "absent_today": sum(1 for item in todays_records if item["status"] == "Absent"),
            "face_unverified_count": len(face_unverified_items),
            "failed_scan_alert_count": len(failed_scan_alerts),
        },
        "last_refreshed": today_value,
    }


@app.get("/api/dashboard/export.csv")
def export_attendance_csv() -> StreamingResponse:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT attendance_date, student_name, subject_name, status
            FROM attendance_records
            ORDER BY attendance_date DESC, student_name ASC
            """
        ).fetchall()
    finally:
        connection.close()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["attendance_date", "student_name", "subject_name", "status"])
    for row in rows:
        writer.writerow(
            [
                row["attendance_date"],
                row["student_name"],
                row["subject_name"],
                row["status"],
            ]
        )

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_dashboard_export.csv"},
    )


@app.get("/api/face/status")
def face_status() -> dict[str, object]:
    return {
        "face_recognition_enabled": face_dependencies_available(),
        "geofence": get_face_geofence_settings(),
    }


@app.get("/api/face/geofence")
def face_geofence() -> dict[str, object]:
    return get_face_geofence_settings()


@app.put("/api/face/geofence")
def update_face_geofence(payload: FaceGeofenceUpdate) -> dict[str, object]:
    connection = get_connection()
    try:
        connection.execute(
            """
            UPDATE face_geofence_settings
            SET class_name = ?, latitude = ?, longitude = ?, radius_meters = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            """,
            (
                payload.class_name.strip(),
                payload.latitude,
                payload.longitude,
                payload.radius_meters,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return {
        "message": "Class geofence updated successfully.",
        "geofence": get_face_geofence_settings(),
    }


@app.post("/api/admin/register-student")
async def admin_register_student(
    name: str = Form(...),
    roll_number: str = Form(...),
    section: str = Form(...),
    career_goal: str = Form(...),
    weak_subjects: str = Form(""),
    strong_subjects: str = Form(""),
    interests: str = Form(""),
    photos: list[UploadFile] = File(...),
) -> dict[str, object]:
    valid_uploads = [photo for photo in photos if photo.filename]
    if len(valid_uploads) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

    photo_inputs: list[dict[str, object]] = []
    first_image_bytes: bytes | None = None
    for index, photo in enumerate(valid_uploads):
        photo_bytes = await photo.read()
        if not photo_bytes:
            continue
        if first_image_bytes is None:
            first_image_bytes = photo_bytes
        try:
            frame = decode_image_bytes_to_bgr(photo_bytes)
        except ValueError:
            continue
        photo_inputs.append(
            {
                "frame": frame,
                "with_glasses": index < 2,
            }
        )

    if len(photo_inputs) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM students WHERE lower(roll_number) = lower(?)",
            (roll_number.strip(),),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Student already exists for this roll number.")

        cursor = connection.execute(
            """
            INSERT INTO students (
                name,
                roll_number,
                section,
                career_goal,
                weak_subjects,
                strong_subjects,
                interests
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name.strip(),
                roll_number.strip(),
                section.strip(),
                career_goal.strip(),
                json_dumps(parse_multivalue_field(weak_subjects)),
                json_dumps(parse_multivalue_field(strong_subjects)),
                interests.strip(),
            ),
        )
        student_id = cursor.lastrowid
        registration_result = register_face(str(student_id), photo_inputs)
        image_path = save_registered_face_image(roll_number.strip(), first_image_bytes or b"")
        connection.execute(
            """
            UPDATE students
            SET face_encoding = ?, face_encodings_json = ?, glasses_face_encodings_json = ?, encoding_count = ?, image_path = ?
            WHERE id = ?
            """,
            (
                json_dumps(registration_result["face_encoding"]),
                json_dumps(registration_result["face_encodings"]),
                json_dumps(registration_result["glasses_face_encodings"]),
                registration_result["encoding_count"],
                image_path,
                student_id,
            ),
        )
        row = connection.execute(
            """
            SELECT id, name, roll_number, section, image_path, registered_at, encoding_count
            FROM students
            WHERE id = ?
            """,
            (student_id,),
        ).fetchone()
        upsert_legacy_face_student(connection, row["id"], row["name"], row["roll_number"], row["section"], row["image_path"], registration_result)
        connection.commit()
    finally:
        connection.close()

    return {
        "success": True,
        "student_id": row["id"],
        "student_name": row["name"],
        "photos_used": registration_result["photos_used"],
        "photos_skipped": registration_result["photos_skipped"],
    }


@app.post("/api/admin/register-bulk")
async def admin_register_bulk(csv_file: UploadFile = File(...)) -> dict[str, object]:
    if not csv_file.filename or not csv_file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid CSV file.")

    file_bytes = await csv_file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded CSV is empty.")

    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    required_columns = {"name", "roll_number", "section", "career_goal"}
    if not required_columns.issubset(set(reader.fieldnames or [])):
        raise HTTPException(status_code=400, detail="CSV must include name, roll_number, section, career_goal columns.")

    students_created = 0
    errors: list[dict[str, object]] = []
    connection = get_connection()
    try:
        for index, row in enumerate(reader, start=2):
            try:
                connection.execute(
                    """
                    INSERT INTO students (name, roll_number, section, career_goal)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        (row.get("name") or "").strip(),
                        (row.get("roll_number") or "").strip(),
                        (row.get("section") or "").strip(),
                        (row.get("career_goal") or "").strip(),
                    ),
                )
                students_created += 1
            except Exception as exc:
                errors.append({"row": index, "roll_number": row.get("roll_number"), "error": str(exc)})
        connection.commit()
    finally:
        connection.close()

    return {
        "success": True,
        "students_created": students_created,
        "errors": errors,
    }


@app.get("/api/admin/students")
def admin_list_students(section: str | None = None) -> dict[str, list[dict[str, object]]]:
    connection = get_connection()
    try:
        if section:
            rows = connection.execute(
                """
                SELECT id, name, roll_number, section, encoding_count, registered_at
                FROM students
                WHERE section = ?
                ORDER BY registered_at DESC, id DESC
                """,
                (section,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, name, roll_number, section, encoding_count, registered_at
                FROM students
                ORDER BY registered_at DESC, id DESC
                """
            ).fetchall()
    finally:
        connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "name": row["name"],
                "roll_number": row["roll_number"],
                "section": row["section"],
                "has_face_encoding": bool(row["encoding_count"]),
                "registered_at": row["registered_at"],
            }
            for row in rows
        ]
    }


@app.delete("/api/admin/student/{student_id}")
def admin_delete_student(student_id: int) -> dict[str, object]:
    connection = get_connection()
    try:
        student = connection.execute(
            "SELECT id, name, roll_number FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        connection.execute("DELETE FROM attendance_records WHERE student_name = ?", (student["name"],))
        connection.execute("DELETE FROM face_attendance_logs WHERE roll_number = ?", (student["roll_number"],))
        connection.execute("DELETE FROM students WHERE id = ?", (student_id,))
        delete_legacy_face_student(connection, student["roll_number"])
        connection.commit()
    finally:
        connection.close()

    return {"success": True, "message": "Student and related attendance records deleted successfully."}


@app.put("/api/admin/student/{student_id}/update-face")
async def admin_update_student_face(
    student_id: int,
    photos: list[UploadFile] = File(...),
) -> dict[str, object]:
    valid_uploads = [photo for photo in photos if photo.filename]
    if len(valid_uploads) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

    connection = get_connection()
    try:
        student = connection.execute(
            "SELECT id, name, roll_number, section FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        photo_inputs: list[dict[str, object]] = []
        first_image_bytes: bytes | None = None
        for index, photo in enumerate(valid_uploads):
            photo_bytes = await photo.read()
            if not photo_bytes:
                continue
            if first_image_bytes is None:
                first_image_bytes = photo_bytes
            try:
                frame = decode_image_bytes_to_bgr(photo_bytes)
            except ValueError:
                continue
            photo_inputs.append({"frame": frame, "with_glasses": index < 2})

        if len(photo_inputs) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

        registration_result = register_face(str(student_id), photo_inputs)
        image_path = save_registered_face_image(student["roll_number"], first_image_bytes or b"")
        connection.execute(
            """
            UPDATE students
            SET face_encoding = ?, face_encodings_json = ?, glasses_face_encodings_json = ?, encoding_count = ?, image_path = ?
            WHERE id = ?
            """,
            (
                json_dumps(registration_result["face_encoding"]),
                json_dumps(registration_result["face_encodings"]),
                json_dumps(registration_result["glasses_face_encodings"]),
                registration_result["encoding_count"],
                image_path,
                student_id,
            ),
        )
        upsert_legacy_face_student(
            connection,
            student_id,
            student["name"],
            student["roll_number"],
            student["section"],
            image_path,
            registration_result,
        )
        connection.commit()
    finally:
        connection.close()

    return {
        "success": True,
        "photos_used": registration_result["photos_used"],
        "photos_skipped": registration_result["photos_skipped"],
    }


@app.get("/api/face/students")
def list_face_students() -> dict[str, list[dict[str, object]]]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT id, name, roll_number, section, image_path, registered_at, encoding_count
            FROM students
            WHERE encoding_count > 0
            ORDER BY registered_at DESC, id DESC
            """
        ).fetchall()
    finally:
        connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "name": row["name"],
                "roll_number": row["roll_number"],
                "department": row["section"],
                "section": row["section"],
                "image_path": row["image_path"],
                "registered_at": row["registered_at"],
                "encoding_count": row["encoding_count"],
            }
            for row in rows
        ]
    }


@app.post("/api/face/register")
async def register_face_student(
    name: str = Form(...),
    roll_number: str = Form(...),
    department: str = Form(...),
    glasses_photo_count: int = Form(2),
    images: list[UploadFile] = File(...),
) -> dict[str, object]:
    valid_uploads = [image for image in images if image.filename]
    if not valid_uploads:
        raise HTTPException(status_code=400, detail="Please upload student face images.")
    if len(valid_uploads) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

    registration_inputs: list[dict[str, object]] = []
    first_image_bytes: bytes | None = None
    for index, image in enumerate(valid_uploads):
        image_bytes = await image.read()
        if not image_bytes:
            continue
        if first_image_bytes is None:
            first_image_bytes = image_bytes
        try:
            frame = decode_image_bytes_to_bgr(image_bytes)
        except ValueError:
            continue
        registration_inputs.append(
            {
                "frame": frame,
                "with_glasses": index < max(0, glasses_photo_count),
            }
        )

    if len(registration_inputs) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 clear photos.")

    try:
        registration_result = register_face(roll_number.strip(), registration_inputs)
        image_path = save_registered_face_image(roll_number.strip(), first_image_bytes or b"")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM students WHERE lower(roll_number) = lower(?)",
            (roll_number.strip(),),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Student face profile already exists for this roll number.")

        cursor = connection.execute(
            """
            INSERT INTO students (
                name,
                roll_number,
                section,
                career_goal,
                weak_subjects,
                strong_subjects,
                interests,
                face_encoding,
                face_encodings_json,
                glasses_face_encodings_json,
                encoding_count,
                image_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name.strip(),
                roll_number.strip(),
                department.strip(),
                "",
                "[]",
                "[]",
                "",
                json_dumps(registration_result["face_encoding"]),
                json_dumps(registration_result["face_encodings"]),
                json_dumps(registration_result["glasses_face_encodings"]),
                registration_result["encoding_count"],
                image_path,
            ),
        )
        connection.commit()
        student_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, name, roll_number, section, image_path, registered_at, encoding_count
            FROM students
            WHERE id = ?
            """,
            (student_id,),
        ).fetchone()
        upsert_legacy_face_student(connection, row["id"], row["name"], row["roll_number"], row["section"], row["image_path"], registration_result)
        connection.commit()
    finally:
        connection.close()

    return {
        "message": "Student face registered successfully.",
        "photos_used": registration_result["photos_used"],
        "photos_skipped": registration_result["photos_skipped"],
        "warnings": registration_result["warnings"],
        "item": {
            "id": row["id"],
            "name": row["name"],
            "roll_number": row["roll_number"],
            "department": row["section"],
            "image_path": row["image_path"],
            "registered_at": row["registered_at"],
            "encoding_count": row["encoding_count"],
        },
    }


@app.post("/api/attendance/mark")
@app.post("/api/face/attendance")
async def mark_face_attendance(
    request: Request,
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: UploadFile = File(...),
) -> dict[str, object]:
    if not image.filename:
        raise HTTPException(status_code=400, detail="Please upload a valid attendance image.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        frame = decode_image_bytes_to_bgr(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    feedback = get_face_scan_feedback(frame)
    quality = check_webcam_quality(frame)
    lighting = feedback["lighting"]
    client_ip = get_client_ip(request)

    if not feedback["ready_to_scan"]:
        attempt_count = record_scan_attempt(client_ip, feedback["reason"])
        if attempt_count == MAX_SCAN_ATTEMPTS:
            log_failed_attempt(client_ip, feedback["reason"])
        return {
            "status": "unverified",
            "matched": False,
            "reason": feedback["reason"],
            "message": feedback["message"],
            "lighting_condition": lighting,
            "feedback": feedback,
            "quality": quality,
            "attempt_count": attempt_count,
            "attempts_remaining": max(0, MAX_SCAN_ATTEMPTS - attempt_count),
        }

    if not quality["is_clear"]:
        attempt_count = record_scan_attempt(client_ip, "blurry_frame")
        if attempt_count == MAX_SCAN_ATTEMPTS:
            log_failed_attempt(client_ip, "blurry_frame")
        return {
            "status": "unverified",
            "matched": False,
            "reason": "blurry_frame",
            "message": quality["message"],
            "lighting_condition": lighting,
            "feedback": feedback,
            "quality": quality,
            "attempt_count": attempt_count,
            "attempts_remaining": max(0, MAX_SCAN_ATTEMPTS - attempt_count),
        }

    liveness = perform_basic_liveness_check(frame)
    if not liveness["passed"]:
        attempt_count = record_scan_attempt(client_ip, str(liveness["reason"]))
        if attempt_count == MAX_SCAN_ATTEMPTS:
            log_failed_attempt(client_ip, str(liveness["reason"]))
        return {
            "status": "unverified",
            "matched": False,
            "reason": liveness["reason"],
            "message": liveness["message"],
            "lighting_condition": lighting,
            "feedback": feedback,
            "quality": quality,
            "attempt_count": attempt_count,
            "attempts_remaining": max(0, MAX_SCAN_ATTEMPTS - attempt_count),
        }

    connection = get_connection()
    try:
        student_rows = connection.execute(
            """
            SELECT id, name, roll_number, face_encoding, face_encodings_json, glasses_face_encodings_json
            FROM students
            WHERE encoding_count > 0
            ORDER BY id ASC
            """
        ).fetchall()
        known_faces = [
            {
                "student_id": row["id"],
                "name": row["name"],
                "roll_number": row["roll_number"],
                "encodings": parse_face_encoding_groups(
                    row["face_encoding"],
                    row["face_encodings_json"],
                ),
                "glasses_encodings": parse_json_nested_array(row["glasses_face_encodings_json"]),
            }
            for row in student_rows
            if parse_face_encoding_groups(row["face_encoding"], row["face_encodings_json"])
        ]

        try:
            recognition = match_face(frame, known_faces)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        geofence = get_face_geofence_settings()
        gps_verified = is_within_geofence(
            latitude,
            longitude,
            geofence["latitude"],
            geofence["longitude"],
            geofence["radius_meters"],
        )
        distance_meters = round(
            get_distance_meters(
                latitude,
                longitude,
                geofence["latitude"],
                geofence["longitude"],
            ),
            2,
        )

        student_id = None
        student_name = recognition["student_name"] if recognition["student_name"] else "Unknown"
        roll_number = recognition["roll_number"] if recognition["roll_number"] else "unknown"
        status = "present" if recognition["matched"] and gps_verified else "unverified"

        connection.execute(
            """
            INSERT INTO face_attendance_logs (
                student_id,
                student_name,
                roll_number,
                latitude,
                longitude,
                gps_verified,
                face_verified,
                confidence,
                distance_meters,
                status,
                reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student_id,
                student_name,
                roll_number,
                latitude,
                longitude,
                1 if gps_verified else 0,
                1 if recognition["matched"] else 0,
                recognition["confidence_score"],
                distance_meters,
                status,
                recognition["reason"],
            ),
        )
        connection.commit()
    finally:
        connection.close()

    if status == "present":
        reset_scan_attempts(client_ip)
    else:
        attempt_count = record_scan_attempt(client_ip, str(recognition["reason"]))
        if attempt_count == MAX_SCAN_ATTEMPTS:
            log_failed_attempt(client_ip, str(recognition["reason"]), student_name, roll_number)
    attempts_state = get_scan_attempt_state(client_ip)
    attempts_used = int(attempts_state["count"]) if attempts_state else 0

    return {
        "status": status,
        "student_name": student_name,
        "roll_number": roll_number,
        "class_name": geofence["class_name"],
        "gps_verified": gps_verified,
        "face_verified": recognition["matched"],
        "confidence_score": recognition["confidence_score"],
        "distance": recognition["distance"],
        "distance_meters": distance_meters,
        "allowed_radius_meters": geofence["radius_meters"],
        "reason": recognition["reason"],
        "message": recognition["message"],
        "lighting_condition": recognition["lighting"],
        "matched_with_glasses_profile": recognition["matched_with_glasses_profile"],
        "feedback": feedback,
        "quality": quality,
        "attempt_count": attempts_used,
        "attempts_remaining": max(0, MAX_SCAN_ATTEMPTS - attempts_used),
    }


@app.get("/api/face/unverified")
def list_unverified_face_attendance() -> dict[str, list[dict[str, object]]]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT id, student_name, roll_number, distance_meters, reason, created_at
            FROM face_attendance_logs
            WHERE status = 'unverified'
            ORDER BY created_at DESC, id DESC
            LIMIT 20
            """
        ).fetchall()
    finally:
        connection.close()

    return {
        "items": [
            {
                "id": row["id"],
                "student_name": row["student_name"],
                "roll_number": row["roll_number"],
                "distance_meters": row["distance_meters"],
                "reason": row["reason"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


def json_dumps(value: object) -> str:
    import json

    return json.dumps(value)


def parse_json_array(value: str) -> list[float] | None:
    import json

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    if parsed and isinstance(parsed[0], list):
        return None
    return parsed


def parse_json_nested_array(value: str | None) -> list[list[float]]:
    import json

    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, list)]


def parse_face_encoding_groups(primary_encoding: str, grouped_encodings: str | None) -> list[list[float]]:
    encodings = parse_json_nested_array(grouped_encodings)
    if encodings:
        return encodings
    primary = parse_json_array(primary_encoding)
    return [primary] if primary else []


def parse_multivalue_field(raw_value: str) -> list[str]:
    value = raw_value.strip()
    if not value:
        return []
    if value.startswith("["):
        parsed_flat = parse_json_array(value)
        if parsed_flat:
            return [str(item).strip() for item in parsed_flat if str(item).strip()]
    return [item.strip() for item in value.split(",") if item.strip()]


def upsert_legacy_face_student(
    connection,
    student_id: int,
    name: str,
    roll_number: str,
    section: str,
    image_path: str | None,
    registration_result: dict[str, object],
) -> None:
    connection.execute(
        """
        INSERT INTO face_students (
            id,
            name,
            roll_number,
            department,
            face_encoding,
            image_path,
            face_encodings_json,
            glasses_face_encodings_json,
            encoding_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(roll_number) DO UPDATE SET
            name = excluded.name,
            department = excluded.department,
            face_encoding = excluded.face_encoding,
            image_path = excluded.image_path,
            face_encodings_json = excluded.face_encodings_json,
            glasses_face_encodings_json = excluded.glasses_face_encodings_json,
            encoding_count = excluded.encoding_count
        """,
        (
            student_id,
            name,
            roll_number,
            section,
            json_dumps(registration_result["face_encoding"]),
            image_path or "",
            json_dumps(registration_result["face_encodings"]),
            json_dumps(registration_result["glasses_face_encodings"]),
            registration_result["encoding_count"],
        ),
    )


def delete_legacy_face_student(connection, roll_number: str) -> None:
    connection.execute("DELETE FROM face_students WHERE roll_number = ?", (roll_number,))


def get_face_geofence_settings() -> dict[str, object]:
    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT class_name, latitude, longitude, radius_meters, updated_at
            FROM face_geofence_settings
            WHERE id = 1
            """
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        return {
            "class_name": "Main Classroom",
            "latitude": 31.3956,
            "longitude": 75.5352,
            "radius_meters": 50.0,
            "updated_at": None,
        }

    return {
        "class_name": row["class_name"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "radius_meters": row["radius_meters"],
        "updated_at": row["updated_at"],
    }


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_scan_attempt_state(ip_address: str) -> dict[str, object] | None:
    existing = SCAN_ATTEMPTS.get(ip_address)
    if not existing:
        return None

    last_attempt_at = existing.get("last_attempt_at")
    if not isinstance(last_attempt_at, datetime):
        SCAN_ATTEMPTS.pop(ip_address, None)
        return None

    if datetime.utcnow() - last_attempt_at > ATTEMPT_WINDOW:
        SCAN_ATTEMPTS.pop(ip_address, None)
        return None

    return existing


def record_scan_attempt(ip_address: str, reason: str) -> int:
    existing = get_scan_attempt_state(ip_address)
    if existing is None:
        SCAN_ATTEMPTS[ip_address] = {
            "count": 1,
            "reason": reason,
            "last_attempt_at": datetime.utcnow(),
        }
        return 1

    existing["count"] = int(existing["count"]) + 1
    existing["reason"] = reason
    existing["last_attempt_at"] = datetime.utcnow()
    return int(existing["count"])


def reset_scan_attempts(ip_address: str) -> None:
    SCAN_ATTEMPTS.pop(ip_address, None)


def log_failed_attempt(
    ip_address: str,
    reason: str,
    student_name: str = "Unknown",
    roll_number: str = "unknown",
) -> None:
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO failed_attempts (ip_address, reason, student_name, roll_number, attempt_count)
            VALUES (?, ?, ?, ?, ?)
            """,
            (ip_address, reason, student_name, roll_number, MAX_SCAN_ATTEMPTS),
        )
        connection.commit()
    finally:
        connection.close()
