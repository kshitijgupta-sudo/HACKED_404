import React from "react";
import { Link } from "react-router-dom";
import { Video } from "lucide-react";
import CurriculumStudentPanel from "../components/CurriculumStudentPanel";
import CurriculumTeacherPanel from "../components/CurriculumTeacherPanel";
import FileUploadCard from "../components/FileUploadCard";
import StatsChart from "../components/StatsChart";
import TeacherInstitutionDashboard from "../components/TeacherInstitutionDashboard";
import TimetableTable from "../components/TimetableTable";
import { useCurriculum } from "../context/CurriculumContext";
import { useDashboard } from "../context/DashboardContext";
import { useTimetable } from "../context/TimetableContext";

export default function Home() {
  const { entries } = useTimetable();
  const { subjects, weakSubjects } = useCurriculum();
  const { dashboard } = useDashboard();

  return (
    <div className="mx-auto max-w-7xl">
      <section className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/40 p-8 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--secondary)]">
          Smart Academic Management System
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-[var(--text)] sm:text-5xl">
              Transform timetable PDFs into a searchable academic dashboard.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Built for academic operations teams that need instant timetable ingestion, clean data storage,
              and fast visual review from one streamlined workflow.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
               <Link 
                 to="/cctv"
                 className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
               >
                 <Video size={20} /> Open Live CCTV Monitor
               </Link>
            </div>
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

      <div className="mb-6">
        <TeacherInstitutionDashboard />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <CurriculumTeacherPanel />
          <FileUploadCard />
          <TimetableTable />
        </div>
        <div className="space-y-6">
          <CurriculumStudentPanel />
          <StatsChart entries={entries} />
        </div>
      </div>
    </div>
  );
}
