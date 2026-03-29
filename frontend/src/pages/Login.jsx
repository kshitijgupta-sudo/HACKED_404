import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User, ShieldCheck, ChevronRight } from "lucide-react";

export default function Login() {
  const [collegeId, setCollegeId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ college_id: collegeId, password })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || "Authentication Failed");
      }

      // Automatically route dynamically based on the verified backend role
      if (responseData.role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student");
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#f4efe7]">
      {/* Dynamic Background Elements */}
      <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] bg-[var(--primary)]/10 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] bg-[var(--secondary)]/10 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-[1000px] grid md:grid-cols-2 bg-white/40 backdrop-blur-2xl rounded-[3rem] shadow-[var(--shadow)] border border-white/60 overflow-hidden z-10 mx-4">
        
        {/* Left Branding Panel */}
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-[var(--primary)] to-emerald-900 p-12 text-white relative">
           <div className="absolute inset-0 bg-black/10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px'}}></div>
           
           <div className="relative z-10">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 mb-8 shadow-xl">
                 <ShieldCheck size={32} className="text-emerald-300" />
              </div>
              <h1 className="text-4xl font-black tracking-tight leading-tight mb-4">
                 SmartCampus<br/><span className="text-emerald-400">Security Portal</span>
              </h1>
              <p className="text-emerald-100/80 text-lg leading-relaxed">
                 Authenticate to access AI attendance, geofencing logs, and dynamic schedule generation.
              </p>
           </div>

           <div className="relative z-10 bg-white/10 p-6 rounded-2xl border border-white/20 backdrop-blur-md">
              <p className="font-mono text-sm text-emerald-200">System Status</p>
              <div className="flex items-center gap-3 mt-2 font-bold tracking-wider">
                 <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]"></div>
                 ALL SYSTEMS OPTIMAL
              </div>
           </div>
        </div>

        {/* Right Login Panel */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white/20">
           <div className="mb-8 text-center md:text-left">
              <h2 className="text-3xl font-black text-[var(--text)]">Welcome Back</h2>
              <p className="text-[var(--muted)] mt-2 font-medium">Enter your credentials to continue.</p>
           </div>
           
           {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-bold animate-fade-in-up">
                 ⚠ {errorMsg}
              </div>
           )}

           <form onSubmit={handleLogin} className="space-y-6">
              {/* College ID Input */}
              <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ml-1">Email or Roll No</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--primary)]/60">
                       <User size={20} />
                    </div>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 20114068 or faculty@nit.ac.in"
                      value={collegeId}
                      onChange={(e) => setCollegeId(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/60 border-2 border-white focus:border-[var(--primary)] focus:bg-white rounded-2xl outline-none font-semibold text-[var(--text)] transition-all shadow-sm placeholder:text-black/30"
                    />
                 </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ml-1">Password</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--primary)]/60">
                       <Lock size={20} />
                    </div>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/60 border-2 border-white focus:border-[var(--primary)] focus:bg-white rounded-2xl outline-none font-semibold text-[var(--text)] transition-all shadow-sm placeholder:text-black/30"
                    />
                 </div>
              </div>

              <div className="pt-2">
                 <button 
                   type="submit" 
                   disabled={isLoading}
                   className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white py-4 rounded-2xl font-bold text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_20px_var(--primary-soft)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                 >
                    {isLoading ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>Authenticate <ChevronRight size={20} /></>
                    )}
                 </button>
              </div>
           </form>
           
           <p className="text-center text-xs font-semibold text-[var(--muted)] mt-8">
             Secured by SmartCampus Zero-Trust Architecture
           </p>
        </div>
      </div>
    </div>
  );
}
