import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function FaceAttendancePanel() {
  const [image, setImage] = useState(null);
  const [geo, setGeo] = useState({ latitude: "", longitude: "" });
  const [classroom, setClassroom] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("Detecting your location automatically...");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const detectLocation = () => {
    setError("");
    setLocationMessage("Detecting your location automatically...");
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        });
        setLocationMessage("Your current location has been captured.");
      },
      () => {
        setLocationMessage("Unable to access location automatically. Please allow location permission and try again.");
      },
    );
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const geofence = await api.get("/api/face/geofence");
        setClassroom(geofence);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load class details.");
      }
    };

    loadData();
    detectLocation();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!image) {
      setError("Please upload a face image to mark attendance.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const payload = new FormData();
    payload.append("latitude", geo.latitude);
    payload.append("longitude", geo.longitude);
    payload.append("image", image);

    try {
      const response = await api.post("/api/face/attendance", payload);
      setResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Attendance marking failed.");
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Face Attendance</p>
        <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Mark attendance with selfie + location</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Upload a student face image. The system uses your browser location automatically and checks it against the class coordinates set by the teacher.
        </p>
      </div>

      {classroom ? (
        <div className="mb-4 rounded-2xl bg-[var(--surface-strong)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--text)]">Class location</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {classroom.class_name} • {classroom.latitude}, {classroom.longitude} • Radius {classroom.radius_meters}m
          </p>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          className="w-full rounded-2xl border border-[var(--surface-border)] bg-white/80 px-4 py-3 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-white"
        />

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            placeholder="Latitude"
            value={geo.latitude}
            readOnly
            className="rounded-2xl border border-[var(--surface-border)] bg-white/70 px-4 py-3 text-sm outline-none"
          />
          <input
            type="text"
            placeholder="Longitude"
            value={geo.longitude}
            readOnly
            className="rounded-2xl border border-[var(--surface-border)] bg-white/70 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={detectLocation}
            className="rounded-full border border-[var(--surface-border)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-white/70"
          >
            Refresh Location
          </button>
        </div>

        <p className="text-sm text-[var(--muted)]">{locationMessage}</p>

        <button
          type="submit"
          disabled={isSubmitting || !geo.latitude || !geo.longitude}
          className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Verifying..." : "Mark Attendance"}
        </button>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>

      {result ? (
        <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-strong)] px-5 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Verification result</p>
          <p className="mt-3 text-2xl font-bold text-[var(--text)]">{result.status}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Student: {result.student_name || "Unknown"}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Roll number: {result.roll_number}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Class: {result.class_name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Reason: {result.reason}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Distance: {result.distance_meters} meters (allowed: {result.allowed_radius_meters} meters)
          </p>
        </div>
      ) : null}
    </section>
  );
}
