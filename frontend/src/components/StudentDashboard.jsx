import { useState } from "react";
import CurriculumStudentPanel from "./CurriculumStudentPanel";
import FaceAttendancePanel from "./FaceAttendancePanel";
import FreeSlotsPanel from "./FreeSlotsPanel";
import StatsChart from "./StatsChart";
import WorkspaceTabs from "./WorkspaceTabs";
import { useDashboard } from "../context/DashboardContext";
import { useTimetable } from "../context/TimetableContext";

export default function StudentDashboard() {
  const { dashboard } = useDashboard();
  const { entries } = useTimetable();
  const [activePage, setActivePage] = useState("overview");
  const todayClasses = entries.slice(0, 4);
  const attendanceSamples = dashboard.attendance_chart.reduce(
    (accumulator, item) => {
      accumulator.present += item.present_count ?? 0;
      accumulator.total += item.total_count ?? 0;
      return accumulator;
    },
    { present: 0, total: 0 },
  );
  const attendancePercentage = attendanceSamples.total
    ? Math.round((attendanceSamples.present / attendanceSamples.total) * 100)
    : 0;
  const attendanceTone =
    attendancePercentage >= 75 ? "text-[var(--primary)]" : attendancePercentage >= 60 ? "text-[var(--warning)]" : "text-[var(--danger)]";
  const greeting = getGreeting();
  const allowedMisses = calculateAllowedMisses(attendanceSamples.present, attendanceSamples.total);
  const missStatus = getMissStatus(allowedMisses, attendanceSamples.total);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "attendance", label: "Attendance" },
    { id: "planner", label: "Planner" },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/40 p-8 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--secondary)]">{greeting}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="max-w-3xl text-4xl font-black leading-tight text-[var(--text)] sm:text-5xl">
              Student dashboard built for daily decisions, not admin overhead.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Track attendance health, review today&apos;s classes, monitor subject progress, and spot free slots
              between sessions from one focused student view.
            </p>
          </div>

          <div className="rounded-[2rem] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Attendance status</p>
            <p className={`mt-3 text-5xl font-black ${attendanceTone}`}>{attendancePercentage}%</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(31,111,95,0.08)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${attendancePercentage}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StudentMetric label="Attended" value={attendanceSamples.present} />
              <StudentMetric label="Total" value={attendanceSamples.total} />
              <StudentMetric label="Absent" value={dashboard.attendance_records.filter((item) => item.status === "Absent").length} />
            </div>
          </div>
        </div>
      </section>

      <WorkspaceTabs tabs={tabs} activeTab={activePage} onChange={setActivePage} />

      {activePage === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">75% Attendance Rule</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--text)]">How many more classes can be missed</h3>
              </div>

              <div className={`rounded-[1.5rem] border px-5 py-5 ${missStatus.containerClass}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Current allowance</p>
                <p className={`mt-3 text-5xl font-black ${missStatus.valueClass}`}>{allowedMisses}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--text)]">{missStatus.message}</p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Today&apos;s Classes</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Upcoming academic flow</h3>
              </div>

              {todayClasses.length ? (
                <div className="space-y-3">
                  {todayClasses.map((entry) => (
                    <div key={`${entry.id}-${entry.time}`} className="rounded-2xl bg-[var(--surface-strong)] px-4 py-4">
                      <p className="font-semibold text-[var(--text)]">{entry.subject_name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{entry.time}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Room: {entry.room_number}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">Upload or load timetable data to see student class cards here.</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <StatsChart entries={entries} />
            <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Student Alerts</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Priority reminders</h3>
              </div>

              <div className="space-y-3">
                <AlertCard
                  title="Attendance watch"
                  message={
                    attendancePercentage >= 75
                      ? "You are in the safe zone. Keep consistency across the week."
                      : "Attendance is slipping below the safe zone. Prioritize class presence."
                  }
                />
                <AlertCard
                  title="Free slot planning"
                  message="Use detected free slots for revision, tutorial catch-up, or assignment work."
                />
                <AlertCard
                  title="Curriculum focus"
                  message="Check weak subjects below 60% progress and close those gaps first."
                />
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activePage === "attendance" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <FaceAttendancePanel />
          <section className="space-y-6">
            <StatsChart entries={entries} />
            <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Attendance Help</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Before you scan</h3>
              </div>
              <div className="space-y-3">
                <AlertCard title="Lighting" message="Stand away from strong backlight and try to keep your face evenly lit." />
                <AlertCard title="Camera angle" message="Look straight at the camera first, then hold still until the system finishes." />
                <AlertCard title="Location" message="Make sure browser location is enabled so the class geofence can verify your attendance." />
              </div>
            </section>
          </section>
        </div>
      ) : null}

      {activePage === "planner" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <CurriculumStudentPanel />
          <FreeSlotsPanel />
        </div>
      ) : null}
    </div>
  );
}

function StudentMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}

function AlertCard({ title, message }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-strong)] px-4 py-4">
      <p className="font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
  if (hour < 21) {
    return "Good Evening";
  }
  return "Good Night";
}

function calculateAllowedMisses(attended, total) {
  if (!total || attended <= 0) {
    return 0;
  }

  const remaining = Math.floor(attended / 0.75 - total);
  return Math.max(0, remaining);
}

function getMissStatus(allowedMisses, total) {
  if (!total) {
    return {
      containerClass: "border-[var(--surface-border)] bg-[var(--surface-strong)]",
      valueClass: "text-[var(--text)]",
      message: "Attendance data is still building. Once records are available, the dashboard will show your 75% buffer.",
    };
  }

  if (allowedMisses === 0) {
    return {
      containerClass: "border-[var(--danger)]/25 bg-[rgba(189,74,74,0.08)]",
      valueClass: "text-[var(--danger)]",
      message: "You cannot miss more classes without going below the 75% attendance requirement.",
    };
  }

  if (allowedMisses <= 2) {
    return {
      containerClass: "border-[var(--warning)]/30 bg-[rgba(203,139,42,0.08)]",
      valueClass: "text-[var(--warning)]",
      message: `You can miss ${allowedMisses} more class${allowedMisses === 1 ? "" : "es"}, but you are close to the 75% limit.`,
    };
  }

  return {
    containerClass: "border-[var(--primary)]/25 bg-[var(--primary-soft)]",
    valueClass: "text-[var(--primary)]",
    message: `You can still miss ${allowedMisses} more class${allowedMisses === 1 ? "" : "es"} and remain above 75% attendance.`,
  };
}
