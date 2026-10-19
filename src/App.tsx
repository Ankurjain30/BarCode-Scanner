import { useEffect, useState } from 'react';
import Scanner from './Scanner';
import { X, Share, PlusSquare } from 'lucide-react';

export default function App() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // 1. Detect iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // 2. Detect if the app is already running as installed on Home Screen
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone === true;

    // Show prompt only on iOS and only if running in typical mobile browser (Safari)
    if (isIOS && !isStandalone) {
      // Show prompt after a small 2-second delay so they can load first
      const timer = setTimeout(() => {
        setShowIOSPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950">
      <Scanner />

      {/* 🟢 The Real Install iOS Shortcut Prompt Pop-up */}
      {showIOSPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900/95 backdrop-blur border border-purple-500/30 p-4 rounded-xl shadow-2xl animate-bounce-short text-white flex flex-col gap-2 max-w-sm mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-purple-400">Add to Home Screen</h3>
              <p className="text-xs text-slate-300 mt-0.5">Install this app for full-screen camera speed & offline use!</p>
            </div>
            <button 
              onClick={() => setShowIOSPrompt(false)} 
              className="text-slate-400 hover:text-white p-1"
            >
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
    </div>
  );
}