import { useState } from "react";
import { useCurriculum } from "../context/CurriculumContext";

export default function CurriculumTeacherPanel() {
  const { subjects, isLoading, isSaving, error, addSubject, addTopic, updateTopicStatus } = useCurriculum();
  const [subjectName, setSubjectName] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({});

  const handleAddSubject = async (event) => {
    event.preventDefault();
    if (!subjectName.trim()) {
      return;
    }

    try {
      await addSubject(subjectName.trim());
      setSubjectName("");
    } catch {}
  };

  const handleAddTopic = async (event, subjectId) => {
    event.preventDefault();
    const draft = topicDrafts[subjectId]?.trim();
    if (!draft) {
      return;
    }

    try {
      await addTopic(subjectId, draft);
      setTopicDrafts((current) => ({ ...current, [subjectId]: "" }));
    } catch {}
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Teacher View</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Curriculum tracker</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Add subjects, add topics under each subject, and mark completed topics to keep the syllabus current.
        </p>
      </div>

      <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleAddSubject}>
        <input
          type="text"
          value={subjectName}
          onChange={(event) => setSubjectName(event.target.value)}
          placeholder="Add a subject, for example Mathematics"
          className="flex-1 rounded-full border border-[var(--surface-border)] bg-white/70 px-4 py-3 text-sm outline-none ring-0 placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[var(--secondary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Subject
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-[var(--danger)]">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading curriculum...</p>
      ) : subjects.length ? (
        <div className="space-y-4">
          {subjects.map((subject) => (
            <article key={subject.id} className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">{subject.name}</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {subject.completed_topics}/{subject.total_topics} topics completed
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
                  {Math.round(subject.progress_percentage)}%
                </span>
              </div>

              <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => handleAddTopic(event, subject.id)}>
                <input
                  type="text"
                  value={topicDrafts[subject.id] ?? ""}
                  onChange={(event) =>
                    setTopicDrafts((current) => ({
                      ...current,
                      [subject.id]: event.target.value,
                    }))
                  }
                  placeholder={`Add topic under ${subject.name}`}
                  className="flex-1 rounded-full border border-[var(--surface-border)] bg-white px-4 py-3 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full border border-[var(--surface-border)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Topic
                </button>
              </form>

              <div className="mt-4 space-y-3">
                {subject.topics.length ? (
                  subject.topics.map((topic) => (
                    <label
                      key={topic.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white/80 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--text)]">{topic.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {topic.is_completed ? "Completed topic" : "Pending topic"}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={topic.is_completed}
                        onChange={(event) => updateTopicStatus(topic.id, event.target.checked)}
                        className="h-5 w-5 accent-[var(--primary)]"
                      />
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No topics added yet.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No subjects yet. Add your first subject to begin tracking curriculum coverage.</p>
      )}
    </section>
  );
}
