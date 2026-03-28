import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";

export default function FaceRegistrationPanel() {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    rollNumber: "",
    department: "",
    glassesPhotoCount: "2",
    images: [],
  });
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState({ enabled: false, checked: false });
  const [geofence, setGeofence] = useState({
    className: "",
    latitude: "",
    longitude: "",
    radiusMeters: "50",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingGeofence, setIsSavingGeofence] = useState(false);

  const fetchData = async () => {
    try {
      const [statusData, studentsData, geofenceData] = await Promise.all([
        api.get("/api/face/status"),
        api.get("/api/face/students"),
        api.get("/api/face/geofence"),
      ]);
      setStatus({ enabled: statusData.face_recognition_enabled, checked: true });
      setStudents(studentsData.items ?? []);
      setGeofence({
        className: geofenceData.class_name ?? "",
        latitude: String(geofenceData.latitude ?? ""),
        longitude: String(geofenceData.longitude ?? ""),
        radiusMeters: String(geofenceData.radius_meters ?? "50"),
      });
    } catch (fetchError) {
      setStatus({ enabled: false, checked: true });
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load face registration data.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.images.length < 3) {
      setError("Please upload at least 3 clear student face images.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("roll_number", form.rollNumber);
    payload.append("department", form.department);
    payload.append("glasses_photo_count", form.glassesPhotoCount);
    form.images.forEach((image) => payload.append("images", image));

    try {
      await api.post("/api/face/register", payload);
      setMessage("Student face registered successfully.");
      setForm({ name: "", rollNumber: "", department: "", glassesPhotoCount: "2", images: [] });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeofenceSubmit = async (event) => {
    event.preventDefault();
    setIsSavingGeofence(true);
    setError("");
    setMessage("");

    try {
      const response = await api.put("/api/face/geofence", {
        class_name: geofence.className,
        latitude: Number(geofence.latitude),
        longitude: Number(geofence.longitude),
        radius_meters: Number(geofence.radiusMeters),
      });
      const saved = response.geofence;
      setGeofence({
        className: saved.class_name,
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        radiusMeters: String(saved.radius_meters),
      });
      setMessage("Class coordinates saved successfully.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save class coordinates.");
    } finally {
      setIsSavingGeofence(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Face Registration</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Teacher setup for face attendance</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Register multiple student photos so attendance stays reliable in dim rooms, side angles, and with or without glasses.
        </p>
      </div>

      <div className="mb-4 rounded-2xl bg-[var(--surface-strong)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--text)]">Recognition engine</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {status.checked
            ? status.enabled
              ? "Enabled and ready for face registration."
              : "Disabled. Install the `face_recognition` Python package on the backend to activate this feature."
            : "Checking recognition status..."}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Best result: upload 5 photos. Use 2 with glasses and 3 without glasses when applicable.
        </p>
      </div>

      <form className="mb-6 grid gap-4 md:grid-cols-2" onSubmit={handleGeofenceSubmit}>
        <div className="md:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--secondary)]">Class Geofence</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Teachers can set the classroom coordinates once, and students will be checked against this saved location automatically.
          </p>
        </div>
        <input
          type="text"
          placeholder="Class name"
          value={geofence.className}
          onChange={(event) => setGeofence((current) => ({ ...current, className: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="number"
          step="0.000001"
          placeholder="Class latitude"
          value={geofence.latitude}
          onChange={(event) => setGeofence((current) => ({ ...current, latitude: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="number"
          step="0.000001"
          placeholder="Class longitude"
          value={geofence.longitude}
          onChange={(event) => setGeofence((current) => ({ ...current, longitude: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="number"
          min="1"
          max="1000"
          step="1"
          placeholder="Allowed radius in meters"
          value={geofence.radiusMeters}
          onChange={(event) => setGeofence((current) => ({ ...current, radiusMeters: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSavingGeofence}
            className="rounded-full border border-[var(--surface-border)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingGeofence ? "Saving coordinates..." : "Save Class Coordinates"}
          </button>
        </div>
      </form>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Student name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="text"
          placeholder="Roll number"
          value={form.rollNumber}
          onChange={(event) => setForm((current) => ({ ...current, rollNumber: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="text"
          placeholder="Department"
          value={form.department}
          onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          type="number"
          min="0"
          max="5"
          placeholder="Glasses photo count"
          value={form.glassesPhotoCount}
          onChange={(event) => setForm((current) => ({ ...current, glassesPhotoCount: event.target.value }))}
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              images: Array.from(event.target.files ?? []),
            }))
          }
          className="rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-white"
        />

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!status.enabled || isSaving}
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Registering..." : "Register Face"}
          </button>
          {message ? <p className="text-sm text-[var(--primary)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-lg font-bold text-[var(--text)]">Registered face profiles</h3>
        <div className="mt-3 space-y-3">
          {students.length ? (
            students.slice(0, 8).map((student) => (
              <div key={student.id} className="rounded-2xl bg-[var(--surface-strong)] px-4 py-4">
                <p className="font-semibold text-[var(--text)]">{student.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {student.roll_number} • {student.department} • {student.encoding_count} encodings
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No student face profiles registered yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
