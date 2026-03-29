import { useTimetable } from "../context/TimetableContext";

export default function TimetableTable() {
  const { entries, isLoading, clearTimetable } = useTimetable();

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Timetable</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--text)]">Parsed schedule records</h2>
        </div>

        <button
          type="button"
          onClick={clearTimetable}
          className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-white/60"
        >
          Clear Data
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading timetable records...</p>
      ) : entries.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                <th className="px-4">Subject</th>
                <th className="px-4">Time</th>
                <th className="px-4">Room</th>
                <th className="px-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="rounded-2xl bg-[var(--surface-strong)] shadow-sm">
                  <td className="rounded-l-2xl px-4 py-4 font-semibold text-[var(--text)]">{entry.subject_name}</td>
                  <td className="px-4 py-4 text-sm text-[var(--muted)]">{entry.time}</td>
                  <td className="px-4 py-4 text-sm text-[var(--muted)]">{entry.room_number}</td>
                  <td className="rounded-r-2xl px-4 py-4 text-sm text-[var(--muted)]">{entry.source_file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No timetable entries yet. Upload a PDF to populate the schedule.</p>
      )}
    </section>
  );
}
