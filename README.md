# Smart Academic Management System

Production-ready full-stack web application for parsing academic timetable PDFs and storing the extracted schedule in SQLite.

## Stack

- Frontend: React with Vite and Tailwind CSS
- Backend: FastAPI with SQLite
- Charts: Chart.js
- PDF parsing: PyMuPDF (`fitz`)
- State management: React Context API

## Features

- Upload timetable PDFs from the browser
- Extract subject names, time slots, and room numbers with PyMuPDF
- Fall back to OCR for scanned timetable PDFs when Tesseract is installed
- Persist parsed entries into SQLite
- Display timetable records immediately in the UI
- View simple subject analytics with Chart.js
- Add curriculum subjects and topics from the teacher view
- Mark topics as completed and track syllabus coverage
- Show student progress per subject with weak-subject alerts and study suggestions
- View a teacher/institution dashboard with attendance records, absent lists, and live charts
- Export attendance records as CSV
- Auto-refresh dashboard metrics every 30 seconds

## Project structure

```text
backend/
  app/
    database.py
    main.py
    parser.py
  requirements.txt
frontend/
  src/
    components/
    context/
```

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API will run at `http://127.0.0.1:8000`.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at `http://127.0.0.1:5173`.

## Start both together

From the project root:

```bash
npm run dev
```

This starts:

- FastAPI at `http://127.0.0.1:8000`
- Vite frontend at `http://127.0.0.1:5173`

The script also checks the backend health endpoint and prints the URLs once startup succeeds.

## REST API

- `GET /api/health`
- `GET /api/timetable`
- `POST /api/timetable/upload`
- `DELETE /api/timetable`
- `GET /api/curriculum`
- `GET /api/curriculum/progress`
- `POST /api/curriculum/subjects`
- `POST /api/curriculum/subjects/{subject_id}/topics`
- `PATCH /api/curriculum/topics/{topic_id}`
- `GET /api/dashboard`
- `GET /api/dashboard/export.csv`

## Notes

- The parser is designed for text-based timetable PDFs. If a PDF is image-only or heavily irregular, OCR or custom parsing rules may be needed.
- SQLite database file is created automatically at `backend/data/smart_academic.db`.
- Optional OCR setup for scanned PDFs:

```bash
brew install tesseract
cd backend
python3 -m pip install -r requirements.txt
```

- If Tesseract is not installed, the app still works normally for text-based PDFs and fails safely with a helpful message for scanned ones.
