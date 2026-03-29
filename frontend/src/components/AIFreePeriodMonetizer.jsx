import React, { useState } from "react";
import { Sparkles, Target, Zap, Flame, Users, BookOpen } from "lucide-react";
import { useTimetable } from "../context/TimetableContext";

const CAREER_GOALS = [
  "Software Engineer",
  "Data Scientist",
  "UI/UX Designer",
  "Product Manager",
  "Cybersecurity Analyst",
];

const MOCK_STUDENTS = [
  { name: "Rahul S.", role: "Frontend Dev", match: "98%" },
  { name: "Priya K.", role: "UI Designer", match: "92%" },
];

export default function AIFreePeriodMonetizer() {
  const { entries } = useTimetable();
  const [goal, setGoal] = useState("Software Engineer");
  const [streak, setStreak] = useState(12); // Simulated gamification streak
  
  // Predict which period is free based on timetable length
  const hasFreePeriodToday = entries.length > 0 && Math.random() > 0.2;

  return (
    <div className="rounded-[2.5rem] bg-[var(--surface-strong)] border border-[var(--surface-border)] p-6 md:p-8 shadow-[var(--shadow)] relative overflow-hidden mt-6">
      {/* Gamification Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
         <div>
            <h2 className="text-2xl font-black text-[var(--text)] flex items-center gap-2">
               <Sparkles className="text-amber-500" /> AI Routine Generator
            </h2>
            <p className="text-[var(--muted)] text-sm mt-1">Transform your timetable gaps into career milestones.</p>
         </div>
         <div className="flex items-center gap-3 bg-orange-100/50 border border-orange-200 px-4 py-2 rounded-2xl">
            <div className="bg-orange-500 text-white p-2 rounded-full shadow-lg shadow-orange-500/30">
               <Flame size={20} className="fill-current" />
            </div>
            <div>
               <p className="text-xs font-bold uppercase tracking-wider text-orange-800/60">Productivity Streak</p>
               <p className="text-xl font-black text-orange-600 leading-none">{streak} Days</p>
            </div>
         </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
         {/* Goal Selection & Routine */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/60 p-5 rounded-[2rem] border border-[var(--surface-border)]">
               <label className="text-sm font-bold text-[var(--muted)] flex items-center gap-2 mb-3">
                 <Target size={16} /> Select Long-term Goal
               </label>
               <select 
                 className="w-full bg-transparent border-2 border-black/5 rounded-xl px-4 py-3 font-semibold text-[var(--text)] focus:border-[var(--primary)] outline-none appearance-none cursor-pointer"
                 value={goal}
                 onChange={(e) => setGoal(e.target.value)}
               >
                 {CAREER_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
            </div>

            <div className="relative">
               <div className="absolute left-6 top-10 bottom-6 w-0.5 bg-gradient-to-b from-[var(--primary)] to-transparent opacity-20"></div>
               
               {/* Fixed Schedule Item */}
               <div className="flex gap-4 relative z-10 mb-6 group">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-black/5 flex items-center justify-center font-bold text-sm border border-black/5 shadow-sm">
                    09:00
                  </div>
                  <div className="flex-1 bg-white p-5 rounded-[1.5rem] border border-[var(--surface-border)] shadow-sm">
                     <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-[var(--text)]">Core Subject Class</h4>
                        <span className="text-xs font-bold text-[var(--muted)] bg-black/5 px-2 py-1 rounded-md">MANDATORY</span>
                     </div>
                     <p className="text-sm text-[var(--muted)]">As per your uploaded timetable.</p>
                  </div>
               </div>

               {/* AI Injected Free Period Task */}
               {hasFreePeriodToday ? (
                 <div className="flex gap-4 relative z-10 mb-6 group animate-fade-in-up">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-sm border border-[var(--primary)]/20 shadow-md">
                      11:00
                    </div>
                    <div className="flex-1 bg-[var(--primary)]/5 p-5 rounded-[1.5rem] border border-[var(--primary)]/20 shadow-inner group-hover:bg-[var(--primary)]/10 transition-colors">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-[var(--primary)] flex items-center gap-1.5"><Zap size={16} className="fill-[var(--primary)]" /> AI Optimized Free Period</h4>
                            <p className="text-sm font-medium text-[var(--primary)]/80 mt-0.5">Aligned with: {goal}</p>
                          </div>
                          <button 
                             onClick={() => setStreak(s => s + 1)}
                             className="text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 px-3 py-1.5 rounded-lg shadow-md transition-transform hover:scale-105 active:scale-95"
                          >
                             MARK DONE
                          </button>
                       </div>
                       
                       <div className="mt-4 bg-white/60 p-4 rounded-xl border border-[var(--primary)]/10 flex gap-3">
                          <BookOpen className="text-[var(--primary)]/60 shrink-0" size={20} />
                          <div>
                             <p className="font-semibold text-[var(--text)] text-sm">Suggested Micro-Task</p>
                             <p className="text-sm text-[var(--muted)] leading-relaxed mt-1">
                               {goal === "Software Engineer" && "Complete 2 Data Structures problems on LeetCode focusing on Hash Maps."}
                               {goal === "UI/UX Designer" && "Redesign a poorly made login screen on Figma and document your UX flow."}
                               {goal === "Data Scientist" && "Clean a mock CSV dataset using Pandas for 30 minutes in a Jupyter Notebook."}
                               {goal === "Product Manager" && "Write a 1-page PRD for a feature you wish existed in your favorite app."}
                               {goal === "Cybersecurity Analyst" && "Complete a beginner room on TryHackMe teaching basic Nmap scanning."}
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="ml-16 bg-black/5 p-4 rounded-xl text-sm font-medium text-[var(--muted)] text-center border border-black/5 border-dashed">
                    No free slots detected in today's timetable.
                 </div>
               )}
            </div>
         </div>

         {/* Proximity Matchmaking Sidebar */}
         <div className="space-y-4">
            <div className="bg-white p-6 rounded-[2rem] border border-[var(--surface-border)] shadow-sm h-full flex flex-col">
               <div className="flex items-center justify-between border-b border-black/5 pb-4 mb-4">
                  <h3 className="font-bold text-[var(--text)] text-lg flex items-center gap-2">
                     <Users className="text-blue-500" /> Study Tinder
                  </h3>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
               </div>
               <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-4">Peers Free Right Now on Campus</p>
               
               <div className="space-y-3 flex-1">
                 {MOCK_STUDENTS.map((peer, idx) => (
                   <div key={idx} className="bg-[var(--surface)] p-3 rounded-2xl border border-black/5 flex items-center justify-between group cursor-pointer hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                            {peer.name.charAt(0)}
                         </div>
                         <div>
                            <p className="font-bold text-[var(--text)] text-sm">{peer.name}</p>
                            <p className="text-xs font-medium text-[var(--muted)] bg-black/5 px-2 py-0.5 rounded-md inline-block mt-1">{peer.role}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-xs font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg block mb-1">{peer.match} Match</span>
                      </div>
                   </div>
                 ))}
               </div>
               
               <div className="mt-6 pt-4 border-t border-black/5">
                 <button className="w-full py-2.5 bg-black/5 hover:bg-black/10 text-[var(--text)] font-bold text-sm rounded-xl transition-colors">
                    Suggest Library Meetup
                 </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
