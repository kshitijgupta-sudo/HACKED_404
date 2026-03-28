import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [dashboard, setDashboard] = useState({
    attendance_records: [],
    absent_students: [],
    face_unverified_items: [],
    failed_scan_alerts: [],
    attendance_chart: [],
    curriculum_chart: [],
    summary: {
      records_today: 0,
      present_today: 0,
      absent_today: 0,
      face_unverified_count: 0,
      failed_scan_alert_count: 0,
    },
    last_refreshed: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    try {
      const data = await api.get("/api/dashboard");
      setDashboard(data);
      setError("");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load dashboard.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const intervalId = window.setInterval(fetchDashboard, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const exportCsv = async () => {
    const blob = await api.download("/api/dashboard/export.csv");
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "attendance_dashboard_export.csv";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardContext.Provider
      value={{
        dashboard,
        isLoading,
        error,
        fetchDashboard,
        exportCsv,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
