import React, { useState } from "react";
import { Camera, Server, Settings, Video } from "lucide-react";

export default function IPCameraView() {
  const [ipUrl, setIpUrl] = useState("0"); // Defaults to 0 (laptop webcam)
  const [activeStream, setActiveStream] = useState("");

  const startStream = (e) => {
    e.preventDefault();
    // Connects to our FastAPI Python MJPEG stream
    // e.g. http://127.0.0.1:8000/api/video_feed?ip_url=http://192.168.1.5:8080/video
    setActiveStream(`http://127.0.0.1:8000/api/video_feed?ip_url=${encodeURIComponent(ipUrl)}`);
  };

  return (
    <div className="min-h-screen bg-[#f4efe7] py-8 px-4 sm:px-10">
      <div className="max-w-6xl mx-auto">
         <div className="flex items-center gap-4 mb-8">
            <div className="bg-emerald-500/20 text-emerald-600 p-3 rounded-2xl">
               <Video size={32} />
            </div>
            <div>
               <h1 className="text-3xl font-black text-[var(--text)]">Live IP Surveillance</h1>
               <p className="font-semibold text-[var(--muted)]">Connects your Smartphone Camera via OpenCV</p>
            </div>
         </div>

         <div className="grid lg:grid-cols-3 gap-8">
            {/* Configuration Panel */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-[2rem] shadow-[var(--shadow)] flex flex-col gap-6">
               <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-2"><Server size={20} /> Connection Setup</h2>
                  <p className="text-sm text-[var(--muted)]">
                     Turn your phone into an AI webcam! Download <strong>IP Webcam</strong> (Android) or <strong>DroidCam</strong> (iOS) and enter the video URL below.
                  </p>
               </div>

               <form onSubmit={startStream} className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">IP Camera URL</label>
                     <input 
                       type="text"
                       value={ipUrl}
                       onChange={e => setIpUrl(e.target.value)}
                       placeholder="http://192.168.x.x:8080/video"
                       className="w-full bg-white/60 border-2 border-white focus:border-[var(--primary)] rounded-xl px-4 py-3 font-mono text-sm outline-none transition-all"
                     />
                     <p className="text-[10px] text-[var(--muted)]">Tip: Leave as "0" to just use your laptop webcam.</p>
                  </div>
                  <button type="submit" className="w-full bg-[var(--primary)] text-white font-bold py-3 rounded-xl hover:bg-[var(--primary)]/90 flex items-center justify-center gap-2">
                     <Settings size={18} /> Initialize AI Stream
                  </button>
               </form>

               <div className="mt-auto bg-black/5 p-4 rounded-xl">
                  <p className="text-xs font-mono text-[var(--muted)] flex items-center gap-2 mb-1">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Back-End Active
                  </p>
                  <p className="text-xs font-semibold text-[var(--text)]">OpenCV Bounding Boxes & MJPEG Pipeline Initialized</p>
               </div>
            </div>

            {/* Video Feed Monitor */}
            <div className="lg:col-span-2 bg-gray-900 rounded-[2rem] border border-black/20 shadow-2xl overflow-hidden aspect-video relative flex flex-col items-center justify-center">
               {!activeStream ? (
                  <div className="opacity-40 flex flex-col items-center text-white">
                     <Camera size={64} className="mb-4" />
                     <p className="text-xl font-bold tracking-widest uppercase">No Signal</p>
                     <p className="text-sm">Please initialize a connection</p>
                  </div>
               ) : (
                  <>
                     <div className="absolute top-4 left-4 z-10 bg-red-600 px-3 py-1 rounded-md text-white font-bold font-mono text-xs flex items-center gap-2 shadow-lg">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div> REC
                     </div>
                     <img 
                       src={activeStream} 
                       alt="Live AI Camera Stream" 
                       className="absolute inset-0 w-full h-full object-contain bg-black"
                       onError={(e) => {
                          e.target.style.display = 'none';
                          alert("Failed to connect to the IP Camera. Ensure the URL is exactly correct and your phone is on the same Wifi network.");
                       }}
                     />
                  </>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
