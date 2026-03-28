import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useDashboard } from "../context/DashboardContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

function statusTone(status) {
  return status === "Absent"
    ? "bg-[rgba(189,74,74,0.12)] text-[var(--danger)]"
    : "bg-[var(--primary-soft)] text-[var(--primary)]";
}

export default function TeacherInstitutionDashboard() {
  const { dashboard, isLoading, error, exportCsv } = useDashboard();
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
  const attendanceMessage =
    attendancePercentage >= 75
      ? "Safe zone"
      : attendancePercentage >= 60
        ? "Below 75% - take action"
        : "Critical - improve attendance";
  const greeting = getGreeting();

  const attendanceLineData = {
    labels: dashboard.attendance_chart.map((item) => item.date),
    datasets: [
      {
        label: "Attendance %",
        data: dashboard.attendance_chart.map((item) => item.attendance_percentage),
        borderColor: "#1f6f5f",
        backgroundColor: "rgba(31, 111, 95, 0.16)",
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const curriculumBarData = {
    labels: dashboard.curriculum_chart.map((item) => item.subject_name),
    datasets: [
      {
        label: "Curriculum progress %",
        data: dashboard.curriculum_chart.map((item) => item.progress_percentage),
        backgroundColor: "#c06c4e",
        borderRadius: 10,
      },
    ],
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">
            {greeting}
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">
            Teacher + Institution Dashboard
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Operational overview</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Attendance records, absent students, and academic progress are refreshed automatically every 30 seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-6 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Attendance Overview
            </p>
            <p className={`mt-2 text-5xl font-black ${attendanceTone}`}>{attendancePercentage}%</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{attendanceMessage}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <QuickStat label="Attended" value={attendanceSamples.present} />
            <QuickStat label="Total Records" value={attendanceSamples.total} />
            <QuickStat
              label="Absences"
              value={dashboard.attendance_records.filter((item) => item.status === "Absent").length}
            />
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(31,111,95,0.08)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${attendancePercentage}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Records Today" value={dashboard.summary.records_today} />
        <MetricCard label="Present Today" value={dashboard.summary.present_today} />
        <MetricCard label="Absent Today" value={dashboard.summary.absent_today} />
        <MetricCard label="Face Reviews" value={dashboard.summary.face_unverified_count} />
        <MetricCard label="Scan Alerts" value={dashboard.summary.failed_scan_alert_count} />
      </div>

      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {isLoading ? <p className="mt-4 text-sm text-[var(--muted)]">Loading dashboard...</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text)]">Attendance table</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Auto-refresh 30s
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                    <th className="px-4">Date</th>
                    <th className="px-4">Student</th>
                    <th className="px-4">Subject</th>
                    <th className="px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.attendance_records.slice(0, 12).map((item) => (
                    <tr key={item.id} className="bg-white/85 shadow-sm">
                      <td className="rounded-l-2xl px-4 py-4 text-sm text-[var(--muted)]">{item.attendance_date}</td>
                      <td className="px-4 py-4 font-medium text-[var(--text)]">{item.student_name}</td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">{item.subject_name}</td>
                      <td className="rounded-r-2xl px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <h3 className="text-lg font-bold text-[var(--text)]">Absent student list</h3>
              <div className="mt-4 space-y-3">
                {dashboard.absent_students.length ? (
                  dashboard.absent_students.map((item) => (
                    <div key={`${item.student_name}-${item.attendance_date}`} className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{item.student_name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {item.subject_name} on {item.attendance_date}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No absent students in the recent records.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <h3 className="text-lg font-bold text-[var(--text)]">Unverified face attendance</h3>
              <div className="mt-4 space-y-3">
                {dashboard.face_unverified_items.length ? (
                  dashboard.face_unverified_items.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{item.student_name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {item.roll_number} • {item.reason}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.distance_meters}m from classroom • {item.created_at}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No face verification reviews waiting right now.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
              <h3 className="text-lg font-bold text-[var(--text)]">Failed scan alerts</h3>
              <div className="mt-4 space-y-3">
                {dashboard.failed_scan_alerts.length ? (
                  dashboard.failed_scan_alerts.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{item.student_name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {item.roll_number} • {item.reason}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.ip_address} • {item.attempt_count} attempts • {item.created_at}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No repeated scan failures have been logged.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
            <h3 className="text-lg font-bold text-[var(--text)]">7-day attendance chart</h3>
            <div className="mt-4 h-[260px]">
              <Line
                data={attendanceLineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
              />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
            <h3 className="text-lg font-bold text-[var(--text)]">Curriculum progress chart</h3>
            <div className="mt-4 h-[260px]">
              <Bar
                data={curriculumBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}

function QuickStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--text)]">{value}</p>
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
