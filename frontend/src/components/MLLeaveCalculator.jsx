import React, { useState, useEffect } from "react";
import { BrainCircuit, TrendingUp, AlertTriangle } from "lucide-react";

export default function MLLeaveCalculator({ currentPresent = 32, currentTotal = 40 }) {
  const [targetPercentage, setTargetPercentage] = useState(75);
  const [totalExpectedClasses, setTotalExpectedClasses] = useState(50);
  const [prediction, setPrediction] = useState(null);

  useEffect(() => {
    // Simulated ML Prediction Model for absences
    const calculateLeaves = () => {
      // Current absences
      const currentAbsences = currentTotal - currentPresent;
      
      // Calculate how many total classes the student MUST attend to hit the target
      const requiredAttended = Math.ceil((targetPercentage / 100) * totalExpectedClasses);
      
      // Maximum allowed absences for the whole semester
      const maxAllowedAbsences = totalExpectedClasses - requiredAttended;
      
      // Safe remaining leaves
      const safeLeavesRemaining = maxAllowedAbsences - currentAbsences;
      
      // Predictive trend based on current "behavior"
      const currentTrend = (currentPresent / currentTotal) * 100;
      let trendStatus = "Safe";
      if (safeLeavesRemaining <= 0) trendStatus = "Critical";
      else if (safeLeavesRemaining <= 2) trendStatus = "Warning";

      setPrediction({
        safeLeaves: Math.max(0, safeLeavesRemaining),
        currentTrend: currentTrend.toFixed(1) + "%",
        status: trendStatus,
        isDeficit: safeLeavesRemaining < 0 ? Math.abs(safeLeavesRemaining) : 0
      });
    };

    const timer = setTimeout(calculateLeaves, 600); // Simulate ML processing delay
    return () => clearTimeout(timer);
  }, [targetPercentage, totalExpectedClasses, currentPresent, currentTotal]);

  return (
    <div className="rounded-[2rem] bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-950 p-6 shadow-2xl text-white relative overflow-hidden">
      {/* Decorative background vectors */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply border-4 border-white/10 filter blur-3xl opacity-40 animate-pulse"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-5">
          <div className="bg-indigo-500/20 text-indigo-300 p-2 rounded-xl backdrop-blur-sm">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Leave Predictor Model</h2>
            <p className="text-xs text-indigo-200/60 uppercase tracking-widest font-semibold mt-0.5">Neural Attendance Forecast</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <label className="text-xs text-indigo-200 uppercase tracking-wider font-semibold block mb-2">Target Min Attendance (%)</label>
            <input 
              type="range" min="50" max="100" 
              value={targetPercentage} 
              onChange={(e) => setTargetPercentage(parseInt(e.target.value))}
              className="w-full accent-indigo-400 mb-2"
            />
            <div className="text-2xl font-black text-indigo-100">{targetPercentage}%</div>
          </div>
          
          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <label className="text-xs text-indigo-200 uppercase tracking-wider font-semibold block mb-2">Semester Total Classes</label>
            <input 
              type="range" min={currentTotal} max="100" 
              value={totalExpectedClasses} 
              onChange={(e) => setTotalExpectedClasses(parseInt(e.target.value))}
              className="w-full accent-indigo-400 mb-2"
            />
            <div className="text-2xl font-black text-indigo-100">{totalExpectedClasses} <span className="text-sm font-normal text-indigo-300 opacity-60">sessions</span></div>
          </div>
        </div>

        {prediction ? (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
               <div>
                 <p className="text-sm text-indigo-200 font-medium mb-1">Safe Classes to Skip</p>
                 <div className="flex items-baseline gap-2">
                    <span className={`text-5xl font-black ${prediction.status === 'Critical' ? 'text-red-400' : prediction.status === 'Warning' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {prediction.safeLeaves}
                    </span>
                    <span className="text-indigo-200/60 font-semibold uppercase tracking-wider text-sm">Classes</span>
                 </div>
               </div>
               
               <div className="text-right">
                  <p className="text-xs text-indigo-300 uppercase tracking-wider font-semibold mb-2">Current Trend</p>
                  <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-200 py-1 px-3 rounded-full text-sm font-bold border border-indigo-400/20">
                    <TrendingUp size={14} /> {prediction.currentTrend}
                  </div>
               </div>
            </div>

            {prediction.isDeficit > 0 && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
                 <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                 <div>
                    <p className="text-sm text-red-100 font-semibold">Shortage Predicted!</p>
                    <p className="text-xs text-red-200/80 mt-0.5">You must attend {prediction.isDeficit} extra classes above expectations to meet the {targetPercentage}% criteria.</p>
                 </div>
              </div>
            )}
            {prediction.status === 'Warning' && prediction.isDeficit === 0 && (
              <div className="mt-3 text-xs text-yellow-200/80 font-medium flex gap-2 items-center bg-yellow-500/10 px-3 py-2 rounded-lg">
                <AlertTriangle size={14} className="text-yellow-400" /> Approaching critical margin. Plan absences wisely.
              </div>
            )}
          </div>
        ) : (
           <div className="h-32 flex items-center justify-center">
             <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
           </div>
        )}
      </div>
    </div>
  );
}
