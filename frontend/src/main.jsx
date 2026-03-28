import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CurriculumProvider } from "./context/CurriculumContext";
import { DashboardProvider } from "./context/DashboardContext";
import { TimetableProvider } from "./context/TimetableContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TimetableProvider>
      <DashboardProvider>
        <CurriculumProvider>
          <App />
        </CurriculumProvider>
      </DashboardProvider>
    </TimetableProvider>
  </React.StrictMode>,
);
