import { Routes, Route, Link, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import StudentDashboard from "./pages/StudentDashboard";
import IPCameraView from "./pages/IPCameraView";

function Layout() {
  const location = useLocation();

  const isLoginRoute = location.pathname === "/";

  return (
    <div className="min-h-screen">
      {/* Top Navigation - Hidden on Login Page */}
      {!isLoginRoute && (
        <header className="bg-white/60 backdrop-blur-xl border-b border-white/40 shadow-sm sticky top-0 z-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <span className="font-bold text-[var(--text)] tracking-wider">SmartCampus</span>
            </div>
            <nav className="flex gap-4">
              <Link 
                to="/" 
                className="px-4 py-2 rounded-xl text-sm font-bold bg-black/5 text-[var(--text)] hover:bg-black/10 transition-colors flex items-center gap-2"
              >
                Log Out
              </Link>
            </nav>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={!isLoginRoute ? "px-4 py-8 sm:px-6 lg:px-10" : ""}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/teacher" element={<Home />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/cctv" element={<IPCameraView />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <Layout />;
}
