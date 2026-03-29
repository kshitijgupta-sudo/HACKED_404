import { useRef, useState } from "react";
import { useTimetable } from "../context/TimetableContext";

export default function FileUploadCard() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const { uploadTimetable, isUploading, error } = useTimetable();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    try {
      const response = await uploadTimetable(selectedFile);
      const methodLabel =
        response.parser_method === "ocr" ? " using OCR fallback" : "";
      setSuccessMessage(`${response.items.length} timetable entries imported successfully${methodLabel}.`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setSuccessMessage("");
    }
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">
          PDF Timetable Parser
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">
          Upload a timetable PDF and let the system organize it instantly.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
          The parser extracts subject names, time slots, and room numbers from uploaded PDFs and stores
          them directly in SQLite for immediate review. It now tries both embedded PDF text and OCR fallback
          for scanned timetable files.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--primary)]/40 bg-[var(--primary-soft)] px-6 py-10 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary)]/10">
          <span className="text-base font-semibold text-[var(--text)]">Select PDF timetable</span>
          <span className="mt-2 text-sm text-[var(--muted)]">
            Works with text PDFs and can fall back to OCR for scanned schedules when OCR is installed.
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setSuccessMessage("");
            }}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">
              {selectedFile ? selectedFile.name : "No file selected"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {selectedFile ? `${Math.ceil(selectedFile.size / 1024)} KB` : "Upload one PDF at a time"}
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Parsing PDF..." : "Upload and Parse"}
          </button>
        </div>

        {successMessage ? <p className="text-sm text-[var(--primary)]">{successMessage}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>
    </section>
  );
}
