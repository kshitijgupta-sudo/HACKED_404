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
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                roll_number TEXT NOT NULL UNIQUE,
                section TEXT NOT NULL DEFAULT '',
                career_goal TEXT NOT NULL DEFAULT '',
                weak_subjects TEXT NOT NULL DEFAULT '[]',
                strong_subjects TEXT NOT NULL DEFAULT '[]',
                interests TEXT NOT NULL DEFAULT '',
                face_encoding TEXT,
                face_encodings_json TEXT NOT NULL DEFAULT '[]',
                glasses_face_encodings_json TEXT NOT NULL DEFAULT '[]',
                encoding_count INTEGER NOT NULL DEFAULT 0,
                image_path TEXT,
                registered_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS face_students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                roll_number TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL,
                face_encoding TEXT NOT NULL,
                image_path TEXT NOT NULL,
                registered_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        ensure_column(connection, "face_students", "face_encodings_json", "TEXT DEFAULT '[]'")
        ensure_column(connection, "face_students", "glasses_face_encodings_json", "TEXT DEFAULT '[]'")
        ensure_column(connection, "face_students", "encoding_count", "INTEGER NOT NULL DEFAULT 0")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS face_attendance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                student_name TEXT NOT NULL,
                roll_number TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                gps_verified INTEGER NOT NULL DEFAULT 0,
                face_verified INTEGER NOT NULL DEFAULT 0,
                confidence REAL NOT NULL DEFAULT 0,
                distance_meters REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL CHECK(status IN ('present', 'unverified')),
                reason TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES face_students (id) ON DELETE SET NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS failed_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                reason TEXT NOT NULL,
                student_name TEXT NOT NULL DEFAULT 'Unknown',
                roll_number TEXT NOT NULL DEFAULT 'unknown',
                attempt_count INTEGER NOT NULL DEFAULT 3,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS face_geofence_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                class_name TEXT NOT NULL DEFAULT 'Main Classroom',
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                radius_meters REAL NOT NULL DEFAULT 50,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO face_geofence_settings (
                id,
                class_name,
                latitude,
                longitude,
                radius_meters
            )
            VALUES (1, 'Main Classroom', 31.3956, 75.5352, 50)
            """
        )
        migrate_face_students_to_students(connection)
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


def ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    existing_columns = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in existing_columns:
        connection.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
        )


def migrate_face_students_to_students(connection: sqlite3.Connection) -> None:
    legacy_rows = connection.execute(
        """
        SELECT
            id,
            name,
            roll_number,
            department,
            face_encoding,
            face_encodings_json,
            glasses_face_encodings_json,
            encoding_count,
            image_path,
            registered_at
        FROM face_students
        """
    ).fetchall()

    for row in legacy_rows:
        connection.execute(
            """
            INSERT OR IGNORE INTO students (
                id,
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
                image_path,
                registered_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["name"],
                row["roll_number"],
                row["department"],
                "",
                "[]",
                "[]",
                "",
                row["face_encoding"],
                row["face_encodings_json"],
                row["glasses_face_encodings_json"],
                row["encoding_count"],
                row["image_path"],
                row["registered_at"],
            ),
        )
