import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DownloadCloud, X } from 'lucide-react';

function PwaUpdateModal() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative max-w-sm w-full mx-4 overflow-hidden rounded-[32px] bg-[#2a211d] border-4 border-[#e6c9b8]/50 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center ring-4 ring-black/20 animate-in zoom-in-95 duration-500">
        
        <button 
          onClick={() => setNeedRefresh(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#e6c9b8] shadow-2xl mb-6 animate-bounce">
          <DownloadCloud size={40} className="text-[#2a211d]" />
        </div>

        <h2 className="text-2xl font-black tracking-tight text-white mb-3">
          App Update Available
        </h2>
        
        <p className="text-sm font-medium text-white/70 mb-8 leading-relaxed">
          A new version of MalkaERP is ready with new features like background Push Notifications. Update now to get the best experience!
        </p>

        <button
          onClick={() => updateServiceWorker(true)}
          className="w-full rounded-2xl bg-[#e6c9b8] px-6 py-4 text-sm font-black uppercase tracking-wider text-[#2a211d] shadow-lg transition-all hover:brightness-110 active:scale-95"
        >
          Update & Restart Now
        </button>
      </div>
    </div>
  );
}

export default PwaUpdateModal;
