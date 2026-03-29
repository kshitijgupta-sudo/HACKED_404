from __future__ import annotations

import sqlite3
from datetime import date, timedelta
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = DATA_DIR / "smart_academic.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS timetable (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_name TEXT NOT NULL,
                time TEXT NOT NULL,
                room_number TEXT NOT NULL,
                source_file TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                is_completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS attendance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attendance_date TEXT NOT NULL,
                student_name TEXT NOT NULL,
                subject_name TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        seed_attendance_records(connection)
        connection.commit()
    finally:
        connection.close()


def seed_attendance_records(connection: sqlite3.Connection) -> None:
    existing_records = connection.execute(
        "SELECT COUNT(*) AS count FROM attendance_records"
    ).fetchone()["count"]
    if existing_records:
        return

    students = [
        "Aarav Sharma",
        "Diya Patel",
        "Kabir Singh",
        "Meera Joshi",
        "Rohan Gupta",
    ]
    subjects = [
        "Mathematics-II",
        "Python Lab",
        "Basic Electronics",
        "Mechanical Engineering",
    ]
    today = date.today()
    rows: list[tuple[str, str, str, str]] = []

    for day_offset in range(6, -1, -1):
        current_day = today - timedelta(days=day_offset)
        for index, student in enumerate(students):
            subject = subjects[(index + day_offset) % len(subjects)]
            absent = (index + day_offset) % 4 == 0
            status = "Absent" if absent else "Present"
            rows.append(
                (
                    current_day.isoformat(),
                    student,
                    subject,
                    status,
                )
            )

    connection.executemany(
        """
        INSERT INTO attendance_records (
            attendance_date,
            student_name,
            subject_name,
            status
        )
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )
