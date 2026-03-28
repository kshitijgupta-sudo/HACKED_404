from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    roll_number = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=False)
    face_encoding = Column(String, nullable=True)
    registered_at = Column(DateTime, default=func.now())

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False)
    student_name = Column(String, nullable=False)
    roll_number = Column(String, nullable=False)
    timestamp = Column(DateTime, default=func.now())
    method = Column(String, default="face")
    gps_verified = Column(Boolean, default=False)
    face_verified = Column(Boolean, default=False)
    status = Column(String, default="present")