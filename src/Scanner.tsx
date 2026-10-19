import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, Copy, ExternalLink, Check, AlignLeft, History, Trash2, X, Share } from 'lucide-react';
import { readBarcodesFromImageData } from 'zxing-wasm';

// Helper to parse complex QR formats into clean Key-Value pairs
function parseQRData(rawText: string): Record<string, string> | string {
  const data: Record<string, string> = {};

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

  if (rawText.trim().startsWith('<?xml') || rawText.trim().startsWith('<')) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawText, "text/xml");
      if (!xmlDoc.querySelector('parsererror')) {
        data['Data Type'] = 'Structured Document';
        const elements = xmlDoc.getElementsByTagName('*');
        let isStructured = false;
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.children.length === 0 && el.textContent && el.textContent !== 'NA') {
            const formattedKey = el.tagName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
            data[formattedKey] = el.textContent;
            isStructured = true;
          }
        }
        if (isStructured) return data;
      }
    } catch (e) { /* fallback */ }
  }

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

  return rawText;
}

// Helper to format the parsed object into a clean string for Clipboard/Sharing
function formatForExport(rawText: string): string {
  const parsed = parseQRData(rawText);
  if (typeof parsed === 'object') {
    return Object.entries(parsed)
      .filter(([_, val]) => val) // Skip empty values
      .map(([key, val]) => `${key}:\n${val}`)
      .join('\n\n');
  }
  return parsed;
}

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  
  // History State
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('scannerHistory');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { }
    }
  }, []);

  const saveToHistory = (newScan: string) => {
    setHistory(prev => {
      const updated = [newScan, ...prev.filter(item => item !== newScan)].slice(0, 10);
      localStorage.setItem('scannerHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('scannerHistory');
  };

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
    if (isScanning && !showHistory) startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isScanning, showHistory]);

  useEffect(() => {
    let animationFrameId: number;
    async function scanFrame() {
      if (!isScanning || showHistory) return;
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
              if ('vibrate' in navigator) navigator.vibrate([200]);
              const text = results[0].text;
              setScanResult(text);
              saveToHistory(text);
              setIsScanning(false);
            }
          } catch (e: any) {}
        }
      }
      if (isScanning && !showHistory) animationFrameId = requestAnimationFrame(scanFrame);
    }
    if (isScanning && !showHistory) animationFrameId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isScanning, showHistory]);

  const handleCopy = async (textToCopy: string) => {
    const formattedText = formatForExport(textToCopy);
    await navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (textToShare: string) => {
    const formattedText = formatForExport(textToShare);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Scanned Data',
          text: formattedText,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('Sharing is not supported on this device/browser.');
    }
  };

  const parsedData = scanResult ? parseQRData(scanResult) : null;
  const isUrl = scanResult?.startsWith('http://') || scanResult?.startsWith('https://');
  const canShare = 'share' in navigator;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white p-4 relative">
      <header className="my-2 text-center">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2 text-slate-100">
          <Camera className="w-5 h-5 text-purple-400" /> Universal Scanner
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Point camera at any barcode or QR code</p>
        <p className="mt-2 inline-flex rounded-full border border-purple-500/30 bg-slate-900 px-3 py-1 text-xs font-medium text-purple-300">
          Build {__APP_VERSION__}
        </p>
      </header>

      <canvas ref={canvasRef} className="hidden" />

      {/* Main Scanner Window */}
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

      {/* Scan Results Panel */}
      <div className="w-full max-w-sm mb-14">
        {scanResult && parsedData ? (
          <div className="bg-slate-900 border border-purple-500/50 p-4 rounded-xl shadow-lg flex flex-col gap-3">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" /> <span>Scan Successful</span>
            </div>
            
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
              <button onClick={() => handleCopy(scanResult)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm border border-slate-700">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              
              {canShare && (
                <button onClick={() => handleShare(scanResult)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm border border-slate-700">
                  <Share className="w-4 h-4" /> Share
                </button>
              )}

              {isUrl && (
                <a href={scanResult} target="_blank" rel="noopener noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm">
                  <ExternalLink className="w-4 h-4" /> Open
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

      {/* Floating History Button */}
      {!scanResult && (
        <button 
          onClick={() => setShowHistory(true)}
          className="absolute bottom-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium shadow-lg transition"
        >
          <History className="w-4 h-4 text-purple-400" /> View History
        </button>
      )}

      {/* History Modal Overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 flex flex-col p-4 animate-in fade-in slide-in-from-bottom-8 duration-200">
          <div className="flex items-center justify-between mt-2 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
              <History className="w-5 h-5 text-purple-400" /> Recent Scans
            </h2>
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3">
            {history.length === 0 ? (
              <div className="text-center text-slate-500 mt-10 text-sm">No scans yet.</div>
            ) : (
              history.map((item, idx) => {
                const isItemUrl = item.startsWith('http');
                return (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col gap-2">
                    <p className="text-sm font-mono text-slate-300 break-all line-clamp-2">{item}</p>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleCopy(item)} className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 py-1.5 rounded flex items-center justify-center gap-1.5 text-slate-300">
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                      {canShare && (
                        <button onClick={() => handleShare(item)} className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 py-1.5 rounded flex items-center justify-center gap-1.5 text-slate-300">
                          <Share className="w-3.5 h-3.5" /> Share
                        </button>
                      )}
                      {isItemUrl && (
                        <a href={item} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-1.5 rounded flex items-center justify-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {history.length > 0 && (
            <button onClick={clearHistory} className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 py-3 rounded-xl font-medium text-sm transition">
              <Trash2 className="w-4 h-4" /> Clear All History
            </button>
          )}
        </div>
      )}
    </div>
  );
}