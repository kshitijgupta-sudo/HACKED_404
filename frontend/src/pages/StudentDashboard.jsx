import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { MapPin, Camera, CheckCircle, XCircle } from "lucide-react";
import MLLeaveCalculator from "../components/MLLeaveCalculator";
import AIFreePeriodMonetizer from "../components/AIFreePeriodMonetizer";
import FreeSlotsPanel from "../components/FreeSlotsPanel";

const CAMPUS_COORDS = { lat: 31.395, lng: 75.534 }; // Approximate coordinates for NIT Jalandhar
const GEOFENCE_RADIUS_METERS = 500;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export default function StudentDashboard() {
  const [locationScore, setLocationScore] = useState(null);
  const [distance, setDistance] = useState(null);
  const [geoError, setGeoError] = useState("");
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  
  const webcamRef = useRef(null);

  useEffect(() => {
    // Geofencing verification
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const dist = calculateDistance(latitude, longitude, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng);
        setDistance(dist);
        if (dist <= GEOFENCE_RADIUS_METERS) {
          setLocationScore("in_bounds");
        } else {
          setLocationScore("out_of_bounds");
        }
      },
      (error) => {
        console.error("Geofencing Error:", error);
        setGeoError("Unable to retrieve your location for geofencing.");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const captureFace = useCallback(async () => {
    if (!webcamRef.current) return;
    setIsScanning(true);
    setScanResult(null);

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
       setIsScanning(false);
       setScanResult({ status: "error", message: "Failed to capture webcam frame." });
       return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: "CS2024-001", image_b64: imageSrc })
      });
      const data = await res.json();
      
      if (data.success) {
        setScanResult({
          status: "success",
          message: data.message,
          name: "CS2024-001 Assessed",
        });
      } else {
        setScanResult({
          status: "error",
          message: data.message
        });
      }
    } catch (err) {
      setScanResult({
        status: "error",
        message: "Computer Vision API is currently offline."
      });
    } finally {
      setIsScanning(false);
    }
  }, [webcamRef]);

  return (
    <div className="mx-auto max-w-4xl pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text)] sm:text-4xl">Student Security Portal</h1>
        <p className="mt-2 text-[var(--muted)]">Authenticate your daily campus presence using zero-trust geofencing and AI vision.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Geolocation Card */}
        <div className="rounded-[2rem] bg-white/40 border border-white/40 p-6 shadow-[var(--shadow)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-black/5 pb-4 mb-4">
            <div className="bg-[var(--primary-soft)] text-[var(--primary)] p-2 rounded-full">
              <MapPin size={24} />
            </div>
            <h2 className="text-xl font-bold text-[var(--text)]">Geofencing Status</h2>
          </div>

          {!locationScore && !geoError ? (
            <p className="text-sm animate-pulse text-[var(--muted)]">Acquiring satellite lock...</p>
          ) : geoError ? (
            <div className="bg-red-50 text-[var(--danger)] p-4 rounded-xl text-sm flex gap-2 items-start">
              <XCircle size={18} className="shrink-0 mt-0.5" />
              <p>{geoError}</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Campus Range</span>
                <span className="font-bold text-[var(--text)]">{distance < 1000 ? Math.round(distance) + 'm' : (distance/1000).toFixed(1) + 'km'}</span>
              </div>
              
              {locationScore === "in_bounds" ? (
                 <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-xl flex gap-3 items-center">
                    <CheckCircle size={24} />
                    <div>
                      <p className="font-bold">Verified in Campus</p>
                      <p className="text-xs opacity-80">You are within the authorized perimeter.</p>
                    </div>
                 </div>
              ) : (
                 <div className="bg-red-50 text-[var(--danger)] border border-red-200 p-4 rounded-xl flex gap-3 items-center">
                    <XCircle size={24} />
                    <div>
                      <p className="font-bold">Out of Bounds</p>
                      <p className="text-xs opacity-80">You are too far from campus to sign in.</p>
                    </div>
                 </div>
              )}
            </div>
          )}
        </div>

        {/* AI Camera Card */}
        <div className="rounded-[2rem] bg-white/40 border border-white/40 p-6 shadow-[var(--shadow)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-black/5 pb-4 mb-4">
            <div className="bg-[var(--primary-soft)] text-[var(--primary)] p-2 rounded-full">
              <Camera size={24} />
            </div>
            <h2 className="text-xl font-bold text-[var(--text)]">Facial Recognition</h2>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-black/5 aspect-video flex items-center justify-center mb-4">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isScanning && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 backdrop-blur-sm z-10 transition-all">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                <p className="text-white font-semibold text-sm tracking-wider uppercase">Running AI Model</p>
              </div>
            )}
            
            {/* Scanner overlay effect */}
            <div className="absolute inset-0 pointer-events-none border-2 border-[var(--primary)]/30 z-0">
               <div className="w-full h-1 bg-[var(--primary)]/80 shadow-[0_0_15px_var(--primary)] animate-[scan_3s_ease-in-out_infinite]"></div>
            </div>
          </div>

          {scanResult ? (
            <div className={`p-4 rounded-xl border ${scanResult.status === 'success' ? 'bg-[var(--primary-soft)] border-[var(--primary)]/20 text-[var(--primary)]' : 'bg-red-50 border-red-200 text-[var(--danger)]'}`}>
              <div className="flex items-start gap-2">
                {scanResult.status === 'success' ? <CheckCircle className="shrink-0 mt-0.5" /> : <XCircle className="shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold text-sm bg-transparent">
                    {scanResult.status === 'success' ? scanResult.name : 'Unknown Identity'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">{scanResult.message}</p>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={captureFace}
              disabled={isScanning || locationScore !== "in_bounds"}
              className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] text-white font-bold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Camera size={18} />
              {locationScore !== "in_bounds" ? "Geofence Required to Scan" : "Scan Face for Attendance"}
            </button>
          )}

        </div>

        {/* Free Slots Matcher */}
        <div className="md:col-span-2 mt-4">
           <FreeSlotsPanel />
        </div>

        {/* AI Leave Predictor Card */}
        <div className="md:col-span-2">
           <MLLeaveCalculator currentPresent={34} currentTotal={42} />
        </div>

        {/* AI Routine Generator & Gamification */}
        <div className="md:col-span-2">
           <AIFreePeriodMonetizer />
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(200px); }
        }
      `}</style>
    </div>
  );
}
