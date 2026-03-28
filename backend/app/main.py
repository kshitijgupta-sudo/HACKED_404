from __future__ import annotations

import csv
import io
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .database import get_connection, init_db
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

    return {
        "attendance_records": attendance_items,
        "absent_students": absent_students,
        "attendance_chart": attendance_chart,
        "curriculum_chart": curriculum_chart,
        "summary": {
            "records_today": len(todays_records),
            "present_today": present_today,
            "absent_today": sum(1 for item in todays_records if item["status"] == "Absent"),
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
