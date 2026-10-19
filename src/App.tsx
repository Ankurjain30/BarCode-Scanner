import { useEffect, useState } from 'react';
import Scanner from './Scanner';
import { X, Share, PlusSquare, Download } from 'lucide-react';

export default function App() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /android/.test(userAgent);
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone === true;

    if (isStandalone) return;

    if (isIOS) {
      const timer = setTimeout(() => setShowIOSPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    if (isAndroid) {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowAndroidPrompt(true);
      };
      
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Fallback timer so Android users always see the banner button
      const fallbackTimer = setTimeout(() => {
        setShowAndroidPrompt(true);
      }, 2000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        clearTimeout(fallbackTimer);
      };
    }
  }, []);

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowAndroidPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      alert("To install, tap Chrome's menu (three dots in the top right) and select 'Install app' or 'Add to Home screen'.");
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950">
      <Scanner />

      {/* 🍎 Apple / iOS Install Guide Banner */}
      {showIOSPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900/95 backdrop-blur border border-purple-500/30 p-4 rounded-xl shadow-2xl text-white flex flex-col gap-2 max-w-sm mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-purple-400">Add to Home Screen</h3>
              <p className="text-xs text-slate-300 mt-0.5">Install Universal Scanner for offline use & fast access!</p>
            </div>
            <button onClick={() => setShowIOSPrompt(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="border-t border-slate-800 my-1"></div>
          <div className="flex items-center gap-3 text-xs text-slate-300 py-1">
            <span className="flex items-center justify-center bg-slate-800 p-1.5 rounded-lg border border-slate-700 shrink-0">
              <Share className="w-4 h-4 text-blue-400" />
            </span>
            <span>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300 pb-1">
            <span className="flex items-center justify-center bg-slate-800 p-1.5 rounded-lg border border-slate-700 shrink-0">
              <PlusSquare className="w-4 h-4 text-purple-400" />
            </span>
            <span>2. Scroll down and choose <strong>Add to Home Screen</strong>.</span>
          </div>
        </div>
      )}

      {/* 🤖 Android Install Banner with Reliable Button */}
      {showAndroidPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900/95 backdrop-blur border border-purple-500/30 p-4 rounded-xl shadow-2xl text-white flex flex-col gap-3 max-w-sm mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-purple-400">Install Universal Scanner</h3>
              <p className="text-xs text-slate-300 mt-0.5">Install this app for offline use & quick home screen access!</p>
            </div>
            <button onClick={() => setShowAndroidPrompt(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={handleAndroidInstall}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition text-sm shadow-lg shadow-purple-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Install App Now
          </button>
        </div>
      )}
    </div>
  );
}