from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import init_db, get_db
from app.models.student import Student, Attendance
from app.utils.face import register_face, recognize_face
from app.utils.gps import is_within_geofence, get_distance
from app.utils.camera import frame_from_bytes
import json
import os
import shutil

app = FastAPI(title="HACKED 404 - SmartCampus API")

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "SmartCampus API is running 🚀", "team": "HACKED 404"}

# ── REGISTER STUDENT ─────────────────────────────────────────────────────────
@app.post("/register")
async def register_student(
    name: str,
    roll_number: str,
    department: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Check if student already exists
    existing = db.query(Student).filter(Student.roll_number == roll_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already registered")

    # Save uploaded image temporarily
    temp_path = f"known_faces/temp_{roll_number}.jpg"
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    # Register face
    encoding = register_face(temp_path, roll_number)
    if not encoding:
        os.remove(temp_path)
        raise HTTPException(status_code=400, detail="No face detected in image")

    # Clean up temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # Save to database
    student = Student(
        name=name,
        roll_number=roll_number,
        department=department,
        face_encoding=encoding
    )
    db.add(student)
    db.commit()

    return {"message": f"Student {name} registered successfully!", "roll_number": roll_number}

# ── MARK ATTENDANCE ───────────────────────────────────────────────────────────
@app.post("/attendance")
async def mark_attendance(
    latitude: float,
    longitude: float,
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Step 1 — GPS check
    gps_verified = is_within_geofence(latitude, longitude)
    distance = get_distance(latitude, longitude)

    # Step 2 — Face recognition
    image_bytes = await image.read()
    frame = frame_from_bytes(image_bytes)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    result = recognize_face(frame)

    # Step 3 — Both checks
    if result["recognized"] and gps_verified:
        student = db.query(Student).filter(
            Student.roll_number == result["roll_number"]
        ).first()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        # Mark present
        attendance = Attendance(
            student_id=student.id,
            student_name=student.name,
            roll_number=student.roll_number,
            method="face",
            gps_verified=True,
            face_verified=True,
            status="present"
        )
        db.add(attendance)
        db.commit()

        return {
            "status": "present",
            "student": student.name,
            "roll_number": student.roll_number,
            "gps_verified": True,
            "face_verified": True,
            "confidence": result["confidence"],
            "distance_from_class": round(distance, 2)
        }

    # Step 4 — Verification failed
    return {
        "status": "unverified",
        "face_recognized": result["recognized"],
        "gps_verified": gps_verified,
        "reason": result["reason"],
        "distance_from_class": round(distance, 2),
        "message": "Added to professor's manual check list"
    }

# ── GET ATTENDANCE ────────────────────────────────────────────────────────────
@app.get("/attendance/{roll_number}")
def get_attendance(roll_number: str, db: Session = Depends(get_db)):
    records = db.query(Attendance).filter(
        Attendance.roll_number == roll_number
    ).all()

    return {
        "roll_number": roll_number,
        "total_classes": len(records),
        "present": len([r for r in records if r.status == "present"]),
        "records": [
            {
                "date": str(r.timestamp),
                "status": r.status,
                "method": r.method,
                "gps_verified": r.gps_verified,
                "face_verified": r.face_verified
            } for r in records
        ]
    }

# ── UNVERIFIED LIST FOR PROFESSOR ─────────────────────────────────────────────
@app.get("/unverified")
def get_unverified(db: Session = Depends(get_db)):
    records = db.query(Attendance).filter(
        Attendance.status == "unverified"
    ).all()

    return {
        "total": len(records),
        "students": [
            {
                "name": r.student_name,
                "roll_number": r.roll_number,
                "timestamp": str(r.timestamp)
            } for r in records
        ]
    }