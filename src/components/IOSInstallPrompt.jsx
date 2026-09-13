import React, { useState, useEffect } from 'react';

/**
 * IOSInstallPrompt Component - Premium Glassmorphism Edition
 * 
 * Automatically detects iOS Safari and guides users to install the PWA.
 * Features:
 * - Automatic detection of iOS Safari
 * - Persistence to avoid over-prompting
 * - High-end glassmorphism UI
 */
const IOSInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Detect if the device is an iPhone/iPad/iPod
    // Updated detection to be more robust
    const isIOSDevice = [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    
    // 2. Detect if the app is already running in standalone mode (installed)
    const isStandaloneMode = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    setIsIOS(isIOSDevice);
    setIsStandalone(isStandaloneMode);

    // 3. Auto-show logic
    if (isIOSDevice && !isStandaloneMode) {
      const lastPrompted = localStorage.getItem('ios-pwa-prompt-last-shown');
      const now = Date.now();
      
      // Show if never prompted or if it was more than 7 days ago
      if (!lastPrompted || (now - parseInt(lastPrompted)) > 7 * 24 * 60 * 60 * 1000) {
        // Add a slight delay for better UX
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleClose = () => {
    setShowPrompt(false);
    // Persist the dismissal
    localStorage.setItem('ios-pwa-prompt-last-shown', Date.now().toString());
  };

  if (!isIOS || isStandalone) return null;

  return (
    <>
      {/* Premium Glassmorphism UI */}
      {showPrompt && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end items-center p-4 bg-black/20 backdrop-blur-md animate-in fade-in duration-500">
          <div 
            className="relative w-full max-w-sm mb-4 overflow-hidden rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-20 duration-700 ease-out"
            style={{ 
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            {/* Top Gloss Effect */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a211d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="relative z-0 flex flex-col items-center text-center p-8 pt-10">
              {/* App Icon Container */}
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl p-1 border border-white/50">
                   <div className="w-full h-full bg-[#2a211d] rounded-xl flex items-center justify-center overflow-hidden">
                      <img src="/logo192.png" alt="App Logo" className="w-14 h-14 object-contain" />
                   </div>
                </div>
                {/* Status Dot */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full shadow-sm"></div>
              </div>

              <h3 className="text-2xl font-black text-[#2a211d] tracking-tight mb-2">Install Malka ERP</h3>
              <p className="text-[#5d5450] text-sm font-medium leading-relaxed px-4 mb-8">
                Install this app on your iPhone for a faster, full-screen experience and offline access.
              </p>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-4 text-left p-4 bg-white/40 rounded-[1.5rem] border border-white/50 shadow-sm">
                  <div className="bg-white/80 p-2.5 rounded-xl shadow-sm backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-[#2a211d]/40 mb-0.5">Step 1</p>
                    <p className="text-[0.95rem] font-bold text-[#2a211d]">
                      Tap the <span className="text-[#007AFF]">Share</span> button
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-left p-4 bg-white/40 rounded-[1.5rem] border border-white/50 shadow-sm">
                  <div className="bg-white/80 p-2.5 rounded-xl shadow-sm backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2a211d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-[#2a211d]/40 mb-0.5">Step 2</p>
                    <p className="text-[0.95rem] font-bold text-[#2a211d]">
                      Select <span className="font-extrabold">"Add to Home Screen"</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 mb-2">
                <button 
                  onClick={handleClose}
                  className="px-8 py-3 bg-[#2a211d] text-white rounded-full font-bold shadow-xl shadow-[#2a211d]/20 active:scale-95 transition-transform"
                >
                  Maybe Later
                </button>
              </div>
            </div>

            {/* iOS Bottom Navigation Indicator Simulation */}
            <div className="flex justify-center pb-2 opacity-20">
              <div className="w-32 h-1.5 bg-black rounded-full"></div>
            </div>
          </div>
          
          {/* Animated Pointer Arrow */}
          <div className="relative animate-bounce mb-8">
            <div className="w-8 h-8 rotate-45 bg-white/70 backdrop-blur-lg border-r-2 border-b-2 border-white/50 shadow-2xl"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default IOSInstallPrompt;

