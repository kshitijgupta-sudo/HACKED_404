import { createContext, useContext, useEffect, useState } from "react";

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
      const [curriculumResponse, progressResponse] = await Promise.all([
        fetch("/api/curriculum"),
        fetch("/api/curriculum/progress"),
      ]);

      const curriculumData = await curriculumResponse.json();
      const progressData = await progressResponse.json();

      if (!curriculumResponse.ok) {
        throw new Error(curriculumData.detail || "Unable to load curriculum.");
      }
      if (!progressResponse.ok) {
        throw new Error(progressData.detail || "Unable to load curriculum progress.");
      }

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
      const response = await fetch("/api/curriculum/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to add subject.");
      }
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
      const response = await fetch(`/api/curriculum/subjects/${subjectId}/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to add topic.");
      }
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
      const response = await fetch(`/api/curriculum/topics/${topicId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to update topic.");
      }
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
