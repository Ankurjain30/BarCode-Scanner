import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { readBarcodesFromImageData } from 'zxing-wasm';

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  // 1. Start Camera Feed
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Camera access denied or unavailable. Please grant permissions.');
        console.error(err);
      }
    }

    if (isScanning) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning]);

  // 2. Frame Processing Loop for Barcode / QR detection
  useEffect(() => {
    let animationFrameId: number;

    async function scanFrame() {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          try {
            const results = await readBarcodesFromImageData(imageData);
            if (results && results.length > 0) {
              setScanResult(results[0].text);
              setIsScanning(false); // Pause scanning on success
            }
          } catch (e) {
            // Scanning in progress, ignore frame-level decode errors silently
          }
        }
      }

      if (isScanning) {
        animationFrameId = requestAnimationFrame(scanFrame);
      }
    }

    if (isScanning) {
      animationFrameId = requestAnimationFrame(scanFrame);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isScanning]);

  const resetScanner = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white p-4">
      <header className="my-2 text-center">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2 text-slate-100">
          <Camera className="w-5 h-5 text-purple-400" />
          Universal PWA Scanner
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Point camera at any barcode or QR code</p>
      </header>

      {/* Hidden canvas used to process frames for zxing-wasm */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 my-auto">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        
        {/* Viewfinder overlay */}
        <div className="absolute inset-0 border-[28px] border-black/50 flex items-center justify-center pointer-events-none">
          <div className="w-44 h-44 border-2 border-purple-400 rounded-lg animate-pulse shadow-[0_0_15px_rgba(192,132,252,0.5)]"></div>
        </div>

        {error && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <p className="text-sm text-slate-200">{error}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm mb-4">
        {scanResult ? (
          <div className="bg-slate-900 border border-purple-500/50 p-4 rounded-xl shadow-lg">
            <div className="flex items-center gap-2 text-purple-400 font-semibold mb-2 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Scan Successful</span>
            </div>
            <p className="bg-slate-950 p-3 rounded-lg text-xs break-all font-mono text-slate-200 border border-slate-800 max-h-28 overflow-y-auto">
              {scanResult}
            </p>
            <button 
              onClick={resetScanner}
              className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Scan Another
            </button>
          </div>
        ) : (
          <div className="text-center text-slate-500 text-xs py-2">
            Engine active • Scanning frames...
          </div>
        )}
      </div>
    </div>
  );
}