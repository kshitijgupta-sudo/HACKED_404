import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import WorkspaceTabs from "./WorkspaceTabs";

const PHOTO_STEPS = [
  "Look straight at camera",
  "Turn slightly left",
  "Turn slightly right",
  "Look slightly up",
  "Normal position - final photo",
];

const SECTION_OPTIONS = ["CS-A", "CS-B", "EC-A", "EE-A", "ME-A"];
const CAREER_GOALS = ["Software Engineer", "Data Scientist", "Electronics", "Chemical"];
const SUBJECT_OPTIONS = ["Math", "Physics", "Chemistry", "Python", "Electronics", "Mechanics"];

export default function AdminRegisterScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const updateFaceInputRef = useRef(null);
  const selectedStudentRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [activePage, setActivePage] = useState("single");
  const [singleForm, setSingleForm] = useState({
    name: "",
    rollNumber: "",
    section: SECTION_OPTIONS[0],
    careerGoal: CAREER_GOALS[0],
    weakSubjects: [],
    strongSubjects: [],
    interests: "",
  });
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [singleMessage, setSingleMessage] = useState("");
  const [singleError, setSingleError] = useState("");
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [listError, setListError] = useState("");
  const [isUpdatingFace, setIsUpdatingFace] = useState(false);

  useEffect(() => {
    let mounted = true;
    let localStream = null;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStream = mediaStream;
        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch {
        setSingleError("Unable to access webcam. Please allow camera access for photo capture.");
      }
    };

    startCamera();
    fetchStudents();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    fetchStudents(sectionFilter);
  }, [sectionFilter]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return students;
    }
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.roll_number.toLowerCase().includes(query),
    );
  }, [students, searchTerm]);
  const tabs = [
    { id: "single", label: "Single Register" },
    { id: "bulk", label: "Bulk Import" },
    { id: "directory", label: "Student Directory" },
  ];

  async function fetchStudents(section = "") {
    try {
      const query = section ? `?section=${encodeURIComponent(section)}` : "";
      const response = await api.get(`/api/admin/students${query}`);
      setStudents(response.items ?? []);
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load students.");
    }
  }

  function handleSubjectSelection(field, values) {
    setSingleForm((current) => ({ ...current, [field]: values }));
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || capturedPhotos.length >= PHOTO_STEPS.length) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const file = new File([blob], `capture-${capturedPhotos.length + 1}.jpg`, { type: "image/jpeg" });
      setCapturedPhotos((current) => [...current, file]);
    }, "image/jpeg", 0.92);
  }

  function resetPhotos() {
    setCapturedPhotos([]);
  }

  async function submitSingleStudent(event) {
    event.preventDefault();
    if (capturedPhotos.length !== PHOTO_STEPS.length) {
      setSingleError("Capture all 5 photos before submitting.");
      return;
    }

    setIsSubmittingSingle(true);
    setSingleError("");
    setSingleMessage("");

    const payload = new FormData();
    payload.append("name", singleForm.name);
    payload.append("roll_number", singleForm.rollNumber);
    payload.append("section", singleForm.section);
    payload.append("career_goal", singleForm.careerGoal);
    payload.append("weak_subjects", singleForm.weakSubjects.join(","));
    payload.append("strong_subjects", singleForm.strongSubjects.join(","));
    payload.append("interests", singleForm.interests);
    capturedPhotos.forEach((photo) => payload.append("photos", photo));

    try {
      const response = await api.post("/api/admin/register-student", payload);
      setSingleMessage(`${response.student_name} (${response.student_id}) registered. Face registered successfully.`);
      setSingleForm({
        name: "",
        rollNumber: "",
        section: SECTION_OPTIONS[0],
        careerGoal: CAREER_GOALS[0],
        weakSubjects: [],
        strongSubjects: [],
        interests: "",
      });
      setCapturedPhotos([]);
      fetchStudents(sectionFilter);
    } catch (error) {
      setSingleError(error instanceof Error ? error.message : "Unable to register student.");
    } finally {
      setIsSubmittingSingle(false);
    }
  }

  async function handleBulkPreview(file) {
    setBulkFile(file);
    setBulkMessage("");
    setBulkError("");
    if (!file) {
      setBulkPreview([]);
      return;
    }
    const text = await file.text();
    const previewRows = parseCsvRows(text).slice(0, 5);
    setBulkPreview(previewRows);
  }

  async function importBulkStudents() {
    if (!bulkFile) {
      setBulkError("Please choose a CSV file first.");
      return;
    }

    setIsImportingBulk(true);
    setBulkError("");
    setBulkMessage("");
    const payload = new FormData();
    payload.append("csv_file", bulkFile);

    try {
      const response = await api.post("/api/admin/register-bulk", payload);
      setBulkMessage(`${response.students_created} students imported, ${response.errors.length} errors.`);
      fetchStudents(sectionFilter);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk import failed.");
    } finally {
      setIsImportingBulk(false);
    }
  }

  async function deleteStudent(studentId) {
    const confirmed = window.confirm("Delete this student and related attendance records?");
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/admin/student/${studentId}`);
      fetchStudents(sectionFilter);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to delete student.");
    }
  }

  function openUpdateFace(studentId) {
    selectedStudentRef.current = studentId;
    updateFaceInputRef.current?.click();
  }

  async function handleUpdateFace(files) {
    const studentId = selectedStudentRef.current;
    if (!studentId || !files?.length) {
      return;
    }
    setIsUpdatingFace(true);
    const payload = new FormData();
    Array.from(files).forEach((file) => payload.append("photos", file));

    try {
      await api.put(`/api/admin/student/${studentId}/update-face`, payload);
      fetchStudents(sectionFilter);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to update student face.");
    } finally {
      setIsUpdatingFace(false);
      if (updateFaceInputRef.current) {
        updateFaceInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Admin Registration</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Student registration admin panel</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Register single students with 5 guided webcam captures, bulk import CSVs, and manage face-registration status for large classes without exposing every operational block at once.
        </p>
      </section>

      <WorkspaceTabs tabs={tabs} activeTab={activePage} onChange={setActivePage} />

      {activePage === "single" ? (
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Section 1</p>
          <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Register single student</h3>

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitSingleStudent}>
            <input
              type="text"
              placeholder="Full Name"
              value={singleForm.name}
              onChange={(event) => setSingleForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              placeholder="Roll Number"
              value={singleForm.rollNumber}
              onChange={(event) => setSingleForm((current) => ({ ...current, rollNumber: event.target.value }))}
              className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
            />
            <select
              value={singleForm.section}
              onChange={(event) => setSingleForm((current) => ({ ...current, section: event.target.value }))}
              className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
            >
              {SECTION_OPTIONS.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
            <select
              value={singleForm.careerGoal}
              onChange={(event) => setSingleForm((current) => ({ ...current, careerGoal: event.target.value }))}
              className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
            >
              {CAREER_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
            <MultiSelect
              label="Weak Subjects"
              options={SUBJECT_OPTIONS}
              values={singleForm.weakSubjects}
              onChange={(values) => handleSubjectSelection("weakSubjects", values)}
            />
            <MultiSelect
              label="Strong Subjects"
              options={SUBJECT_OPTIONS}
              values={singleForm.strongSubjects}
              onChange={(values) => handleSubjectSelection("strongSubjects", values)}
            />
            <input
              type="text"
              placeholder="Interests"
              value={singleForm.interests}
              onChange={(event) => setSingleForm((current) => ({ ...current, interests: event.target.value }))}
              className="md:col-span-2 rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
            />

            <div className="md:col-span-2 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="lg:w-[55%]">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl bg-black/80" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--secondary)]">
                    Photo {Math.min(capturedPhotos.length + 1, PHOTO_STEPS.length)} of {PHOTO_STEPS.length}
                  </p>
                  <p className="mt-3 text-lg font-bold text-[var(--text)]">
                    {capturedPhotos.length < PHOTO_STEPS.length ? PHOTO_STEPS[capturedPhotos.length] : "All photos captured"}
                  </p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${(capturedPhotos.length / PHOTO_STEPS.length) * 100}%` }}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={capturedPhotos.length >= PHOTO_STEPS.length}
                      className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={resetPhotos}
                      className="rounded-full border border-[var(--surface-border)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-white/70"
                    >
                      Reset Photos
                    </button>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-5">
                    {PHOTO_STEPS.map((step, index) => (
                      <div key={step} className={`rounded-2xl px-3 py-3 text-center text-xs ${capturedPhotos[index] ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-white/70 text-[var(--muted)]"}`}>
                        {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmittingSingle}
                className="rounded-full bg-[var(--secondary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingSingle ? "Registering..." : "Register Student"}
              </button>
              {singleMessage ? <p className="text-sm text-[var(--primary)]">{singleMessage}</p> : null}
              {singleError ? <p className="text-sm text-[var(--danger)]">{singleError}</p> : null}
            </div>
          </form>
        </section>
      ) : null}

      {activePage === "bulk" ? (
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Section 2</p>
            <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Bulk import</h3>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleBulkPreview(event.target.files?.[0] ?? null)}
              className="mt-4 w-full rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-white"
            />

            {bulkPreview.length ? (
              <div className="mt-4 overflow-x-auto rounded-2xl bg-[var(--surface-strong)] p-4">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Roll Number</th>
                      <th className="pb-2">Section</th>
                      <th className="pb-2">Career Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.map((row, index) => (
                      <tr key={`${row.roll_number}-${index}`} className="border-t border-[var(--surface-border)]">
                        <td className="py-2">{row.name}</td>
                        <td className="py-2">{row.roll_number}</td>
                        <td className="py-2">{row.section}</td>
                        <td className="py-2">{row.career_goal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={importBulkStudents}
                disabled={isImportingBulk}
                className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImportingBulk ? "Importing..." : "Import CSV"}
              </button>
              {bulkMessage ? <p className="text-sm text-[var(--primary)]">{bulkMessage}</p> : null}
              {bulkError ? <p className="text-sm text-[var(--danger)]">{bulkError}</p> : null}
            </div>
        </section>
      ) : null}

      {activePage === "directory" ? (
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Section 3</p>
            <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Student list</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                placeholder="Search by name or roll number"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
              />
              <select
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
                className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
              >
                <option value="">All Sections</option>
                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={updateFaceInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleUpdateFace(event.target.files)}
            />

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Roll Number</th>
                    <th className="pb-3">Section</th>
                    <th className="pb-3">Registered</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-t border-[var(--surface-border)]">
                      <td className="py-3">
                        <span className={`inline-block h-3 w-3 rounded-full ${student.has_face_encoding ? "bg-emerald-500" : "bg-rose-500"}`} />
                      </td>
                      <td className="py-3 font-medium text-[var(--text)]">{student.name}</td>
                      <td className="py-3">{student.roll_number}</td>
                      <td className="py-3">{student.section}</td>
                      <td className="py-3">{student.registered_at}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openUpdateFace(student.id)}
                            disabled={isUpdatingFace}
                            className="rounded-full border border-[var(--surface-border)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-white/70"
                          >
                            Update Face
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStudent(student.id)}
                            className="rounded-full border border-[rgba(189,74,74,0.2)] px-3 py-2 text-xs font-semibold text-[var(--danger)] transition hover:bg-[rgba(189,74,74,0.08)]"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listError ? <p className="mt-3 text-sm text-[var(--danger)]">{listError}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function MultiSelect({ label, options, values, onChange }) {
  return (
    <label className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm">
      <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{label}</span>
      <select
        multiple
        value={values}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions, (option) => option.value))
        }
        className="min-h-[110px] w-full bg-transparent outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});
  });
}
