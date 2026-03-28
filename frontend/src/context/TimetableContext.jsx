import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const TimetableContext = createContext(null);

export function TimetableProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/api/timetable");
      setEntries(data.items ?? []);
      setError("");
    } catch (fetchError) {
      setError("Unable to load timetable data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const uploadTimetable = async (file) => {
    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await api.post("/api/timetable/upload", formData);
      await fetchEntries();
      return data;
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  };

  const clearTimetable = async () => {
    setIsLoading(true);
    try {
      await api.delete("/api/timetable");
      setEntries([]);
      setError("");
    } catch (clearError) {
      const message = clearError instanceof Error ? clearError.message : "Unable to clear timetable.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    entries,
    isLoading,
    isUploading,
    error,
    fetchEntries,
    uploadTimetable,
    clearTimetable,
  };

  return <TimetableContext.Provider value={value}>{children}</TimetableContext.Provider>;
}

export function useTimetable() {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error("useTimetable must be used within a TimetableProvider");
  }
  return context;
}
