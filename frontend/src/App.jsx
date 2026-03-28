import { useState } from "react";
import AdminRegisterScreen from "./components/AdminRegisterScreen";
import StudentDashboard from "./components/StudentDashboard";
import TeacherWorkspace from "./components/TeacherWorkspace";
import { useCurriculum } from "./context/CurriculumContext";
import { useDashboard } from "./context/DashboardContext";
import { useTimetable } from "./context/TimetableContext";

export default function App() {
  const { entries } = useTimetable();
  const { subjects, weakSubjects } = useCurriculum();
  const { dashboard } = useDashboard();
  const [activeRole, setActiveRole] = useState("teacher");

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/40 p-8 shadow-[var(--shadow)] backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--secondary)]">
            Smart Academic Management System
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-[var(--text)] sm:text-5xl">
                Separate student, teacher, and admin workspaces inside one academic platform.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Each role now gets focused pages instead of one long screen, so routine actions stay visible and lower-priority data stays out of the way until it is needed.
              </p>
            </div>

            <div className="grid gap-4 rounded-[2rem] bg-[var(--surface)] p-5">
              <div>
                <p className="text-sm text-[var(--muted)]">Attendance today</p>
                <p className="mt-1 text-3xl font-bold text-[var(--text)]">{dashboard.summary.records_today}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Subjects tracked</p>
                <p className="mt-1 text-3xl font-bold text-[var(--text)]">
                  {subjects.length || new Set(entries.map((entry) => entry.subject_name)).size}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Absent today</p>
                <p className="mt-1 text-3xl font-bold text-[var(--text)]">{dashboard.summary.absent_today}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Weak subjects</p>
                <p className="mt-1 text-3xl font-bold text-[var(--text)]">
                  {weakSubjects.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Dashboard Mode</p>
              <h2 className="mt-2 text-xl font-bold text-[var(--text)]">Choose who is using the website</h2>
            </div>

            <div className="inline-flex rounded-full bg-white/70 p-1">
              <RoleButton
                label="Teacher Dashboard"
                isActive={activeRole === "teacher"}
                onClick={() => setActiveRole("teacher")}
              />
              <RoleButton
                label="Student Dashboard"
                isActive={activeRole === "student"}
                onClick={() => setActiveRole("student")}
              />
              <RoleButton
                label="Admin Panel"
                isActive={activeRole === "admin"}
                onClick={() => setActiveRole("admin")}
              />
            </div>
          </div>
        </section>

        {activeRole === "teacher" ? <TeacherWorkspace /> : activeRole === "student" ? <StudentDashboard /> : <AdminRegisterScreen />}
      </div>
    </main>
  );
}

function RoleButton({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        isActive ? "bg-[var(--primary)] text-white" : "text-[var(--text)] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
