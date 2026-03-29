import { useTimetable } from "../context/TimetableContext";
import { getFreeSlotsByDay } from "../utils/getFreeSlots";

export default function FreeSlotsPanel() {
  const { entries, isLoading } = useTimetable();
  const freeSlotsByDay = getFreeSlotsByDay(entries);

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Free Slot Finder</p>
        <h2 className="mt-2 text-xl font-bold text-[var(--text)]">Available time gaps from the timetable</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          The system calculates free slots between classes within the 09:00 to 17:00 day window.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading free slots...</p>
      ) : freeSlotsByDay.length ? (
        <div className="space-y-4">
          {freeSlotsByDay.map((group) => (
            <article key={group.day} className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text)]">{group.day}</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {group.slots.length} free slot{group.slots.length === 1 ? "" : "s"}
                </span>
              </div>

              {group.slots.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.slots.map((slot) => (
                    <div key={`${group.day}-${slot.start}-${slot.end}`} className="rounded-2xl bg-white/85 px-4 py-4">
                      <p className="font-semibold text-[var(--text)]">
                        {slot.start} - {slot.end}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{slot.duration} minutes free</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No free slots detected for this day.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Upload a timetable to calculate free slots automatically.</p>
      )}
    </section>
  );
}
