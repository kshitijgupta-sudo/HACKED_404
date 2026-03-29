import { useCurriculum } from "../context/CurriculumContext";

function progressTone(percentage) {
  if (percentage < 60) {
    return "border-[var(--danger)]/25 bg-[rgba(189,74,74,0.08)]";
  }
  if (percentage < 85) {
    return "border-[var(--warning)]/30 bg-[rgba(203,139,42,0.08)]";
  }
  return "border-[var(--primary)]/25 bg-[var(--primary-soft)]";
}

export default function CurriculumStudentPanel() {
  const { subjects, weakSubjects, suggestions, isLoading } = useCurriculum();

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Student View</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Progress insights</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Track completion by subject, spot weak areas below 60%, and get a clear recommendation on what to study next.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading progress insights...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {subjects.length ? (
              subjects.map((subject) => (
                <article
                  key={subject.id}
                  className={`rounded-[1.5rem] border px-4 py-4 ${progressTone(subject.progress_percentage)}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text)]">{subject.name}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {subject.name} - {subject.completed_topics}/{subject.total_topics} topics (
                        {Math.round(subject.progress_percentage)}%)
                      </p>
                    </div>
                    {subject.progress_percentage < 60 && subject.total_topics > 0 ? (
                      <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                        Weak subject
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${subject.progress_percentage}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">Add subjects and topics in the teacher view to see student progress here.</p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-white/70 p-5">
            <h3 className="text-lg font-bold text-[var(--text)]">Study guidance</h3>
            {weakSubjects.length ? (
              <div className="mt-3 space-y-2">
                {suggestions.map((suggestion) => (
                  <p key={suggestion} className="text-sm text-[var(--text)]">
                    {suggestion}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No weak subjects right now. Keep going, your current completion is on track.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
