import { createContext, useContext, useEffect, useState } from "react";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [dashboard, setDashboard] = useState({
    attendance_records: [],
    absent_students: [],
    attendance_chart: [],
    curriculum_chart: [],
    summary: {
      records_today: 0,
      present_today: 0,
      absent_today: 0,
    },
    last_refreshed: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    try {
      const response = await fetch("/api/dashboard");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to load dashboard.");
      }
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
    const response = await fetch("/api/dashboard/export.csv");
    if (!response.ok) {
      throw new Error("Unable to export CSV.");
    }
    const blob = await response.blob();
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
