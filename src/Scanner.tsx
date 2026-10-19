import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, Copy, ExternalLink, Check, AlignLeft } from 'lucide-react';
import { readBarcodesFromImageData } from 'zxing-wasm';

// Helper to parse complex QR formats into clean Key-Value pairs
function parseQRData(rawText: string): Record<string, string> | string {
  const data: Record<string, string> = {};

  // 1. Parse Wi-Fi
  if (rawText.startsWith('WIFI:')) {
    const parts = rawText.replace('WIFI:', '').split(';');
    data['Data Type'] = 'Wi-Fi Network';
    parts.forEach(p => {
      if (p.startsWith('S:')) data['Network Name (SSID)'] = p.substring(2);
      if (p.startsWith('P:')) data['Password'] = p.substring(2);
      if (p.startsWith('T:')) data['Security'] = p.substring(2);
    });
    return data;
  }

  // 2. Parse Contact Cards (MECARD)
  if (rawText.startsWith('MECARD:')) {
    const parts = rawText.replace('MECARD:', '').split(';');
    data['Data Type'] = 'Contact Card';
    parts.forEach(p => {
      if (p.startsWith('N:')) data['Name'] = p.substring(2).replace(',', ' ');
      if (p.startsWith('TEL:')) data['Phone'] = p.substring(4);
      if (p.startsWith('EMAIL:')) data['Email'] = p.substring(6);
      if (p.startsWith('ADR:')) data['Address'] = p.substring(4);
    });
    return data;
  }

  // 3. Parse Generic Key:Value text (e.g., Line 1: Data 1 \n Line 2: Data 2)
  if (rawText.includes(':') && rawText.includes('\n')) {
    const lines = rawText.split('\n');
    let isStructured = false;
    lines.forEach(line => {
      const splitIdx = line.indexOf(':');
      if (splitIdx > 0) {
        const key = line.substring(0, splitIdx).trim();
        const val = line.substring(splitIdx + 1).trim();
        if (key && val) {
          data[key] = val;
          isStructured = true;
        }
      }
    });
    if (isStructured && Object.keys(data).length > 1) return data;
  }

  // If it's just a standard URL or plain text, return as-is
  return rawText;
}

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setError('Camera access denied or unavailable.');
        console.error(err);
      }
    }
    if (isScanning) startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isScanning]);

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
              if ('vibrate' in navigator) navigator.vibrate([200]); // Haptic feedback
              setScanResult(results[0].text);
              setIsScanning(false);
            }
          } catch (e: any) {
             // Ignore frame errors silently
          }
        }
      }
      if (isScanning) animationFrameId = requestAnimationFrame(scanFrame);
    }
    if (isScanning) animationFrameId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isScanning]);

  const copyToClipboard = async () => {
    if (scanResult) {
      await navigator.clipboard.writeText(scanResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const parsedData = scanResult ? parseQRData(scanResult) : null;
  const isUrl = scanResult?.startsWith('http://') || scanResult?.startsWith('https://');

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white p-4">
      <header className="my-2 text-center">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2 text-slate-100">
          <Camera className="w-5 h-5 text-purple-400" /> Universal PWA Scanner
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Point camera at any barcode or QR code</p>
      </header>

      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 my-auto">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
        {scanResult && parsedData ? (
          <div className="bg-slate-900 border border-purple-500/50 p-4 rounded-xl shadow-lg flex flex-col gap-3">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" /> <span>Scan Successful</span>
            </div>
            
            {/* Display formatted objects or plain text */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 max-h-48 overflow-y-auto">
              {typeof parsedData === 'object' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-400 mb-1 border-b border-slate-800 pb-2">
                    <AlignLeft className="w-4 h-4" /> <span className="text-xs font-semibold uppercase tracking-wider">Structured Data</span>
                  </div>
                  {Object.entries(parsedData).map(([key, val]) => (
                    val && (
                      <div key={key} className="flex flex-col">
                        <span className="text-purple-400/80 text-[10px] font-bold uppercase">{key}</span>
                        <span className="text-slate-200 text-sm break-words">{val}</span>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <p className="text-sm break-all font-mono text-slate-200">{parsedData}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={copyToClipboard} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm border border-slate-700">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied All' : 'Copy'}
              </button>
              {isUrl && (
                <a href={scanResult} target="_blank" rel="noopener noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm">
                  <ExternalLink className="w-4 h-4" /> Open Link
                </a>
              )}
            </div>

            <button onClick={() => { setScanResult(null); setCopied(false); setIsScanning(true); }} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition text-sm mt-1">
              <RefreshCw className="w-4 h-4" /> Scan Another
            </button>
          </div>
        ) : (
          <div className="text-center text-slate-500 text-xs py-2">Engine active • Scanning frames...</div>
        )}
      </div>
    </div>
  );
}