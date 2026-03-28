import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const CurriculumContext = createContext(null);

export function CurriculumProvider({ children }) {
  const [subjects, setSubjects] = useState([]);
  const [weakSubjects, setWeakSubjects] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCurriculum = async () => {
    setIsLoading(true);
    try {
      const [curriculumData, progressData] = await Promise.all([
        api.get("/api/curriculum"),
        api.get("/api/curriculum/progress"),
      ]);

      setSubjects(curriculumData.items ?? []);
      setWeakSubjects(progressData.weak_subjects ?? []);
      setSuggestions(progressData.suggestions ?? []);
      setError("");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load curriculum.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurriculum();
  }, []);

  const addSubject = async (name) => {
    setIsSaving(true);
    try {
      const data = await api.post("/api/curriculum/subjects", { name });
      await fetchCurriculum();
      return data;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to add subject.";
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const addTopic = async (subjectId, name) => {
    setIsSaving(true);
    try {
      const data = await api.post(`/api/curriculum/subjects/${subjectId}/topics`, { name });
      await fetchCurriculum();
      return data;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to add topic.";
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const updateTopicStatus = async (topicId, isCompleted) => {
    setIsSaving(true);
    try {
      const data = await api.patch(`/api/curriculum/topics/${topicId}`, { is_completed: isCompleted });
      await fetchCurriculum();
      return data;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to update topic.";
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const value = {
    subjects,
    weakSubjects,
    suggestions,
    isLoading,
    isSaving,
    error,
    fetchCurriculum,
    addSubject,
    addTopic,
    updateTopicStatus,
  };

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>;
}

export function useCurriculum() {
  const context = useContext(CurriculumContext);
  if (!context) {
    throw new Error("useCurriculum must be used within a CurriculumProvider");
  }
  return context;
}
