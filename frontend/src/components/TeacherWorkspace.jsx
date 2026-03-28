import { useState } from "react";
import CurriculumTeacherPanel from "./CurriculumTeacherPanel";
import FaceRegistrationPanel from "./FaceRegistrationPanel";
import FileUploadCard from "./FileUploadCard";
import TeacherInstitutionDashboard from "./TeacherInstitutionDashboard";
import TimetableTable from "./TimetableTable";
import WorkspaceTabs from "./WorkspaceTabs";

export default function TeacherWorkspace() {
  const [activePage, setActivePage] = useState("overview");
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "face", label: "Face Setup" },
    { id: "curriculum", label: "Curriculum" },
    { id: "timetable", label: "Timetable" },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceTabs tabs={tabs} activeTab={activePage} onChange={setActivePage} />
      {activePage === "overview" ? <TeacherInstitutionDashboard /> : null}
      {activePage === "face" ? <FaceRegistrationPanel /> : null}
      {activePage === "curriculum" ? <CurriculumTeacherPanel /> : null}
      {activePage === "timetable" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <FileUploadCard />
          <TimetableTable />
        </div>
      ) : null}
    </div>
  );
}
